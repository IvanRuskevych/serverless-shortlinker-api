import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import { v4 } from "uuid";

import { User } from "../schemas/interfaces";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { createError } from "../utils/errors";
import { hashPassword } from "../services/password.services";
import { generateTokens } from "../services/tokens.services";

const dynamoDBClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDBClient);

const usersTableName = "TableUsers";
const headers = { "content-type": "application/json" };

export const signUp = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);
    const { email, password } = reqBody;

    const scanCommandEmail: ScanCommand = new ScanCommand({
      TableName: usersTableName,
      FilterExpression: "email = :value",
      ExpressionAttributeValues: marshall({ ":value": email }),
    });

    const result = await dynamoDBClient.send(scanCommandEmail);

    if (result.Items && result.Items.length > 0) {
      return createError(409, { message: "Email in use" });
    }
    const userID = v4();
    const hashedPSW = await hashPassword(password);
    const { accessToken, refreshToken } = generateTokens({ userID, email });

    const newUser = {
      ...reqBody,
      password: hashedPSW,
      userID,
      accessToken,
      refreshToken,
    };

    const command: PutCommand = new PutCommand({
      TableName: usersTableName,
      Item: newUser,
    });

    await ddbDocClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(newUser),
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

export const signIn = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email, password } = JSON.parse(event.body || "") as User;

    // if (!email || !password) {
    //   return {
    //     statusCode: 400,
    //     body: "Enter email or password",
    //   };
    // }
    // ===================================================
    const command: ScanCommand = new ScanCommand({
      TableName: usersTableName,
      FilterExpression: "email = :value",
      ExpressionAttributeValues: marshall({ ":value": email }),
    });

    const result = await dynamoDBClient.send(command);

    if (!result.Items || result.Items.length === 0) {
      return createError(404, { message: "User not found" });
    }

    // ===================================================
    const body = JSON.stringify(unmarshall(result.Items[0]));

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

export const usersList = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const command: ScanCommand = new ScanCommand({
    TableName: usersTableName,
  });

  const { Items } = await ddbDocClient.send(command);

  const unmarshalledItems = Items!.map((item) => unmarshall(item));

  const body = JSON.stringify(unmarshalledItems);

  return {
    statusCode: 200,
    headers,
    body,
  };
};

// async function isUserExists(email: string): Promise<any> {
//   const command: ScanCommand = new ScanCommand({
//     TableName: usersTableName,
//     FilterExpression: "email = :value",
//     ExpressionAttributeValues: marshall({ ":value": email }),
//   });

//   const { Items } = await client.send(command);

//   if (!Items || Items.length === 0) {
//     throw new HttpError(404, { message: "User not found" });
//   }

//   if (Items && Items.length > 0) {
//     throw new HttpError(409, { message: "Email in use" });
//   }

//   return Items[0];
// }

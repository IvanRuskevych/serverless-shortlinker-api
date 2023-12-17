import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { v4 } from 'uuid';

import { User } from '../schemas/interfaces';
import { createError } from '../utils/errors';

import { generateTokens, getItemsFromTable, hashPassword, updateTokensInTable, validatePassword } from '../services';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const { USERS_TABLE } = process.env;
const headers = { 'content-type': 'application/json' };

export const signUp = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);
    const { email, password } = reqBody;

    const scanCommandEmail: ScanCommand = new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :value',
      ExpressionAttributeValues: marshall({ ':value': email }),
    });

    const result = await ddbClient.send(scanCommandEmail);

    if (result.Items && result.Items.length > 0) {
      return createError(409, { message: 'Email in use' });
    }

    const userID = v4();
    const hashedPSW = await hashPassword(password);
    const { accessToken, refreshToken } = generateTokens({ userID });

    const newUser = {
      ...reqBody,
      password: hashedPSW,
      userID,
      accessToken,
      refreshToken,
    };

    console.log(' ~ newUser:', newUser);

    const command: PutCommand = new PutCommand({
      TableName: USERS_TABLE,
      Item: newUser,
    });

    console.log(' ~ command:', command);

    await ddbDocClient.send(command);

    const body = JSON.stringify({ userID, accessToken, refreshToken });

    return {
      statusCode: 201,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

export const signIn = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email, password } = JSON.parse(event.body || '') as User;

    if (!email || !password) {
      return {
        statusCode: 400,
        body: 'Enter email or password',
      };
    }

    // find user by id
    const commandFindUserByEmail: ScanCommand = new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :value',
      ExpressionAttributeValues: marshall({ ':value': email }),
    });

    const { Items } = await ddbClient.send(commandFindUserByEmail);

    if (!Items || Items.length === 0) {
      return createError(404, { message: 'User not found' });
    }

    // validate psw
    const passwordDB = unmarshall(Items[0]).password;

    const isValidPassword = validatePassword(password, passwordDB);

    if (!isValidPassword) {
      return {
        statusCode: 401,
        body: 'Password or email is wrong',
      };
    }

    // create new tokens
    const userID = Items[0].userID.S!;
    const { accessToken, refreshToken } = generateTokens({ userID });
    const body = JSON.stringify({ userID, accessToken, refreshToken });

    await updateTokensInTable(USERS_TABLE!, userID, accessToken, refreshToken);

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
  const unmarshalledUsersList = await getItemsFromTable(USERS_TABLE!);

  const body = JSON.stringify(unmarshalledUsersList);

  return {
    statusCode: 200,
    headers,
    body,
  };
};

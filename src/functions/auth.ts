import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 } from "uuid";
import AWS from "aws-sdk";

const docClient = new AWS.DynamoDB.DocumentClient();

const usersTableName = "TableUsers";
const headers = { "content-type": "application/json" };

export const userSignUp = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const reqBody = JSON.parse(event.body as string);

  const newUser = {
    ...reqBody,
    //   password: hashedPSW
    userID: v4(),
  };

  await docClient
    .put({
      TableName: usersTableName,
      Item: newUser,
    })
    .promise();

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify(newUser),
  };
};

export const usersList = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { Items } = await docClient
    .scan({
      TableName: usersTableName,
    })
    .promise();

  const body = JSON.stringify(Items);

  return {
    statusCode: 200,
    headers,
    body,
  };
};

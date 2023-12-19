import { DynamoDBClient, ScanCommand, UpdateItemCommand, UpdateItemCommandInput } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { createError } from '../utils/errors';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const { USERS_TABLE } = process.env;

export const getItemsFromTable = async (tableName: string) => {
  try {
    const command: ScanCommand = new ScanCommand({
      TableName: tableName,
    });

    const { Items } = await ddbDocClient.send(command);

    const unmarshalledItems = Items!.map((item) => unmarshall(item));

    return unmarshalledItems;
  } catch (error) {
    return createError(500, { message: `Error getting items from table: ${error}` });
  }
};

export const updateTokensInTable = async (
  tableName: string,
  userID: string,
  accessToken: string,
  refreshToken: string
) => {
  try {
    const paramsUpdateToken: UpdateItemCommandInput = {
      TableName: tableName,
      Key: marshall({ userID }),
      UpdateExpression: 'SET accessToken = :value1, refreshToken = :value2',
      ExpressionAttributeValues: marshall({ ':value1': accessToken, ':value2': refreshToken }),
      ReturnValues: 'ALL_NEW',
    };

    const commandUpdateTokens = new UpdateItemCommand(paramsUpdateToken);

    await ddbDocClient.send(commandUpdateTokens);
  } catch (error) {
    return createError(500, { message: `Error updating tokens: ${error}` });
  }
};

export const getUserLinks = async (tableName: string, userID: string) => {
  try {
    const command: ScanCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'userID = :value',
      ExpressionAttributeValues: marshall({ ':value': userID }),
    });

    const { Items } = await ddbClient.send(command);
    const unmarshallItems = Items?.map((item) => unmarshall(item));

    return unmarshallItems;
  } catch (error) {
    return createError(500, { message: `Error getting user links: ${error}` });
  }
};

export const findUserByEmail = async (email: string) => {
  try {
    const command: ScanCommand = new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :value',
      ExpressionAttributeValues: marshall({ ':value': email }),
    });

    const { Items } = await ddbClient.send(command);

    // const result = Items!.map((item) => unmarshall(item));

    // return result;
    return Items;
  } catch (error) {
    return createError(500, { message: `Error finding the user by email: ${error}` });
  }
};

export const addUser = async (newUser: any) => {
  try {
    const command: PutCommand = new PutCommand({
      TableName: USERS_TABLE,
      Item: newUser,
    });

    await ddbDocClient.send(command);
  } catch (error) {
    return createError(500, { message: `Error adding the new user: ${error}` });
  }
};

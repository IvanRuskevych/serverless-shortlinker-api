import { DynamoDBClient, ScanCommand, UpdateItemCommand, UpdateItemCommandInput } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const getItemsFromTable = async (tableName: string) => {
  const command: ScanCommand = new ScanCommand({
    TableName: tableName,
  });

  const { Items } = await ddbDocClient.send(command);

  const unmarshalledItems = Items!.map((item) => unmarshall(item));

  return unmarshalledItems;
};

export const updateTokensInTable = async (
  tableName: string,
  userID: string,
  accessToken: string,
  refreshToken: string
) => {
  const paramsUpdateToken: UpdateItemCommandInput = {
    TableName: tableName,
    Key: marshall({ userID }),
    UpdateExpression: 'SET accessToken = :value1, refreshToken = :value2',
    ExpressionAttributeValues: marshall({ ':value1': accessToken, ':value2': refreshToken }),
    ReturnValues: 'ALL_NEW',
  };

  const commandUpdateTokens = new UpdateItemCommand(paramsUpdateToken);

  await ddbDocClient.send(commandUpdateTokens);
};

export const getUserLinks = async (tableName: string, userID: string) => {
  const command: ScanCommand = new ScanCommand({
    TableName: tableName,
    FilterExpression: 'userID = :value',
    ExpressionAttributeValues: marshall({ ':value': userID }),
  });

  const { Items } = await ddbClient.send(command);
  const unmarshallItems = Items?.map((item) => unmarshall(item));

  return unmarshallItems;
};

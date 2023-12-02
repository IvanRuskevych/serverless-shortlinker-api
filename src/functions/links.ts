import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, ScanCommand, UpdateItemCommand, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

import { v4 } from "uuid";

import { createError } from "../utils/errors";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const headers = { "content-type": "application/json" };
const linksTableName = "TableLinks";
const BASE_URL = process.env.BASE_URL;

export const createNewLink = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // check for authorized and get userID

    const reqBody = JSON.parse(event.body as string);
    const { expireDays = 0 } = reqBody as { expireDays: number };

    // if (!link) {}
    // if (expireDays>0) {} // => add to scheduler

    const linkID: string = v4();
    const linkMarker: string = linkID.slice(0, 6);

    const shortedLink: string = `${BASE_URL}/links/${linkMarker}`;

    const createdDate = Date.now();
    const expireDate = Date.now() + expireDays * 24 * 60 * 60 * 1000;

    const newLinkData = {
      ...reqBody,
      //   userID,
      linkID,
      linkMarker,
      linkClickCounter: 0,
      createdDate: expireDays > 0 ? createdDate : "",
      expireDate: expireDays > 0 ? expireDate : "",
    };

    const command: PutCommand = new PutCommand({
      TableName: linksTableName,
      Item: newLinkData,
    });

    await ddbDocClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ shortedLink, BASE_URL }),
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

export const linksList = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const command: ScanCommand = new ScanCommand({
      TableName: linksTableName,
    });

    const { Items } = await ddbDocClient.send(command);

    const unmarshalledItems = Items!.map((item) => unmarshall(item));

    const body = JSON.stringify(unmarshalledItems);

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

export const redirectToOriginalLink = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const linkMarker = event.pathParameters?.linkMarker as string;

    if (!linkMarker) {
      return createError(400, { message: "Invalid link ==>> linkMarker" });
    }

    // Find link by linkMarker
    const commandFindLink: ScanCommand = new ScanCommand({
      TableName: linksTableName,
      FilterExpression: "linkMarker = :value",
      ExpressionAttributeValues: marshall({ ":value": linkMarker }),
    });

    const existsLink = await ddbClient.send(commandFindLink);

    if (!existsLink.Items || existsLink.Items.length === 0) {
      return createError(404, { message: "The link deactivated" });
    }

    // Increase the link counter
    const linkID = existsLink.Items[0].linkID.S!;
    // const originalLink = existsLink.Items[0].link.S!;

    // find link by id & update counter
    const paramsUpdateCounter: UpdateItemCommandInput = {
      TableName: linksTableName,
      Key: marshall({ linkID: linkID }),
      UpdateExpression: "ADD linkClickCounter :value",
      ExpressionAttributeValues: marshall({ ":value": 1 }),
      ReturnValues: "ALL_NEW",
    };

    const commandUpdateCounter = new UpdateItemCommand(paramsUpdateCounter);

    await ddbDocClient.send(commandUpdateCounter);

    // return original link
    const body = JSON.stringify(unmarshall(existsLink.Items[0]).link);

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

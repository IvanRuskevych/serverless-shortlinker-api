import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import { v4 } from "uuid";

import { createError } from "../utils/errors";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const headers = { "content-type": "application/json" };
const linksTableName = "TableLinks";

export const createNewLink = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // check for authorized and get userID

    const reqBody = JSON.parse(event.body as string);
    const { link, expireDays = 0 } = reqBody as { link: string; expireDays: number };

    // if (!link) {}
    // if (expireDays>0) {} // => add to scheduler

    const linkID: string = v4();
    const { protocol, hostname, pathname } = new URL(link);
    const linkMarker: string = linkID.slice(0, 6);
    const shortedLink: string = `${protocol}//${hostname}${pathname}?linkMarker=${linkMarker}`;
    const createdDate = Date.now();
    const expireDate = Date.now() + expireDays * 24 * 60 * 60 * 1000;
    // const defDate = (expireDate - createdDate) / (24 * 60 * 60 * 1000);

    const newLinkData = {
      ...reqBody,
      //   userID,
      linkID,
      linkMarker,
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
      body: JSON.stringify({ shortedLink }),
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

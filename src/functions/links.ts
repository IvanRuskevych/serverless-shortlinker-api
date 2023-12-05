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
    const {
      link,
      expireDays = 0,
      isOneTime = false,
    } = reqBody as { link: string; expireDays: number; isOneTime: Boolean };

    // if (!link) {}
    // if (expireDays>0) {} // => add to scheduler

    const linkID: string = v4();
    const linkMarker: string = linkID.slice(0, 6);

    const shortedLink: string = `${BASE_URL}/links/${linkMarker}`;

    // const createdDate = Date.now();
    const expireDate = Date.now() + expireDays * 24 * 60 * 60 * 1000;

    const newLinkData = {
      //   userID,

      linkID,
      linkMarker,
      link,

      isOneTime,
      isActive: true,
      linkClickCounter: 0,

      // createdDate: createdDate > 0 ? createdDate : "",
      expireDate: expireDays > 0 ? expireDate : 0,
    };

    const commandNewLinkData: PutCommand = new PutCommand({
      TableName: linksTableName,
      Item: newLinkData,
    });

    await ddbDocClient.send(commandNewLinkData);

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

    const { Items } = await ddbClient.send(commandFindLink);
    if (!Items || Items.length === 0) {
      return createError(404, { message: "Link does not exists" });
    }

    const { linkID, link, isActive, isOneTime } = unmarshall(Items[0]);

    if (!isActive) {
      return createError(404, { message: "The link was deactivated" });
    }

    // find link by id & check isOneTime
    if (isOneTime) {
      const paramsUpdateIsOneTime: UpdateItemCommandInput = {
        TableName: linksTableName,
        Key: marshall({ linkID }),
        UpdateExpression: "SET isOneTime = :value1, isActive = :value2, linkClickCounter = :value3",
        ExpressionAttributeValues: marshall({ ":value1": false, ":value2": false, ":value3": 1 }),
        ReturnValues: "ALL_NEW",
      };
      const commandUpdateIsOneTime = new UpdateItemCommand(paramsUpdateIsOneTime);

      await ddbDocClient.send(commandUpdateIsOneTime);
    } else {
      // Increase the link counter
      const paramsUpdateCounter: UpdateItemCommandInput = {
        TableName: linksTableName,
        Key: marshall({ linkID }),
        UpdateExpression: "ADD linkClickCounter :value",
        ExpressionAttributeValues: marshall({ ":value": 1 }),
        ReturnValues: "ALL_NEW",
      };

      const commandUpdateCounter = new UpdateItemCommand(paramsUpdateCounter);

      await ddbDocClient.send(commandUpdateCounter);
    }

    // return original link
    const body = JSON.stringify(link);

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

export const deactivateLink = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const linkID = event.pathParameters?.linkID as string;

    if (!linkID) {
      return createError(400, { message: "Invalid link ID" });
    }

    const paramsIsActiveLink: UpdateItemCommandInput = {
      TableName: linksTableName,
      Key: marshall({ linkID: linkID }),
      UpdateExpression: "SET isActive = :value",
      ExpressionAttributeValues: marshall({ ":value": false }),
      ReturnValues: "ALL_NEW",
    };

    const commandIsActiveLink = new UpdateItemCommand(paramsIsActiveLink);
    await ddbDocClient.send(commandIsActiveLink);

    const body = JSON.stringify({ message: `Link (ID:${linkID}) deactivated successfully.` });

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

export const deactivateLinkCron = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const commandDeactivateExpiredLinks: ScanCommand = new ScanCommand({
      TableName: linksTableName,
      FilterExpression: "isActive = :value1 AND expireDate < :currentDate",
      ExpressionAttributeValues: marshall({ ":value1": true, ":currentDate": Date.now() }),
    });

    const { Items } = await ddbClient.send(commandDeactivateExpiredLinks);

    if (!Items || Items.length === 0) {
      const body = JSON.stringify({ message: "Deactivation links not found" }); // подумати що відправити

      return {
        statusCode: 200,
        body,
      };
    }

    const linksForDeactivating = Items.map((item) => unmarshall(item));

    for (const item of linksForDeactivating) {
      // const linkID = item.linkID.S!;
      const { linkID } = item;

      const paramsUpdateIsActive: UpdateItemCommandInput = {
        TableName: linksTableName,
        Key: marshall({ linkID }),
        UpdateExpression: "SET isActive = :value",
        ExpressionAttributeValues: marshall({ ":value": false }),
      };

      const commandUpdateIsActive = new UpdateItemCommand(paramsUpdateIsActive);

      await ddbDocClient.send(commandUpdateIsActive);
    }

    const body = JSON.stringify({ message: `Deactivated ${linksForDeactivating.length} links` }); // подумати що відправити

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

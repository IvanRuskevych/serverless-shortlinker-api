import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  ScanCommand,
  UpdateItemCommand,
  UpdateItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

import { v4 } from "uuid";

import { createError } from "../utils/errors";
import { getItemsFromTable } from "../services";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const headers = { "content-type": "application/json" };
const linksTableName = "TableLinks";
const usersTableName = "TableUsers";
const BASE_URL = process.env.BASE_URL;

export const createNewLink = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // check for authorized and get userID

    const reqBody = JSON.parse(event.body as string);
    const { link, expireDays, isOneTime = false } = reqBody as { link: string; expireDays: number; isOneTime: Boolean };

    // if (!link) {
    //   const body = JSON.stringify({ message: "Link is required" });
    //   return {
    //     statusCode: 400,
    //     headers,
    //     body,
    //   };
    // }

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
    const unmarshalledLinks = await getItemsFromTable(linksTableName);

    const body = JSON.stringify(unmarshalledLinks);

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
      // Increase the link counter for non-oneTime links
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
    const paramsFindLinkById = {
      TableName: linksTableName,
      Key: marshall({ linkID: linkID }),
    };
    const commandFindLinkById: GetItemCommand = new GetItemCommand(paramsFindLinkById);

    const { Item } = await ddbClient.send(commandFindLinkById);

    if (!Item) {
      return createError(404, { message: `Link with ID: ${linkID} does not exists` });
    }

    if (!Item.isActive) {
      return createError(200, { message: `Link with ID: ${linkID} is already deactivated` });
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
      const body = JSON.stringify({ message: "Deactivation links not found" });

      return {
        statusCode: 200,
        body,
      };
    }

    const linksForDeactivating = Items.map((item) => unmarshall(item));

    for (const item of linksForDeactivating) {
      // const linkID = item.linkID.S!;
      const { linkID } = item as { linkID: string };

      const paramsUpdateIsActive: UpdateItemCommandInput = {
        TableName: linksTableName,
        Key: marshall({ linkID }),
        UpdateExpression: "SET isActive = :value",
        ExpressionAttributeValues: marshall({ ":value": false }),
      };
      const commandUpdateIsActive = new UpdateItemCommand(paramsUpdateIsActive);

      await ddbDocClient.send(commandUpdateIsActive);
    }

    // // 1 Get userID from linksForDeactivating,
    // // 2 userID мають бути унікальними!!!
    // const usersID = [...new Set(linksForDeactivating.map((item) => item.userID.S))];

    // // const entriesForEmailMessage = linksForDeactivating.map((link) => {});

    // // 3 Get emails for all userID ==>>
    // let usersEmail = [];

    // for (const id of usersID) {
    //   try {
    //     const commandGetUsersByID: GetItemCommand = new GetItemCommand({
    //       TableName: usersTableName,
    //       Key: id,
    //     });

    //     const { Item } = await ddbClient.send(commandGetUsersByID);

    //     if (Item) {
    //       usersEmail.push(Item.email.S);
    //     }
    //   } catch (error) {
    //     return createError(500, { message: "Failed to get users email" });
    //   }
    // }

    // const uniqueUsersEmail = [...new Set(usersEmail)];

    const body = JSON.stringify({ message: `Deactivated ${linksForDeactivating.length} links` });

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

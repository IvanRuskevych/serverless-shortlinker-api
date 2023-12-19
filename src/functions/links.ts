import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
  ScanCommand,
  UpdateItemCommand,
  UpdateItemCommandInput,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { v4 } from 'uuid';

import { createError } from '../utils';
import { getUserLinks } from '../services';
import { DeactivatedLink } from '../schemas';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const sqs = new SQSClient();

const headers = { 'content-type': 'application/json' };
const { BASE_URL, USERS_TABLE, LINKS_TABLE, SQS_DEACTIVATION_QUEUE_URL } = process.env;

export const createNewLink = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // check for authorized and get userID
    const userID = event.requestContext?.authorizer?.lambda.userID;
    if (!userID) {
      return createError(401, { message: 'Not authorized' });
    }

    const reqBody = JSON.parse(event.body as string);
    const { link, expireDays, isOneTime = false } = reqBody as { link: string; expireDays: number; isOneTime: Boolean };

    if (!Number.isSafeInteger(expireDays)) {
      const body = JSON.stringify({ message: 'The "expireDays" should be an integer' });
      return {
        statusCode: 400,
        headers,
        body,
      };
    }

    if (!link || link === '') {
      const body = JSON.stringify({ message: 'Link is required' });
      return {
        statusCode: 400,
        headers,
        body,
      };
    }

    const linkID: string = v4();
    const linkMarker: string = linkID.slice(0, 6);

    const shortedLink: string = `${BASE_URL}/links/${linkMarker}`;

    const expireDate = Date.now() + expireDays * 24 * 60 * 60 * 1000;

    const newLinkData = {
      userID,

      linkID,
      linkMarker,
      link,

      isOneTime,
      isActive: true,
      linkClickCounter: 0,

      expireDate: expireDays > 0 ? expireDate : 0,
    };

    const commandNewLinkData: PutCommand = new PutCommand({
      TableName: LINKS_TABLE,
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
  const userID = event.requestContext?.authorizer?.lambda.userID;
  console.log('event.requestContext', event.requestContext);

  if (!userID) {
    return createError(401, { message: 'Not authorized' });
  }

  try {
    const userLinks = await getUserLinks(LINKS_TABLE!, userID);
    console.log(' ~ userLinks:', userLinks);

    const body = JSON.stringify(userLinks);

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
      return createError(400, { message: 'Invalid link ==>> linkMarker' });
    }

    // Find link by linkMarker
    const commandFindLink: ScanCommand = new ScanCommand({
      TableName: LINKS_TABLE,
      FilterExpression: 'linkMarker = :value',
      ExpressionAttributeValues: marshall({ ':value': linkMarker }),
    });

    const { Items } = await ddbClient.send(commandFindLink);

    if (!Items || Items.length === 0) {
      return createError(404, { message: 'Link does not exists' });
    }

    const { linkID, link, isActive, isOneTime } = unmarshall(Items[0]);

    if (!isActive) {
      return createError(404, { message: 'The link was deactivated' });
    }

    // find link by id & check isOneTime
    if (isOneTime) {
      const paramsUpdateIsOneTime: UpdateItemCommandInput = {
        TableName: LINKS_TABLE,
        Key: marshall({ linkID }),
        UpdateExpression: 'SET isOneTime = :value1, isActive = :value2, linkClickCounter = :value3',
        ExpressionAttributeValues: marshall({ ':value1': false, ':value2': false, ':value3': 1 }),
        ReturnValues: 'ALL_NEW',
      };
      const commandUpdateIsOneTime = new UpdateItemCommand(paramsUpdateIsOneTime);

      await ddbDocClient.send(commandUpdateIsOneTime);
    } else {
      // Increase the link counter for non-oneTime links
      const paramsUpdateCounter: UpdateItemCommandInput = {
        TableName: LINKS_TABLE,
        Key: marshall({ linkID }),
        UpdateExpression: 'ADD linkClickCounter :value',
        ExpressionAttributeValues: marshall({ ':value': 1 }),
        ReturnValues: 'ALL_NEW',
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
  const userID = event.requestContext?.authorizer?.lambda.userID;
  console.log(' ~ deactivateLink ~ userID:', userID);
  console.log('event.requestContext', event.requestContext);

  if (!userID) {
    return createError(401, { message: 'Not authorized' });
  }

  try {
    const linkID = event.pathParameters?.linkID as string;
    console.log(' ~ deactivateLink ~ linkID:', linkID);

    if (!linkID) {
      return createError(400, { message: 'Invalid link ID' });
    }

    const paramsFindLinkById = {
      TableName: LINKS_TABLE,
      Key: marshall({ linkID: linkID }),
    };

    const commandFindLinkById: GetItemCommand = new GetItemCommand(paramsFindLinkById);

    const { Item } = await ddbClient.send(commandFindLinkById);
    console.log(' ~ deactivateLink ~ Item:', Item);

    if (!Item) {
      return createError(404, { message: `Link with ID: ${linkID} does not exists` });
    }

    if (Item.userID.S! !== userID) {
      return createError(409, { message: `You do not have permission to deactivate the link` });
    }

    if (!Item.isActive.BOOL!) {
      return createError(200, { message: `Link with ID: ${linkID} is already deactivated` });
    }

    const paramsIsActiveLink: UpdateItemCommandInput = {
      TableName: LINKS_TABLE,
      Key: marshall({ linkID: linkID }),
      UpdateExpression: 'SET isActive = :value',
      ExpressionAttributeValues: marshall({ ':value': false }),
      ReturnValues: 'ALL_NEW',
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
  const userID = event.requestContext?.authorizer?.lambda.userID;
  console.log('event.requestContext', event.requestContext);

  if (!userID) {
    return createError(401, { message: 'Not authorized' });
  }

  try {
    const commandDeactivateExpiredLinks: ScanCommand = new ScanCommand({
      TableName: LINKS_TABLE,
      FilterExpression: 'userID = :value1 AND isActive = :value2 AND expireDate < :currentDate',
      ExpressionAttributeValues: marshall({ ':value1': userID, ':value2': true, ':currentDate': Date.now() }),
    });

    const { Items } = await ddbClient.send(commandDeactivateExpiredLinks);

    // Links for deactivation does`t exists
    if (!Items || Items.length === 0) {
      const body = JSON.stringify({ message: 'Deactivation links not found' });

      return {
        statusCode: 200,
        body,
      };
    }

    // Links for deactivation exists
    const linksForDeactivating = Items.map((item) => unmarshall(item));

    const userIdsSet = [...new Set(linksForDeactivating.map((item) => item.userID))];

    // Find by userID emails to send deactivated links
    let emailsList = [];

    for (const item of userIdsSet) {
      const paramsFindEmailsByUserID: GetItemCommandInput = {
        TableName: USERS_TABLE,
        Key: marshall({ userID: item }),
      };

      const commandFindEmailsByUserID: GetItemCommand = new GetItemCommand(paramsFindEmailsByUserID);

      const { Item } = await ddbClient.send(commandFindEmailsByUserID);

      if (Item) {
        const user = unmarshall(Item);
        emailsList.push({ userID: user.userID, email: user.email });
      }
    }

    let deactivatedLinksWithEmails: DeactivatedLink[] = [];

    for (const linkData of linksForDeactivating) {
      const userID = linkData.userID;
      const linkID = linkData.linkID;
      const link = linkData.link;

      emailsList.find((item) => {
        if (item.userID === userID) {
          deactivatedLinksWithEmails.push({ userID, linkID, link, email: item.email });
        }
      });

      // SET isActive = false
      const paramsIsActiveLink: UpdateItemCommandInput = {
        TableName: LINKS_TABLE,
        Key: marshall({ linkID: linkID }),
        UpdateExpression: 'SET isActive = :value',
        ExpressionAttributeValues: marshall({ ':value': false }),
        ReturnValues: 'ALL_NEW',
      };

      const commandIsActiveLink = new UpdateItemCommand(paramsIsActiveLink);
      await ddbDocClient.send(commandIsActiveLink);
    }

    // Queue service
    // const messages = deactivatedLinksWithEmails.map((item) => ({ Id: v4(), MessageBody: JSON.stringify(item) }));
    // try {
    //   await sqs.send(
    //     new SendMessageBatchCommand({
    //       QueueUrl: SQS_DEACTIVATION_QUEUE_URL,
    //       Entries: messages,
    //     })
    //   );
    // } catch (error) {
    //   console.error("Failed to send messages to SQS:", error);
    //   return createError(500, { message: error });
    // }

    // Create body for return
    const body = JSON.stringify({
      message: `Deactivated ${linksForDeactivating.length} links`,
    });

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    return createError(500, { message: error });
  }
};

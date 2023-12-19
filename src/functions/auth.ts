import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { v4 } from 'uuid';

import { User } from '../schemas';
import { createError } from '../utils';
import {
  addUser,
  findUserByEmail,
  generateTokens,
  getItemsFromTable,
  hashPassword,
  updateTokensInTable,
  validatePassword,
} from '../services';

const { USERS_TABLE } = process.env;
const headers = { 'content-type': 'application/json' };

export const signUp = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);
    const { email, password } = reqBody;

    const existingUser = await findUserByEmail(email);

    if (Array.isArray(existingUser) && existingUser.length > 0) {
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

    await addUser(newUser);

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
        body: 'Enter email and password',
      };
    }

    const output = await findUserByEmail(email);

    let existingUser = [];

    if (Array.isArray(output) && output.length > 0) {
      existingUser = output.map((el) => unmarshall(el));
    } else {
      return createError(404, { message: 'Password or email is wrong' });
    }

    // validate psw
    const { userID, password: passwordDB } = existingUser[0];

    const isValidPassword = await validatePassword(password, passwordDB);

    if (!isValidPassword) {
      return createError(401, { message: 'Password or email is wrong' });
    }

    // create new tokens
    const { accessToken, refreshToken } = generateTokens({ userID });

    await updateTokensInTable(USERS_TABLE!, userID, accessToken, refreshToken);

    const body = JSON.stringify({ userID, accessToken, refreshToken });
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

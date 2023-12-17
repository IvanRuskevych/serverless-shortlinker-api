import jwt, { JwtPayload } from 'jsonwebtoken';
import { createError } from '../utils/errors';

const { SECRET_ACCESS_TOKEN, SECRET_REFRESH_TOKEN } = process.env;

export const generateTokens = (payload: { userID: string }): { accessToken: string; refreshToken: string } => {
  const accessToken = jwt.sign(payload, SECRET_ACCESS_TOKEN!, { expiresIn: '60m' });
  const refreshToken = jwt.sign(payload, SECRET_REFRESH_TOKEN!);

  return {
    accessToken,
    refreshToken,
  };
};

export const saveToken = async (id: string) => {};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const payload = jwt.verify(token, SECRET_ACCESS_TOKEN!) as JwtPayload;
    return payload;
  } catch (error) {
    return createError(401, { message: 'Not authorized' });
  }
};

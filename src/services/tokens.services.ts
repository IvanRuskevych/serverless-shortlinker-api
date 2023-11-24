import jwt, { JwtPayload } from "jsonwebtoken";
import { createError } from "../utils/errors";

export const generateTokens = (payload: {
  userID: string;
  email: string;
}): { accessToken: string; refreshToken: string } => {
  const accessToken = jwt.sign(payload, "ACCESS_SECRET", { expiresIn: "60m" });
  const refreshToken = jwt.sign(payload, "REFRESH_SECRET");

  return {
    accessToken,
    refreshToken,
  };
};

export const verifyToken = (token: string, secret: string): JwtPayload => {
  return jwt.verify(token, secret) as JwtPayload;
};

export const saveToken = async (id: string) => {};

import jwt, { JwtPayload } from "jsonwebtoken";
import { createError } from "../utils/errors";

export const generateTokens = (payload: { userID: string }): { accessToken: string; refreshToken: string } => {
  const accessToken = jwt.sign(payload, "ACCESS_SECRET", { expiresIn: "60m" });
  const refreshToken = jwt.sign(payload, "REFRESH_SECRET");

  return {
    accessToken,
    refreshToken,
  };
};

export const saveToken = async (id: string) => {};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const payload = jwt.verify(token, "ACCESS_SECRET") as JwtPayload;
    return payload;
  } catch (error) {
    return createError(401, { message: "Not authorized" });
  }
};

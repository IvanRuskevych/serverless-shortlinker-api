import jwt, { JwtPayload } from "jsonwebtoken";
import { createError } from "../utils/errors";

const { TOKEN_ACCESS_SECRET, TOKEN_REFRESH_SECRET } = process.env;
export const generateTokens = (payload: { userID: string }): { accessToken: string; refreshToken: string } => {
  const accessToken = jwt.sign(payload, TOKEN_ACCESS_SECRET!, { expiresIn: "60m" });
  const refreshToken = jwt.sign(payload, TOKEN_REFRESH_SECRET!);

  return {
    accessToken,
    refreshToken,
  };
};

export const saveToken = async (id: string) => {};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const payload = jwt.verify(token, TOKEN_ACCESS_SECRET!) as JwtPayload;
    return payload;
  } catch (error) {
    return createError(401, { message: "Not authorized" });
  }
};

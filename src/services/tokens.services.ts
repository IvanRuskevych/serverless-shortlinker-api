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

// export const verifyToken = (token: string, secret: string): JwtPayload => {
//   try {
//     const isVerifyToken = jwt.verify(token, secret) as JwtPayload;
//     if (!isVerifyToken) {
//       return createError(401, { message: "Not authorized" });
//     }
//     return isVerifyToken;
//   } catch (error) {
//     return createError(401, { message: "Not authorized" });
//   }
// };

export const saveToken = async (id: string) => {};

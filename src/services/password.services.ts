import * as bcrypt from 'bcryptjs';

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

export const validatePassword = async (passwordReq: string, passwordDb: string): Promise<boolean> => {
  return await bcrypt.compare(passwordReq, passwordDb);
};

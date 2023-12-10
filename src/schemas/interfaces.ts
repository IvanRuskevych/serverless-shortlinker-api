export interface User {
  email: string;
  password: string;
}

export interface DeactivatedLink {
  userID: string;
  linkID: string;
  link: string;
  email: string;
}

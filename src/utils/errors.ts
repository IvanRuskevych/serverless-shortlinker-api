export class HttpError extends Error {
  constructor(public statusCode: number, body: Record<string, unknown> = {}) {
    super(JSON.stringify(body));
  }
}

export const handlerError = (error: unknown) => {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({ message: error.message }),
    };
  }

  throw error;
};

export const createError = (statusCode: number, body: Record<any, any>) => {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
};

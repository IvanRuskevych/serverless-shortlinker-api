import { Handler, PolicyDocument } from 'aws-lambda';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { verifyToken } from '../services';

export const users: Handler = (event, context, callback) => {
  console.log('authorizer2 ~ event:', event);

  if (!event.headers.authorization) {
    return callback('Unauthorized-1');
  }
  // const tokenParts = event.authorizationToken.split(' ');
  const tokenParts = event.headers.authorization.split(' ');
  const tokenValue = tokenParts[1];

  if (tokenParts[0].toLowerCase() !== 'bearer') {
    return callback('Unauthorized-2');
  }

  try {
    // const decoded = jwt.verify(tokenValue, process.env.SECRET_ACCESS_TOKEN!) as JwtPayload;
    const decoded = verifyToken(tokenValue);
    console.log(' authorizer2 ~ decoded:', decoded);

    return callback(null, {
      policyDocument: generatePolicy('Allow', event.routeArn),
      principalId: decoded.userId,
      context: {
        userId: decoded.userId,
        email: decoded.email,
      },
    });
  } catch (err) {
    return callback('Unauthorized-3');
  }
};

export const generatePolicy = (effect: string, resource: string): PolicyDocument => {
  const policyDocument = {} as PolicyDocument;
  if (effect && resource) {
    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];
    const statementOne: any = {};
    statementOne.Action = 'execute-api:Invoke';
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
  }

  console.log(' generatePolicy ~ policyDocument:', policyDocument);
  return policyDocument;
};

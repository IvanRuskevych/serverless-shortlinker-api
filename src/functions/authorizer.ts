import { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent, Callback, PolicyDocument } from 'aws-lambda';
import { verifyToken } from '../services';

export const users = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: any,
  callback: Callback<APIGatewayAuthorizerResult>
): Promise<void> => {
  console.log(' authorizer.users ~ event:', event);

  const accessToken = event.headers.authorization.split(' ')[1];
  const resource = event.routeArn;

  console.log(' ~ accessToken:', accessToken);

  if (!accessToken || !resource) {
    return callback('Not authorized');
  }

  const { userID } = verifyToken(accessToken);
  console.log('users-- verifyToken ~ userID:', userID);

  if (!userID) {
    return callback(null, {
      policyDocument: generatePolicy('Deny', event.routeArn),
      principalId: 'Not authorized',
    });
  }

  return callback(null, {
    policyDocument: generatePolicy('Allow', event.routeArn),
    principalId: userID,
    context: {
      userID: userID,
    },
  });
};

const generatePolicy = (effect: string, resource: string): PolicyDocument => {
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

  return policyDocument;
};

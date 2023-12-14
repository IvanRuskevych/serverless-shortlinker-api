// import {
//   APIGatewayAuthorizerResult,
//   APIGatewayRequestAuthorizerEvent,
//   APIGatewayTokenAuthorizerEvent,
//   Callback,
//   PolicyDocument,
// } from "aws-lambda";
// import { verifyToken } from "../services";

// export const userAuthorizer = async (
//   event: APIGatewayTokenAuthorizerEvent,
//   context: any,
//   callback: Callback<APIGatewayAuthorizerResult>
// ): Promise<void> => {
//   console.log("event", event);

//   const accessToken = event.authorizationToken.split(" ")[1];
//   const methodArn = event.methodArn;

//   console.log(" ~ accessToken:", accessToken);

//   if (!accessToken || !methodArn) {
//     return callback("Not authorized");
//   }

//   const { userID } = verifyToken(accessToken);
//   console.log(" ~ userID:", userID);

//   if (!userID) {
//     return callback(null, createPolicyDocument("Not authorized", "Deny", methodArn));
//   }

//   return callback(null, createPolicyDocument(userID, "Allow", methodArn));
// };

// const generatePolicy = async (
//   principalId: string,
//   effect: string,
//   resource: string
// ): Promise<APIGatewayAuthorizerResult> => {
//   const policyDocument = {} as PolicyDocument;
//   if (effect) {
//     policyDocument.Version = "2012-10-17";
//     policyDocument.Statement = [];
//     const statementOne: any = {};
//     statementOne.Action = "execute-api:Invoke";
//     statementOne.Effect = effect;
//     statementOne.Resource = resource;
//     policyDocument.Statement[0] = statementOne;
//   }

//   return {
//     principalId: principalId,
//     policyDocument: policyDocument,
//   };
// };

// const createPolicyDocument = (
//   principalId: string,
//   effect: "Allow" | "Deny",
//   methodArn: string
// ): APIGatewayAuthorizerResult => {
//   const policyDocument: PolicyDocument = {
//     Version: "2012-10-17",
//     Statement: [
//       {
//         Action: "execute-api:Invoke",
//         Effect: effect,
//         Resource: methodArn,
//       },
//     ],
//   };

//   return {
//     principalId,
//     policyDocument,
//   };
// };

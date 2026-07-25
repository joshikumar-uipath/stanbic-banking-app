import { Amplify } from "aws-amplify";

/**
 * Configure Amplify Auth with a Cognito Identity Pool that allows guest
 * (unauthenticated) access. The FaceLivenessDetector component uses these
 * temporary credentials to stream video to Rekognition.
 *
 * The identity pool's guest IAM role must allow rekognition:StartFaceLivenessSession.
 */
const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

export const awsRegion = import.meta.env.VITE_AWS_REGION ?? "us-east-1";

export function configureAmplify() {
  if (!identityPoolId) {
    console.warn(
      "VITE_COGNITO_IDENTITY_POOL_ID is not set — the liveness check will fail to " +
        "get AWS credentials. Copy frontend/.env.example to frontend/.env."
    );
    return;
  }
  Amplify.configure({
    Auth: {
      Cognito: {
        identityPoolId,
        allowGuestAccess: true,
      },
    },
  });
}

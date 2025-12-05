import { SNSClient } from "@aws-sdk/client-sns";
import { SESClient } from "@aws-sdk/client-ses";

const snsRegion = process.env.AWS_REGION_SNS ?? "us-east-1";
const sesRegion = process.env.AWS_REGION_SES ?? "ap-northeast-2";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

export const snsClient = new SNSClient({ region: snsRegion, credentials });
export const sesClient = new SESClient({ region: sesRegion, credentials });

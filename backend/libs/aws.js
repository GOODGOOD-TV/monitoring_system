// backend/libs/aws.js
import { SNSClient } from "@aws-sdk/client-sns";
import { SESClient } from "@aws-sdk/client-ses";

const region = process.env.AWS_REGION ?? "ap-northeast-2";

export const snsClient = new SNSClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const sesClient = new SESClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

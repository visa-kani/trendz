/**
 * Bootstraps the object storage bucket:
 *  - creates the bucket if it does not exist (MinIO locally; on R2 create it in the dashboard)
 *  - makes only the public/ prefix anonymously readable (MinIO; on R2 use a custom domain)
 *  - allows browser PUT uploads from the web origin (CORS)
 * Safe to run repeatedly.
 */
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { env } from "../src/config/env";
import { storage } from "../src/integrations/r2/storage";

async function main() {
  const { client, bucket } = storage().raw;

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✔ bucket ${bucket} exists`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`✔ bucket ${bucket} created`);
  }

  const policy = {
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Principal: { AWS: ["*"] }, Action: ["s3:GetObject"], Resource: [`arn:aws:s3:::${bucket}/public/*`] }],
  };
  try {
    await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }));
    console.log("✔ public/ prefix is publicly readable");
  } catch (err) {
    console.warn(`! could not set bucket policy (${(err as Error).name}). On R2, expose the bucket through a custom domain instead.`);
  }

  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [{ AllowedOrigins: [env.WEB_URL], AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], MaxAgeSeconds: 3600 }],
        },
      }),
    );
    console.log(`✔ CORS allows uploads from ${env.WEB_URL}`);
  } catch (err) {
    console.warn(`! bucket CORS not set (${(err as Error).name}); MinIO allows all origins by default.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Cloudflare R2 client.
 * Falls back gracefully when env vars are missing — all methods return null/false.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

export const r2Enabled = !!(
  R2_ACCOUNT_ID &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY &&
  R2_BUCKET_NAME
);

let client: S3Client | null = null;

if (r2Enabled) {
  client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Upload a Buffer to R2.
 * Returns the stored object key on success, null if R2 is disabled.
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string | null> {
  if (!client || !R2_BUCKET_NAME) return null;
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

/**
 * Returns a pre-signed GET URL (1 hour TTL), or the public URL if R2_PUBLIC_URL
 * is set (for buckets with public access enabled).
 */
export async function getR2Url(key: string): Promise<string | null> {
  if (!client || !R2_BUCKET_NAME) return null;

  if (R2_PUBLIC_URL) {
    const base = R2_PUBLIC_URL.replace(/\/$/, "");
    return `${base}/${key}`;
  }

  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/**
 * Delete an object from R2 by key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!client || !R2_BUCKET_NAME) return;
  await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

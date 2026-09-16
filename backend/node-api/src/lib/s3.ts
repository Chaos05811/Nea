import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "./logger";

/**
 * Optional voice-recording archival. Entirely feature-flagged: if AWS_S3_BUCKET isn't set
 * (no AWS account yet), uploadAudio() is a no-op that resolves to null — the STT flow in
 * routes/voice.ts works exactly the same either way, this just adds an audit trail when
 * AWS credentials exist.
 */

let client: S3Client | null = null;

function getClient(): S3Client | null {
  if (!process.env.AWS_S3_BUCKET) return null;
  if (!client) {
    client = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
  }
  return client;
}

export async function uploadAudio(
  userId: string,
  sessionId: string,
  buffer: Buffer,
  contentType: string,
  extension: string
): Promise<string | null> {
  const s3 = getClient();
  if (!s3) return null;

  const key = `voice-recordings/${userId}/${sessionId}/${Date.now()}.${extension}`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      })
    );
    logger.info("S3 audio archived", { key });
    return `s3://${process.env.AWS_S3_BUCKET}/${key}`;
  } catch (err) {
    // Archival is best-effort — never block the STT response on a storage hiccup.
    logger.error("S3 audio upload failed (non-fatal)", {
      message: (err as Error).message,
      key,
    });
    return null;
  }
}

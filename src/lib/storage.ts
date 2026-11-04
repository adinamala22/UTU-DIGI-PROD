import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";

/**
 * Private product files -> S3_BUCKET (Cloudflare R2, private).
 * Public images        -> S3_PUBLIC_BUCKET served from S3_PUBLIC_URL.
 * When S3 is not configured, falls back to ./storage (private) and ./public/uploads (public).
 */

const s3Configured = () =>
  !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  return client;
}

const PRIVATE_DIR = path.join(process.cwd(), "storage");
const PUBLIC_DIR = path.join(process.cwd(), "public", "uploads");

function safeName(name: string) {
  const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const base = path.basename(name, path.extname(name)).replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${base}${ext}`;
}

export async function uploadPrivate(file: File) {
  const key = `products/${safeName(file.name)}`;
  const body = Buffer.from(await file.arrayBuffer());
  if (s3Configured()) {
    await s3().send(
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: file.type || "application/octet-stream" }),
    );
  } else {
    await fs.mkdir(path.join(PRIVATE_DIR, "products"), { recursive: true });
    await fs.writeFile(path.join(PRIVATE_DIR, key), body);
  }
  return { key, fileName: file.name };
}

export async function uploadPublic(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be uploaded here");
  const name = safeName(file.name);
  const body = Buffer.from(await file.arrayBuffer());
  const bucket = process.env.S3_PUBLIC_BUCKET;
  if (s3Configured() && bucket && process.env.S3_PUBLIC_URL) {
    await s3().send(new PutObjectCommand({ Bucket: bucket, Key: `img/${name}`, Body: body, ContentType: file.type }));
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/img/${name}`;
  }
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.writeFile(path.join(PUBLIC_DIR, name), body);
  return `/uploads/${name}`;
}

/** Returns a Response that delivers the private file (redirect to 60s presigned URL, or local stream). */
export async function deliverFile(key: string, fileName: string): Promise<Response> {
  if (s3Configured()) {
    const url = await getSignedUrl(
      s3(),
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
      }),
      { expiresIn: 60 },
    );
    return Response.redirect(url, 302);
  }
  const full = path.join(PRIVATE_DIR, key);
  if (!full.startsWith(PRIVATE_DIR)) return new Response("Not found", { status: 404 });
  const stat = await fs.stat(full).catch(() => null);
  if (!stat) return new Response("File missing. Contact support.", { status: 404 });
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

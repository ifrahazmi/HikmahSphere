import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveUploadFilesystemPath } from '../utils/uploads';

export type StorageVisibility = 'public' | 'private';

export type StoredObjectRef = {
  visibility: StorageVisibility;
  key: string;
};

let client: S3Client | null = null;

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Configure Cloudflare R2 before uploading files.`);
  }
  return value;
};

const getClient = (): S3Client => {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: requiredEnv('R2_ENDPOINT'),
      credentials: {
        accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: true,
    });
  }
  return client;
};

const getBucket = (visibility: StorageVisibility): string =>
  requiredEnv(visibility === 'public' ? 'R2_PUBLIC_BUCKET' : 'R2_PRIVATE_BUCKET');

const normalizePublicBaseUrl = (): string =>
  requiredEnv('R2_PUBLIC_URL').replace(/\/+$/, '');

export const isR2Configured = (): boolean =>
  Boolean(
    process.env.R2_ENDPOINT?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_PUBLIC_BUCKET?.trim() &&
      process.env.R2_PRIVATE_BUCKET?.trim() &&
      process.env.R2_PUBLIC_URL?.trim()
  );

export const logObjectStorageStatus = (): void => {
  if (isR2Configured()) {
    console.log('✅ Cloudflare R2 object storage is configured');
  } else {
    console.warn('⚠️  Cloudflare R2 is not fully configured. Persistent uploads will fail.');
  }
};

export const createObjectKey = (prefix: string, originalName: string): string => {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const extension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${cleanPrefix}/${Date.now()}-${randomUUID()}${extension}`;
};

export const toPrivateStorageRef = (key: string): string => `r2://private/${key}`;

export const toPublicUrl = (key: string): string =>
  `${normalizePublicBaseUrl()}/${key.split('/').map(encodeURIComponent).join('/')}`;

export const parseStoredObjectRef = (value: string): StoredObjectRef | null => {
  if (!value) return null;

  const privatePrefix = 'r2://private/';
  if (value.startsWith(privatePrefix)) {
    return { visibility: 'private', key: value.slice(privatePrefix.length) };
  }

  const publicPrefix = 'r2://public/';
  if (value.startsWith(publicPrefix)) {
    return { visibility: 'public', key: value.slice(publicPrefix.length) };
  }

  const publicBase = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, '');
  if (publicBase && value.startsWith(`${publicBase}/`)) {
    const encodedKey = value.slice(publicBase.length + 1);
    return {
      visibility: 'public',
      key: encodedKey.split('/').map(decodeURIComponent).join('/'),
    };
  }

  return null;
};

export const uploadObject = async ({
  visibility,
  key,
  body,
  contentType,
  originalName,
}: {
  visibility: StorageVisibility;
  key: string;
  body: Buffer;
  contentType: string;
  originalName?: string;
}): Promise<string> => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(visibility),
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: originalName ? { originalName: originalName.slice(0, 240) } : undefined,
    })
  );

  return visibility === 'public' ? toPublicUrl(key) : toPrivateStorageRef(key);
};

export const deleteStoredObject = async (storedValue?: string | null): Promise<void> => {
  if (!storedValue) return;
  const ref = parseStoredObjectRef(storedValue);

  if (ref) {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: getBucket(ref.visibility),
        Key: ref.key,
      })
    );
    return;
  }

  if (storedValue.startsWith('/uploads/') || storedValue.startsWith('/src/uploads/')) {
    try {
      const diskPath = resolveUploadFilesystemPath(storedValue);
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    } catch (error) {
      console.warn('Failed to remove legacy upload:', (error as Error).message);
    }
  }
};

export const getPrivateObjectUrl = async (
  storedValue: string,
  options?: { fileName?: string; contentType?: string; expiresIn?: number }
): Promise<string | null> => {
  const ref = parseStoredObjectRef(storedValue);
  if (!ref) return null;
  if (ref.visibility === 'public') return toPublicUrl(ref.key);

  const safeName = options?.fileName?.replace(/[\r\n"]/g, '').slice(0, 240);
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: getBucket('private'),
      Key: ref.key,
      ResponseContentType: options?.contentType,
      ResponseContentDisposition: safeName ? `inline; filename="${safeName}"` : 'inline',
    }),
    { expiresIn: options?.expiresIn ?? 300 }
  );
};

export const assertObjectExists = async (
  visibility: StorageVisibility,
  key: string
): Promise<void> => {
  await getClient().send(
    new HeadObjectCommand({
      Bucket: getBucket(visibility),
      Key: key,
    })
  );
};

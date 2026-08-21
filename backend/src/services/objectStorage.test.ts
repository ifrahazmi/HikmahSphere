import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSend = jest.fn<(command: unknown) => Promise<object>>().mockResolvedValue({});

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual<typeof import('@aws-sdk/client-s3')>('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn<() => Promise<string>>()
    .mockResolvedValue('https://signed.example/private-file'),
}));

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  createObjectKey,
  deleteStoredObject,
  getPrivateObjectUrl,
  parseStoredObjectRef,
  uploadObject,
} from './objectStorage';

describe('objectStorage', () => {
  beforeAll(() => {
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_PUBLIC_BUCKET = 'public-bucket';
    process.env.R2_PRIVATE_BUCKET = 'private-bucket';
    process.env.R2_PUBLIC_URL = 'https://pub.example';
  });

  beforeEach(() => {
    mockSend.mockClear();
  });

  it('creates safe keys and parses private references', () => {
    const key = createObjectKey('/maktab/weekly/', 'Photo Final.WEBP');
    expect(key).toMatch(/^maktab\/weekly\/\d+-[0-9a-f-]+\.webp$/);
    expect(parseStoredObjectRef(`r2://private/${key}`)).toEqual({
      visibility: 'private',
      key,
    });
  });

  it('uploads public objects and returns their public URL', async () => {
    const result = await uploadObject({
      visibility: 'public',
      key: 'community/photo.jpg',
      body: Buffer.from('image'),
      contentType: 'image/jpeg',
      originalName: 'photo.jpg',
    });

    expect(result).toBe('https://pub.example/community/photo.jpg');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
  });

  it('deletes private objects by stored reference', async () => {
    await deleteStoredObject('r2://private/zakat/receipt.pdf');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('creates a short-lived private URL', async () => {
    await expect(
      getPrivateObjectUrl('r2://private/maktab/photo.jpg', {
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
      })
    ).resolves.toBe('https://signed.example/private-file');
  });
});

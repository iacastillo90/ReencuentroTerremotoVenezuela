// Mock AWS SDK v3 antes de importar el servicio
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ ContentType: 'image/jpeg' }),
  })),
  HeadBucketCommand: jest.fn(),
  CreateBucketCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  BucketAlreadyExists: class BucketAlreadyExists extends Error {},
  BucketAlreadyOwnedByYou: class BucketAlreadyOwnedByYou extends Error {},
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-endpoint/bucket/file.jpg?X-Amz-Algorithm=...'),
}));

import { getPresignedUrl, getPresignedUploadUrl } from '../../services/storage.service';

describe('storage.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup getSignedUrl mock para cada test
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    (getSignedUrl as jest.Mock).mockResolvedValue('https://mock-endpoint/bucket/file.jpg?X-Amz-Algorithm=...');
  });

  describe('getPresignedUrl', () => {
    it('should return a presigned URL starting with https', async () => {
      const url = await getPresignedUrl('test-file.jpg');
      expect(url).toMatch(/^https?:\/\//);
      expect(typeof url).toBe('string');
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should return a presigned upload URL as a string', async () => {
      const url = await getPresignedUploadUrl('test-upload.jpg');
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      expect(url).toMatch(/^https?:\/\//);
    });
  });
});

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    presignedGetObject: jest.fn().mockResolvedValue('http://minio-server/test/bucket/file.jpg?X-Amz-Algorithm=...'),
    presignedPutObject: jest.fn().mockResolvedValue('http://minio-server/test/bucket/upload.jpg?X-Amz-Algorithm=...'),
    bucketExists: jest.fn().mockResolvedValue(true),
    putObject: jest.fn().mockResolvedValue(undefined),
    makeBucket: jest.fn().mockResolvedValue(undefined),
  }))
}));

import { getPresignedUrl, getPresignedUploadUrl } from '../../services/storage.service';

describe('storage.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPresignedUrl', () => {
    it('should return a presigned URL starting with http', async () => {
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

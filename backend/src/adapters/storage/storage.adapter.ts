export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';

export interface IStorageAdapter {
  uploadObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void>;
  getSignedUrl(
    bucket: string,
    key: string,
    expiresSeconds: number,
  ): Promise<string>;
  deleteObject(bucket: string, key: string): Promise<void>;
}

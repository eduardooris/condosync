import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Env } from '../../config/env.schema';
import { IStorageAdapter } from './storage.adapter';

/**
 * Adapter S3-compatible (AWS S3, MinIO, Cloudflare R2, etc.).
 *
 * - `S3_ENDPOINT` opcional: quando definido, usa MinIO/R2/etc.
 * - `S3_FORCE_PATH_STYLE`: necessário para MinIO (`bucket.endpoint/key` não
 *   funciona na rede docker; usa `endpoint/bucket/key`).
 * - `S3_PUBLIC_ENDPOINT`: opcional, usado apenas para gerar URLs assinadas
 *   acessíveis fora da rede docker (ex.: backend fala com `minio:9000`,
 *   browser baixa de `http://localhost:9000`).
 */
@Injectable()
export class S3StorageAdapter implements IStorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly client: S3Client;
  private readonly publicClient: S3Client;

  constructor(private readonly config: ConfigService<Env, true>) {
    const region = this.config.get('S3_REGION', { infer: true });
    const endpoint = this.config.get('S3_ENDPOINT', { infer: true });
    const accessKeyId = this.config.get('S3_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = this.config.get('S3_SECRET_ACCESS_KEY', {
      infer: true,
    });
    const forcePathStyle = this.config.get('S3_FORCE_PATH_STYLE', {
      infer: true,
    });
    const publicEndpoint = this.config.get('S3_PUBLIC_ENDPOINT', {
      infer: true,
    });

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });

    this.publicClient = publicEndpoint
      ? new S3Client({
          region,
          endpoint: publicEndpoint,
          forcePathStyle,
          credentials:
            accessKeyId && secretAccessKey
              ? { accessKeyId, secretAccessKey }
              : undefined,
        })
      : this.client;
  }

  async uploadObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Falha ao subir ${bucket}/${key}: ${(err as Error).message}`,
      );
      throw new Error(`S3 uploadObject failed: ${(err as Error).message}`);
    }
  }

  async getSignedUrl(
    bucket: string,
    key: string,
    expiresSeconds: number,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return await getSignedUrl(this.publicClient, command, {
        expiresIn: expiresSeconds,
      });
    } catch (err) {
      this.logger.error(
        `Falha ao gerar URL assinada para ${bucket}/${key}: ${(err as Error).message}`,
      );
      throw new Error(`S3 getSignedUrl failed: ${(err as Error).message}`);
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch (err) {
      this.logger.error(
        `Falha ao remover ${bucket}/${key}: ${(err as Error).message}`,
      );
      throw new Error(`S3 deleteObject failed: ${(err as Error).message}`);
    }
  }
}

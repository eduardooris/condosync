import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3StorageAdapter } from './storage/s3-storage.adapter';
import { STORAGE_ADAPTER } from './storage/storage.adapter';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [{ provide: STORAGE_ADAPTER, useClass: S3StorageAdapter }],
  exports: [STORAGE_ADAPTER],
})
export class StorageAdapterModule {}

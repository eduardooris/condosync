import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../../database/entities/document.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { Resident } from '../../database/entities/resident.entity';
import { StorageAdapterModule } from '../../adapters/adapters.module';
import {
  CondominiumDocumentsController,
  DocumentUrlController,
} from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, UserCondominium, Resident]),
    StorageAdapterModule,
  ],
  controllers: [CondominiumDocumentsController, DocumentUrlController],
  providers: [DocumentsRepository, DocumentsService],
})
export class DocumentsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulletinPost } from '../../database/entities/bulletin-post.entity';
import { Resident } from '../../database/entities/resident.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { BulletinController } from './bulletin.controller';
import { BulletinService } from './bulletin.service';
import { BulletinRepository } from './bulletin.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulletinPost, Resident, UserCondominium]),
  ],
  controllers: [BulletinController],
  providers: [BulletinRepository, BulletinService],
})
export class BulletinModule {}

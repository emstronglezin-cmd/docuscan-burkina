import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentExportLog } from './entities/document-log.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentExportLog]), CreditsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}

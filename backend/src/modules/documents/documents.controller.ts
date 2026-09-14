import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { CreateDocumentLogDto } from './dto/create-document-log.dto';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Appelé par le client APRÈS génération locale réussie du PDF, pour
   * débiter le crédit correspondant. Le PDF lui-même n'est jamais envoyé.
   */
  @Post('export')
  async export(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateDocumentLogDto) {
    return this.documentsService.recordExportAndDebit(user.userId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const documents = await this.documentsService.listForUser(
      user.userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    return { documents };
  }
}

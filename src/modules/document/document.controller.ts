import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DocumentService } from './document.service';

@ApiTags('documents')
@Controller({ path: 'documents', version: '1' })
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}
}

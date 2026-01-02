import { Controller } from '@nestjs/common';
import { DocumentService } from './document.service';

@Controller({ path: 'documents', version: '1' })
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}
}

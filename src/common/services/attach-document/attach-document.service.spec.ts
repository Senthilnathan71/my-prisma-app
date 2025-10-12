import { Test, TestingModule } from '@nestjs/testing';
import { AttachDocumentService } from './attach-document.service';

describe('AttachDocumentService', () => {
  let service: AttachDocumentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttachDocumentService],
    }).compile();

    service = module.get<AttachDocumentService>(AttachDocumentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AttachDocumentController } from './attach-document.controller';

describe('AttachDocumentController', () => {
  let controller: AttachDocumentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachDocumentController],
    }).compile();

    controller = module.get<AttachDocumentController>(AttachDocumentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

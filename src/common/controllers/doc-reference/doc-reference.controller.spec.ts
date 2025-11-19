import { Test, TestingModule } from '@nestjs/testing';
import { DocReferenceController } from './doc-reference.controller';
import { DocReferenceService } from 'src/common/services/doc-reference/doc-reference.service';
import { Logger } from '@nestjs/common';

describe('DocReferenceController', () => {
  let controller: DocReferenceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocReferenceController],
      providers: [
        {
          provide: DocReferenceService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            error: jest.fn(),
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DocReferenceController>(DocReferenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

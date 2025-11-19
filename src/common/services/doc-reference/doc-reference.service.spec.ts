import { Test, TestingModule } from '@nestjs/testing';
import { DocReferenceService } from './doc-reference.service';
import { DatabaseService } from 'src/database/database.service';
import { Logger } from '@nestjs/common';

describe('DocReferenceService', () => {
  let service: DocReferenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocReferenceService,
        {
          provide: DatabaseService,
          useValue: {
            refDocument: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
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

    service = module.get<DocReferenceService>(DocReferenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

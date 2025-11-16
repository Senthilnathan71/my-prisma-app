import { Test, TestingModule } from '@nestjs/testing';
import { VendorCreditNoteService } from './vendor-credit-note.service';

describe('VendorCreditNoteService', () => {
  let service: VendorCreditNoteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorCreditNoteService],
    }).compile();

    service = module.get<VendorCreditNoteService>(VendorCreditNoteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

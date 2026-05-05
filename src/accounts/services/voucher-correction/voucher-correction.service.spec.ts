import { Test, TestingModule } from '@nestjs/testing';
import { VoucherCorrectionService } from './voucher-correction.service';

describe('VoucherCorrectionService', () => {
  let service: VoucherCorrectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VoucherCorrectionService],
    }).compile();

    service = module.get<VoucherCorrectionService>(VoucherCorrectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

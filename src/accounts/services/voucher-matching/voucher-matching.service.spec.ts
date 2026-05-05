import { Test, TestingModule } from '@nestjs/testing';
import { VoucherMatchingService } from './voucher-matching.service';

describe('VoucherMatchingService', () => {
  let service: VoucherMatchingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VoucherMatchingService],
    }).compile();

    service = module.get<VoucherMatchingService>(VoucherMatchingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

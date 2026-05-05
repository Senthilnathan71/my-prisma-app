import { Test, TestingModule } from '@nestjs/testing';
import { ReverseVoucherService } from './reverse-voucher.service';

describe('ReverseVoucherService', () => {
  let service: ReverseVoucherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReverseVoucherService],
    }).compile();

    service = module.get<ReverseVoucherService>(ReverseVoucherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { VoucherMatchingController } from './voucher-matching.controller';

describe('VoucherMatchingController', () => {
  let controller: VoucherMatchingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoucherMatchingController],
    }).compile();

    controller = module.get<VoucherMatchingController>(VoucherMatchingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

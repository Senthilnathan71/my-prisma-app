import { Test, TestingModule } from '@nestjs/testing';
import { VoucherCorrectionController } from './voucher-correction.controller';

describe('VoucherCorrectionController', () => {
  let controller: VoucherCorrectionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoucherCorrectionController],
    }).compile();

    controller = module.get<VoucherCorrectionController>(VoucherCorrectionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

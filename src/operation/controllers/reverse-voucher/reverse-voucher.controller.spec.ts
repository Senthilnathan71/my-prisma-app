import { Test, TestingModule } from '@nestjs/testing';
import { ReverseVoucherController } from './reverse-voucher.controller';

describe('ReverseVoucherController', () => {
  let controller: ReverseVoucherController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReverseVoucherController],
    }).compile();

    controller = module.get<ReverseVoucherController>(ReverseVoucherController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

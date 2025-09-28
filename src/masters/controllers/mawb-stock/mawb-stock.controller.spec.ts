import { Test, TestingModule } from '@nestjs/testing';
import { MawbStockController } from './mawb-stock.controller';

describe('MawbStockController', () => {
  let controller: MawbStockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MawbStockController],
    }).compile();

    controller = module.get<MawbStockController>(MawbStockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

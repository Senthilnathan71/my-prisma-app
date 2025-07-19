import { Test, TestingModule } from '@nestjs/testing';
import { HawbStockController } from './hawb-stock.controller';

describe('HawbStockController', () => {
  let controller: HawbStockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HawbStockController],
    }).compile();

    controller = module.get<HawbStockController>(HawbStockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

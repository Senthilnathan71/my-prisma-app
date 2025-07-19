import { Test, TestingModule } from '@nestjs/testing';
import { HawbStockService } from './hawb-stock.service';

describe('HawbStockService', () => {
  let service: HawbStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HawbStockService],
    }).compile();

    service = module.get<HawbStockService>(HawbStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

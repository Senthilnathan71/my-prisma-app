import { Test, TestingModule } from '@nestjs/testing';
import { MawbStockService } from './mawb-stock.service';

describe('MawbStockService', () => {
  let service: MawbStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MawbStockService],
    }).compile();

    service = module.get<MawbStockService>(MawbStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

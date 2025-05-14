import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyExchangeService } from './currency-exchange.service';

describe('CurrencyExchangeService', () => {
  let service: CurrencyExchangeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrencyExchangeService],
    }).compile();

    service = module.get<CurrencyExchangeService>(CurrencyExchangeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

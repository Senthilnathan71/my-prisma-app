import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyExchangeController } from './currency-exchange.controller';

describe('CurrencyExchangeController', () => {
  let controller: CurrencyExchangeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrencyExchangeController],
    }).compile();

    controller = module.get<CurrencyExchangeController>(CurrencyExchangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { TariffDetailController } from './tariff-detail.controller';

describe('TariffDetailController', () => {
  let controller: TariffDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TariffDetailController],
    }).compile();

    controller = module.get<TariffDetailController>(TariffDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

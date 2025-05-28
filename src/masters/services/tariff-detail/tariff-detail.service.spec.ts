import { Test, TestingModule } from '@nestjs/testing';
import { TariffDetailService } from './tariff-detail.service';

describe('TariffDetailService', () => {
  let service: TariffDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TariffDetailService],
    }).compile();

    service = module.get<TariffDetailService>(TariffDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

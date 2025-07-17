import { Test, TestingModule } from '@nestjs/testing';
import { TdsExemptionService } from './tds-exemption.service';

describe('TdsExemptionService', () => {
  let service: TdsExemptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TdsExemptionService],
    }).compile();

    service = module.get<TdsExemptionService>(TdsExemptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

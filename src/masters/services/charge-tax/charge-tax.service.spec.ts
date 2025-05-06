import { Test, TestingModule } from '@nestjs/testing';
import { ChargeTaxService } from './charge-tax.service';

describe('ChargeTaxService', () => {
  let service: ChargeTaxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChargeTaxService],
    }).compile();

    service = module.get<ChargeTaxService>(ChargeTaxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

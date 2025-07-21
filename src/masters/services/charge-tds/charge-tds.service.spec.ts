import { Test, TestingModule } from '@nestjs/testing';
import { ChargeTdsService } from './charge-tds.service';

describe('ChargeTdsService', () => {
  let service: ChargeTdsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChargeTdsService],
    }).compile();

    service = module.get<ChargeTdsService>(ChargeTdsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

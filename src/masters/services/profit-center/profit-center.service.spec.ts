import { Test, TestingModule } from '@nestjs/testing';
import { ProfitCenterService } from './profit-center.service';

describe('ProfitCenterService', () => {
  let service: ProfitCenterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfitCenterService],
    }).compile();

    service = module.get<ProfitCenterService>(ProfitCenterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

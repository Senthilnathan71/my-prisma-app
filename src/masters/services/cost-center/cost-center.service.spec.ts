import { Test, TestingModule } from '@nestjs/testing';
import { CostCenterService } from './cost-center.service';

describe('CostCenterService', () => {
  let service: CostCenterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CostCenterService],
    }).compile();

    service = module.get<CostCenterService>(CostCenterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

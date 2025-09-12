import { Test, TestingModule } from '@nestjs/testing';
import { LoadingPlanService } from './loading-plan.service';

describe('LoadingPlanService', () => {
  let service: LoadingPlanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoadingPlanService],
    }).compile();

    service = module.get<LoadingPlanService>(LoadingPlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

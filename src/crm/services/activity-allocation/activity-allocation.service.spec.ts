import { Test, TestingModule } from '@nestjs/testing';
import { ActivityAllocationService } from './activity-allocation.service';

describe('ActivityAllocationService', () => {
  let service: ActivityAllocationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityAllocationService],
    }).compile();

    service = module.get<ActivityAllocationService>(ActivityAllocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

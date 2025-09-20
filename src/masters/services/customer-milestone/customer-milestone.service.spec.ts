import { Test, TestingModule } from '@nestjs/testing';
import { CustomerMilestoneService } from './customer-milestone.service';

describe('CustomerMilestoneService', () => {
  let service: CustomerMilestoneService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerMilestoneService],
    }).compile();

    service = module.get<CustomerMilestoneService>(CustomerMilestoneService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

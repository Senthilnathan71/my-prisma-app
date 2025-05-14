import { Test, TestingModule } from '@nestjs/testing';
import { CustomerBranchService } from './customer-branch.service';

describe('CustomerBranchService', () => {
  let service: CustomerBranchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerBranchService],
    }).compile();

    service = module.get<CustomerBranchService>(CustomerBranchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

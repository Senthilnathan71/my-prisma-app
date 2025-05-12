import { Test, TestingModule } from '@nestjs/testing';
import { CustomerBranchEmailService } from './customer-branch-email.service';

describe('CustomerBranchEmailService', () => {
  let service: CustomerBranchEmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerBranchEmailService],
    }).compile();

    service = module.get<CustomerBranchEmailService>(CustomerBranchEmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

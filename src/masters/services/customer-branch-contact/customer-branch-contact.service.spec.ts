import { Test, TestingModule } from '@nestjs/testing';
import { CustomerBranchContactService } from './customer-branch-contact.service';

describe('CustomerBranchContactService', () => {
  let service: CustomerBranchContactService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerBranchContactService],
    }).compile();

    service = module.get<CustomerBranchContactService>(CustomerBranchContactService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

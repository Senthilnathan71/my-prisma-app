import { Test, TestingModule } from '@nestjs/testing';
import { BranchBankService } from './branch-bank.service';

describe('BranchBankService', () => {
  let service: BranchBankService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BranchBankService],
    }).compile();

    service = module.get<BranchBankService>(BranchBankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

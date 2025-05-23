import { Test, TestingModule } from '@nestjs/testing';
import { BranchBankController } from './branch-bank.controller';

describe('BranchBankController', () => {
  let controller: BranchBankController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchBankController],
    }).compile();

    controller = module.get<BranchBankController>(BranchBankController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

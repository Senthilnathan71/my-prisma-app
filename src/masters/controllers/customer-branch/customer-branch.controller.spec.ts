import { Test, TestingModule } from '@nestjs/testing';
import { CustomerBranchController } from './customer-branch.controller';

describe('CustomerBranchController', () => {
  let controller: CustomerBranchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBranchController],
    }).compile();

    controller = module.get<CustomerBranchController>(CustomerBranchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

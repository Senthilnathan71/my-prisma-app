import { Test, TestingModule } from '@nestjs/testing';
import { CustomerBranchEmailController } from './customer-branch-email.controller';

describe('CustomerBranchEmailController', () => {
  let controller: CustomerBranchEmailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBranchEmailController],
    }).compile();

    controller = module.get<CustomerBranchEmailController>(CustomerBranchEmailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

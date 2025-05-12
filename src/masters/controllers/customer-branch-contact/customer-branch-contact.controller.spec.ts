import { Test, TestingModule } from '@nestjs/testing';
import { CustomerBranchContactController } from './customer-branch-contact.controller';

describe('CustomerBranchContactController', () => {
  let controller: CustomerBranchContactController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBranchContactController],
    }).compile();

    controller = module.get<CustomerBranchContactController>(CustomerBranchContactController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

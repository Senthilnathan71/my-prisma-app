import { Test, TestingModule } from '@nestjs/testing';
import { CustomerMilestoneController } from './customer-milestone.controller';

describe('CustomerMilestoneController', () => {
  let controller: CustomerMilestoneController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerMilestoneController],
    }).compile();

    controller = module.get<CustomerMilestoneController>(CustomerMilestoneController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

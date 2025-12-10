import { Test, TestingModule } from '@nestjs/testing';
import { ActivityAllocationController } from './activity-allocation.controller';

describe('ActivityAllocationController', () => {
  let controller: ActivityAllocationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityAllocationController],
    }).compile();

    controller = module.get<ActivityAllocationController>(ActivityAllocationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

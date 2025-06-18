import { Test, TestingModule } from '@nestjs/testing';
import { MilestoneController } from './milestone.controller';

describe('MilestoneController', () => {
  let controller: MilestoneController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MilestoneController],
    }).compile();

    controller = module.get<MilestoneController>(MilestoneController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

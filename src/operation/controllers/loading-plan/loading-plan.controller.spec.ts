import { Test, TestingModule } from '@nestjs/testing';
import { LoadingPlanController } from './loading-plan.controller';

describe('LoadingPlanController', () => {
  let controller: LoadingPlanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoadingPlanController],
    }).compile();

    controller = module.get<LoadingPlanController>(LoadingPlanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

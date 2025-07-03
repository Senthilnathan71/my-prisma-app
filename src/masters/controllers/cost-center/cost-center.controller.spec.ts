import { Test, TestingModule } from '@nestjs/testing';
import { CostCenterController } from './cost-center.controller';

describe('CostCenterController', () => {
  let controller: CostCenterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CostCenterController],
    }).compile();

    controller = module.get<CostCenterController>(CostCenterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ProfitCenterController } from './profit-center.controller';

describe('ProfitCenterController', () => {
  let controller: ProfitCenterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfitCenterController],
    }).compile();

    controller = module.get<ProfitCenterController>(ProfitCenterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

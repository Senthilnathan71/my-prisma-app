import { Test, TestingModule } from '@nestjs/testing';
import { BlclauseController } from './blclause.controller';

describe('BlclauseController', () => {
  let controller: BlclauseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlclauseController],
    }).compile();

    controller = module.get<BlclauseController>(BlclauseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SubledgermasterController } from './subledgermaster.controller';

describe('SubledgermasterController', () => {
  let controller: SubledgermasterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubledgermasterController],
    }).compile();

    controller = module.get<SubledgermasterController>(SubledgermasterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

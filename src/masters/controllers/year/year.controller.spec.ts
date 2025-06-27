import { Test, TestingModule } from '@nestjs/testing';
import { YearController } from './year.controller';

describe('YearController', () => {
  let controller: YearController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [YearController],
    }).compile();

    controller = module.get<YearController>(YearController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

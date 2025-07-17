import { Test, TestingModule } from '@nestjs/testing';
import { TdsController } from './tds.controller';

describe('TdsController', () => {
  let controller: TdsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TdsController],
    }).compile();

    controller = module.get<TdsController>(TdsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

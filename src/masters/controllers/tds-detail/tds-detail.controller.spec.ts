import { Test, TestingModule } from '@nestjs/testing';
import { TdsDetailController } from './tds-detail.controller';

describe('TdsDetailController', () => {
  let controller: TdsDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TdsDetailController],
    }).compile();

    controller = module.get<TdsDetailController>(TdsDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CustomsController } from './customs.controller';

describe('CustomsController', () => {
  let controller: CustomsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomsController],
    }).compile();

    controller = module.get<CustomsController>(CustomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

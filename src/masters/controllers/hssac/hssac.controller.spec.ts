import { Test, TestingModule } from '@nestjs/testing';
import { HssacController } from './hssac.controller';

describe('HssacController', () => {
  let controller: HssacController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HssacController],
    }).compile();

    controller = module.get<HssacController>(HssacController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

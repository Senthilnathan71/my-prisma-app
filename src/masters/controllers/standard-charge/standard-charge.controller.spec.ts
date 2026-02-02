import { Test, TestingModule } from '@nestjs/testing';
import { StandardChargeController } from './standard-charge.controller';

describe('StandardChargeController', () => {
  let controller: StandardChargeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StandardChargeController],
    }).compile();

    controller = module.get<StandardChargeController>(StandardChargeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

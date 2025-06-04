import { Test, TestingModule } from '@nestjs/testing';
import { ChargeGroupController } from './charge-group.controller';

describe('ChargeGroupController', () => {
  let controller: ChargeGroupController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChargeGroupController],
    }).compile();

    controller = module.get<ChargeGroupController>(ChargeGroupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

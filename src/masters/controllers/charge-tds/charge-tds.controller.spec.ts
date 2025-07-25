import { Test, TestingModule } from '@nestjs/testing';
import { ChargeTdsController } from './charge-tds.controller';

describe('ChargeTdsController', () => {
  let controller: ChargeTdsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChargeTdsController],
    }).compile();

    controller = module.get<ChargeTdsController>(ChargeTdsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ChargeTaxController } from './charge-tax.controller';

describe('ChargeTaxController', () => {
  let controller: ChargeTaxController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChargeTaxController],
    }).compile();

    controller = module.get<ChargeTaxController>(ChargeTaxController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

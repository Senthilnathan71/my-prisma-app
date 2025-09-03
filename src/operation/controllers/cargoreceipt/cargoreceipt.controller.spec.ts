import { Test, TestingModule } from '@nestjs/testing';
import { CargoreceiptController } from './cargoreceipt.controller';

describe('CargoreceiptController', () => {
  let controller: CargoreceiptController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CargoreceiptController],
    }).compile();

    controller = module.get<CargoreceiptController>(CargoreceiptController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

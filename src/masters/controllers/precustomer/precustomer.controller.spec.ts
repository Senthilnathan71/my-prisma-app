import { Test, TestingModule } from '@nestjs/testing';
import { PrecustomerController } from '../../../crm/controllers/precustomer/precustomer.controller';

describe('PrecustomerController', () => {
  let controller: PrecustomerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrecustomerController],
    }).compile();

    controller = module.get<PrecustomerController>(PrecustomerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

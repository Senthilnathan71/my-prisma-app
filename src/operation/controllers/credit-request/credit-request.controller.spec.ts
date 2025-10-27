import { Test, TestingModule } from '@nestjs/testing';
import { CreditRequestController } from './credit-request.controller';

describe('CreditRequestController', () => {
  let controller: CreditRequestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreditRequestController],
    }).compile();

    controller = module.get<CreditRequestController>(CreditRequestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

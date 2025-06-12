import { Test, TestingModule } from '@nestjs/testing';
import { PreCustomerEventController } from './pre-customer-event.controller';

describe('PreCustomerEventController', () => {
  let controller: PreCustomerEventController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreCustomerEventController],
    }).compile();

    controller = module.get<PreCustomerEventController>(PreCustomerEventController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

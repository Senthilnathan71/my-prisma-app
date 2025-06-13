import { Test, TestingModule } from '@nestjs/testing';
import { PreCustomerEventService } from './pre-customer-event.service';

describe('PreCustomerEventService', () => {
  let service: PreCustomerEventService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PreCustomerEventService],
    }).compile();

    service = module.get<PreCustomerEventService>(PreCustomerEventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

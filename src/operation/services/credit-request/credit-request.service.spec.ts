import { Test, TestingModule } from '@nestjs/testing';
import { CreditRequestService } from './credit-request.service';

describe('CreditRequestService', () => {
  let service: CreditRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreditRequestService],
    }).compile();

    service = module.get<CreditRequestService>(CreditRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PrecustomerService } from '../../../crm/services/precustomer/precustomer.service';

describe('PrecustomerService', () => {
  let service: PrecustomerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrecustomerService],
    }).compile();

    service = module.get<PrecustomerService>(PrecustomerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

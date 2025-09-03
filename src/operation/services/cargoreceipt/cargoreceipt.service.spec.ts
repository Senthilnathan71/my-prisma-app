import { Test, TestingModule } from '@nestjs/testing';
import { CargoreceiptService } from './cargoreceipt.service';

describe('CargoreceiptService', () => {
  let service: CargoreceiptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CargoreceiptService],
    }).compile();

    service = module.get<CargoreceiptService>(CargoreceiptService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

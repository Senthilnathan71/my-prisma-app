import { Test, TestingModule } from '@nestjs/testing';
import { SupplierTdsMappingService } from './supplier-tds-mapping.service';

describe('SupplierTdsMappingService', () => {
  let service: SupplierTdsMappingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupplierTdsMappingService],
    }).compile();

    service = module.get<SupplierTdsMappingService>(SupplierTdsMappingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

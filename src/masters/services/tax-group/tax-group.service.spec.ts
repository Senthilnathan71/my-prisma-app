import { Test, TestingModule } from '@nestjs/testing';
import { TaxGroupService } from './tax-group.service';

describe('TaxGroupService', () => {
  let service: TaxGroupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxGroupService],
    }).compile();

    service = module.get<TaxGroupService>(TaxGroupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

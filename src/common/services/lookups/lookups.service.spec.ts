import { Test, TestingModule } from '@nestjs/testing';
import { LookupsService } from './lookups.service';

describe('LookupsService', () => {
  let service: LookupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LookupsService],
    }).compile();

    service = module.get<LookupsService>(LookupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

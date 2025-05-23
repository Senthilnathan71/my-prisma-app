import { Test, TestingModule } from '@nestjs/testing';
import { HssacService } from './hssac.service';

describe('HssacService', () => {
  let service: HssacService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HssacService],
    }).compile();

    service = module.get<HssacService>(HssacService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

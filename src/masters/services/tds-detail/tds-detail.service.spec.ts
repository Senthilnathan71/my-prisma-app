import { Test, TestingModule } from '@nestjs/testing';
import { TdsDetailService } from './tds-detail.service';

describe('TdsDetailService', () => {
  let service: TdsDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TdsDetailService],
    }).compile();

    service = module.get<TdsDetailService>(TdsDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

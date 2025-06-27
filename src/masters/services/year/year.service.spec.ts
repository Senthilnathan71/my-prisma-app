import { Test, TestingModule } from '@nestjs/testing';
import { YearService } from './year.service';

describe('YearService', () => {
  let service: YearService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YearService],
    }).compile();

    service = module.get<YearService>(YearService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { TdsService } from './tds.service';

describe('TdsService', () => {
  let service: TdsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TdsService],
    }).compile();

    service = module.get<TdsService>(TdsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

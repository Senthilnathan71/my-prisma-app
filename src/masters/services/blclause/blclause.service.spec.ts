import { Test, TestingModule } from '@nestjs/testing';
import { BlclauseService } from './blclause.service';

describe('BlclauseService', () => {
  let service: BlclauseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlclauseService],
    }).compile();

    service = module.get<BlclauseService>(BlclauseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

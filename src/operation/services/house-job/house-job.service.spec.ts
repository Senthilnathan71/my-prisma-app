import { Test, TestingModule } from '@nestjs/testing';
import { HouseJobService } from './house-job.service';

describe('HouseJobService', () => {
  let service: HouseJobService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HouseJobService],
    }).compile();

    service = module.get<HouseJobService>(HouseJobService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

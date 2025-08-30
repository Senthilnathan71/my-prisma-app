import { Test, TestingModule } from '@nestjs/testing';
import { MasterJobService } from './master-job.service';

describe('MasterJobService', () => {
  let service: MasterJobService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MasterJobService],
    }).compile();

    service = module.get<MasterJobService>(MasterJobService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

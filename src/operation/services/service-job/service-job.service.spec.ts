import { Test, TestingModule } from '@nestjs/testing';
import { ServiceJobService } from './service-job.service';

describe('ServiceJobService', () => {
  let service: ServiceJobService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceJobService],
    }).compile();

    service = module.get<ServiceJobService>(ServiceJobService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

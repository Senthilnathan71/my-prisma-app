import { Test, TestingModule } from '@nestjs/testing';
import { VoyageDetailService } from './voyage-detail.service';

describe('VoyageDetailService', () => {
  let service: VoyageDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VoyageDetailService],
    }).compile();

    service = module.get<VoyageDetailService>(VoyageDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

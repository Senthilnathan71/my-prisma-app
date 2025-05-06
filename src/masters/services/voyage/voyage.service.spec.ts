import { Test, TestingModule } from '@nestjs/testing';
import { VoyageService } from './voyage.service';

describe('VoyageService', () => {
  let service: VoyageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VoyageService],
    }).compile();

    service = module.get<VoyageService>(VoyageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

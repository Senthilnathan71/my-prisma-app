import { Test, TestingModule } from '@nestjs/testing';
import { SplitbookingService } from './splitbooking.service';

describe('SplitbookingService', () => {
  let service: SplitbookingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SplitbookingService],
    }).compile();

    service = module.get<SplitbookingService>(SplitbookingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

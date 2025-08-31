import { Test, TestingModule } from '@nestjs/testing';
import { FollowupService } from './followup.service';

describe('FollowupService', () => {
  let service: FollowupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FollowupService],
    }).compile();

    service = module.get<FollowupService>(FollowupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

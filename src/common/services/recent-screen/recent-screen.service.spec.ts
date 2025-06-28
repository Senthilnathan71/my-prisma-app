import { Test, TestingModule } from '@nestjs/testing';
import { RecentScreenService } from './recent-screen.service';

describe('RecentScreenService', () => {
  let service: RecentScreenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecentScreenService],
    }).compile();

    service = module.get<RecentScreenService>(RecentScreenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

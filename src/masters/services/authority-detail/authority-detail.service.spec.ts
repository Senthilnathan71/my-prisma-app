import { Test, TestingModule } from '@nestjs/testing';
import { AuthorityDetailService } from './authority-detail.service';

describe('AuthorityDetailService', () => {
  let service: AuthorityDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthorityDetailService],
    }).compile();

    service = module.get<AuthorityDetailService>(AuthorityDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

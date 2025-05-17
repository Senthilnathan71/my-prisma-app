import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalService } from './approval.service';

describe('ApprovalService', () => {
  let service: ApprovalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApprovalService],
    }).compile();

    service = module.get<ApprovalService>(ApprovalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

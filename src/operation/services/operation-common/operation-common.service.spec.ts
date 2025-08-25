import { Test, TestingModule } from '@nestjs/testing';
import { OperationCommonService } from './operation-common.service';

describe('OperationCommonService', () => {
  let service: OperationCommonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OperationCommonService],
    }).compile();

    service = module.get<OperationCommonService>(OperationCommonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ReportMasterService } from './report-master.service';

describe('ReportMasterService', () => {
  let service: ReportMasterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportMasterService],
    }).compile();

    service = module.get<ReportMasterService>(ReportMasterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

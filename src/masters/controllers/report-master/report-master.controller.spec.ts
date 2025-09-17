import { Test, TestingModule } from '@nestjs/testing';
import { ReportMasterController } from './report-master.controller';

describe('ReportMasterController', () => {
  let controller: ReportMasterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportMasterController],
    }).compile();

    controller = module.get<ReportMasterController>(ReportMasterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

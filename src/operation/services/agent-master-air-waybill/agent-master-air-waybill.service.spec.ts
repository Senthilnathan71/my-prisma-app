import { Test, TestingModule } from '@nestjs/testing';
import { AgentMasterAirWaybillService } from './agent-master-air-waybill.service';

describe('AgentMasterAirWaybillService', () => {
  let service: AgentMasterAirWaybillService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentMasterAirWaybillService],
    }).compile();

    service = module.get<AgentMasterAirWaybillService>(AgentMasterAirWaybillService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

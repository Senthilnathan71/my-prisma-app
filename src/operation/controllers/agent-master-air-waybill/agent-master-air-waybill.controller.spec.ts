import { Test, TestingModule } from '@nestjs/testing';
import { AgentMasterAirWaybillController } from './agent-master-air-waybill.controller';

describe('AgentMasterAirWaybillController', () => {
  let controller: AgentMasterAirWaybillController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentMasterAirWaybillController],
    }).compile();

    controller = module.get<AgentMasterAirWaybillController>(AgentMasterAirWaybillController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

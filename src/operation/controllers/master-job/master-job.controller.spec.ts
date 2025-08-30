import { Test, TestingModule } from '@nestjs/testing';
import { MasterJobController } from './master-job.controller';

describe('MasterJobController', () => {
  let controller: MasterJobController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterJobController],
    }).compile();

    controller = module.get<MasterJobController>(MasterJobController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ContainerActivityMasterController } from './container-activity-master.controller';

describe('ContainerActivityMasterController', () => {
  let controller: ContainerActivityMasterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContainerActivityMasterController],
    }).compile();

    controller = module.get<ContainerActivityMasterController>(ContainerActivityMasterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

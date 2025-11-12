import { Test, TestingModule } from '@nestjs/testing';
import { NetworkMasterController } from './network-master.controller';

describe('NetworkMasterController', () => {
  let controller: NetworkMasterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NetworkMasterController],
    }).compile();

    controller = module.get<NetworkMasterController>(NetworkMasterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

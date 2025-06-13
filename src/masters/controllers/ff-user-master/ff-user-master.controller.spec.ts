import { Test, TestingModule } from '@nestjs/testing';
import { FfUserMasterController } from './ff-user-master.controller';

describe('FfUserMasterController', () => {
  let controller: FfUserMasterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FfUserMasterController],
    }).compile();

    controller = module.get<FfUserMasterController>(FfUserMasterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

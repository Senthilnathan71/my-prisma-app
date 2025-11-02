import { Test, TestingModule } from '@nestjs/testing';
import { ServiceJobController } from './service-job.controller';

describe('ServiceJobController', () => {
  let controller: ServiceJobController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceJobController],
    }).compile();

    controller = module.get<ServiceJobController>(ServiceJobController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

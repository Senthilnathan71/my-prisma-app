import { Test, TestingModule } from '@nestjs/testing';
import { HouseJobController } from './house-job.controller';

describe('HouseJobController', () => {
  let controller: HouseJobController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HouseJobController],
    }).compile();

    controller = module.get<HouseJobController>(HouseJobController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

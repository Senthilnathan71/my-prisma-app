import { Test, TestingModule } from '@nestjs/testing';
import { VesselController } from './vessel.controller';

describe('VesselController', () => {
  let controller: VesselController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VesselController],
    }).compile();

    controller = module.get<VesselController>(VesselController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

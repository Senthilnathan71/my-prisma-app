import { Test, TestingModule } from '@nestjs/testing';
import { VoyageController } from './voyage.controller';

describe('VoyageController', () => {
  let controller: VoyageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoyageController],
    }).compile();

    controller = module.get<VoyageController>(VoyageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

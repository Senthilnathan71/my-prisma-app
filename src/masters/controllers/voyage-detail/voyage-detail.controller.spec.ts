import { Test, TestingModule } from '@nestjs/testing';
import { VoyageDetailController } from './voyage-detail.controller';

describe('VoyageDetailController', () => {
  let controller: VoyageDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoyageDetailController],
    }).compile();

    controller = module.get<VoyageDetailController>(VoyageDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

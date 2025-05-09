import { Test, TestingModule } from '@nestjs/testing';
import { ZoneController } from './zone.controller';

describe('ZoneController', () => {
  let controller: ZoneController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZoneController],
    }).compile();

    controller = module.get<ZoneController>(ZoneController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

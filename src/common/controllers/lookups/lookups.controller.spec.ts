import { Test, TestingModule } from '@nestjs/testing';
import { LookupsController } from './lookups.controller';

describe('LookupsController', () => {
  let controller: LookupsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LookupsController],
    }).compile();

    controller = module.get<LookupsController>(LookupsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

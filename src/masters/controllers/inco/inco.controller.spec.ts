import { Test, TestingModule } from '@nestjs/testing';
import { IncoController } from './inco.controller';

describe('IncoController', () => {
  let controller: IncoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncoController],
    }).compile();

    controller = module.get<IncoController>(IncoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

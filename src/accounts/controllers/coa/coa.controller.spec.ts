import { Test, TestingModule } from '@nestjs/testing';
import { CoaController } from './coa.controller';

describe('CoaController', () => {
  let controller: CoaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoaController],
    }).compile();

    controller = module.get<CoaController>(CoaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

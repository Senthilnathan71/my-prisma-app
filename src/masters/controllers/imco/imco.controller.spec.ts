import { Test, TestingModule } from '@nestjs/testing';
import { ImcoController } from './imco.controller';

describe('ImcoController', () => {
  let controller: ImcoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImcoController],
    }).compile();

    controller = module.get<ImcoController>(ImcoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

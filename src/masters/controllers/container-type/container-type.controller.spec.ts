import { Test, TestingModule } from '@nestjs/testing';
import { ContainerTypeController } from './container-type.controller';

describe('ContainerTypeController', () => {
  let controller: ContainerTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContainerTypeController],
    }).compile();

    controller = module.get<ContainerTypeController>(ContainerTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

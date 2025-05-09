import { Test, TestingModule } from '@nestjs/testing';
import { PackageTypeController } from './package-type.controller';

describe('PackageTypeController', () => {
  let controller: PackageTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackageTypeController],
    }).compile();

    controller = module.get<PackageTypeController>(PackageTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

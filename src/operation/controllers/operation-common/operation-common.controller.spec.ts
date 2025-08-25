import { Test, TestingModule } from '@nestjs/testing';
import { OperationCommonController } from './operation-common.controller';

describe('OperationCommonController', () => {
  let controller: OperationCommonController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationCommonController],
    }).compile();

    controller = module.get<OperationCommonController>(OperationCommonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

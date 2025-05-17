import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalController } from './approval.controller';

describe('ApprovalController', () => {
  let controller: ApprovalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalController],
    }).compile();

    controller = module.get<ApprovalController>(ApprovalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

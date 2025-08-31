import { Test, TestingModule } from '@nestjs/testing';
import { FollowupController } from './followup.controller';

describe('FollowupController', () => {
  let controller: FollowupController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowupController],
    }).compile();

    controller = module.get<FollowupController>(FollowupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

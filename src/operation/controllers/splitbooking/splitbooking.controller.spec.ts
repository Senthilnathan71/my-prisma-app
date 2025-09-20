import { Test, TestingModule } from '@nestjs/testing';
import { SplitbookingController } from './splitbooking.controller';

describe('SplitbookingController', () => {
  let controller: SplitbookingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SplitbookingController],
    }).compile();

    controller = module.get<SplitbookingController>(SplitbookingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

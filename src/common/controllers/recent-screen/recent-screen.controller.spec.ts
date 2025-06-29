import { Test, TestingModule } from '@nestjs/testing';
import { RecentScreenController } from './recent-screen.controller';

describe('RecentScreenController', () => {
  let controller: RecentScreenController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecentScreenController],
    }).compile();

    controller = module.get<RecentScreenController>(RecentScreenController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

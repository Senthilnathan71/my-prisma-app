import { Test, TestingModule } from '@nestjs/testing';
import { FavouriteScreenController } from './favourite-screen.controller';

describe('FavouriteScreenController', () => {
  let controller: FavouriteScreenController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavouriteScreenController],
    }).compile();

    controller = module.get<FavouriteScreenController>(FavouriteScreenController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

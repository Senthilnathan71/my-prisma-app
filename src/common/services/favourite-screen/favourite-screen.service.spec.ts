import { Test, TestingModule } from '@nestjs/testing';
import { FavouriteScreenService } from './favourite-screen.service';

describe('FavouriteScreenService', () => {
  let service: FavouriteScreenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FavouriteScreenService],
    }).compile();

    service = module.get<FavouriteScreenService>(FavouriteScreenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

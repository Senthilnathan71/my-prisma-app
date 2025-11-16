import { Test, TestingModule } from '@nestjs/testing';
import { CustomsService } from './customs.service';

describe('CustomsService', () => {
  let service: CustomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomsService],
    }).compile();

    service = module.get<CustomsService>(CustomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

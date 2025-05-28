import { Test, TestingModule } from '@nestjs/testing';
import { ImcoService } from './imco.service';

describe('ImcoService', () => {
  let service: ImcoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImcoService],
    }).compile();

    service = module.get<ImcoService>(ImcoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

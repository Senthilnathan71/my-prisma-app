import { Test, TestingModule } from '@nestjs/testing';
import { IncoService } from './inco.service';

describe('IncoService', () => {
  let service: IncoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IncoService],
    }).compile();

    service = module.get<IncoService>(IncoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

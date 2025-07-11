import { Test, TestingModule } from '@nestjs/testing';
import { CoaService } from './coa.service';

describe('CoaService', () => {
  let service: CoaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoaService],
    }).compile();

    service = module.get<CoaService>(CoaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

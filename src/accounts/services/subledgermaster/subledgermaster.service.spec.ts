import { Test, TestingModule } from '@nestjs/testing';
import { SubledgermasterService } from './subledgermaster.service';

describe('SubledgermasterService', () => {
  let service: SubledgermasterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubledgermasterService],
    }).compile();

    service = module.get<SubledgermasterService>(SubledgermasterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

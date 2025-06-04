import { Test, TestingModule } from '@nestjs/testing';
import { ChargeGroupService } from './charge-group.service';

describe('ChargeGroupService', () => {
  let service: ChargeGroupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChargeGroupService],
    }).compile();

    service = module.get<ChargeGroupService>(ChargeGroupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

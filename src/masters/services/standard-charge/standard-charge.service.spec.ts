import { Test, TestingModule } from '@nestjs/testing';
import { StandardChargeService } from './standard-charge.service';

describe('StandardChargeService', () => {
  let service: StandardChargeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StandardChargeService],
    }).compile();

    service = module.get<StandardChargeService>(StandardChargeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

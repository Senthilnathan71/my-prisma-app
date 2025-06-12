import { Test, TestingModule } from '@nestjs/testing';
import { FfUserMasterService } from './ff-user-master.service';

describe('FfUserMasterService', () => {
  let service: FfUserMasterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FfUserMasterService],
    }).compile();

    service = module.get<FfUserMasterService>(FfUserMasterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

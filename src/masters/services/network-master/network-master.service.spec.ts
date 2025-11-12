import { Test, TestingModule } from '@nestjs/testing';
import { NetworkMasterService } from './network-master.service';

describe('NetworkMasterService', () => {
  let service: NetworkMasterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NetworkMasterService],
    }).compile();

    service = module.get<NetworkMasterService>(NetworkMasterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

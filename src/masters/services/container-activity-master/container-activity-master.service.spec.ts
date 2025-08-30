import { Test, TestingModule } from '@nestjs/testing';
import { ContainerActivityMasterService } from './container-activity-master.service';

describe('ContainerActivityMasterService', () => {
  let service: ContainerActivityMasterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContainerActivityMasterService],
    }).compile();

    service = module.get<ContainerActivityMasterService>(ContainerActivityMasterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

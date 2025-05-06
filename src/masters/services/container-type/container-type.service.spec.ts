import { Test, TestingModule } from '@nestjs/testing';
import { ContainerTypeService } from './container-type.service';

describe('ContainerTypeService', () => {
  let service: ContainerTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContainerTypeService],
    }).compile();

    service = module.get<ContainerTypeService>(ContainerTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

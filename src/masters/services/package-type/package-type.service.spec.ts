import { Test, TestingModule } from '@nestjs/testing';
import { PackageTypeService } from './package-type.service';

describe('PackageTypeService', () => {
  let service: PackageTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PackageTypeService],
    }).compile();

    service = module.get<PackageTypeService>(PackageTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

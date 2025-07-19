import { Test, TestingModule } from '@nestjs/testing';
import { SupplierTdsMappingController } from './supplier-tds-mapping.controller';

describe('SupplierTdsMappingController', () => {
  let controller: SupplierTdsMappingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupplierTdsMappingController],
    }).compile();

    controller = module.get<SupplierTdsMappingController>(SupplierTdsMappingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

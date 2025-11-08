import { Test, TestingModule } from '@nestjs/testing';
import { TaxGroupController } from './tax-group.controller';

describe('TaxGroupController', () => {
  let controller: TaxGroupController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxGroupController],
    }).compile();

    controller = module.get<TaxGroupController>(TaxGroupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

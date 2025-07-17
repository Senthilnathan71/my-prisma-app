import { Test, TestingModule } from '@nestjs/testing';
import { TdsExemptionController } from './tds-exemption.controller';

describe('TdsExemptionController', () => {
  let controller: TdsExemptionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TdsExemptionController],
    }).compile();

    controller = module.get<TdsExemptionController>(TdsExemptionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

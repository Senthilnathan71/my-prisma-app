import { Test, TestingModule } from '@nestjs/testing';
import { TermsAndConditionsDetailController } from './terms-and-conditions-detail.controller';

describe('TermsAndConditionsDetailController', () => {
  let controller: TermsAndConditionsDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TermsAndConditionsDetailController],
    }).compile();

    controller = module.get<TermsAndConditionsDetailController>(TermsAndConditionsDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

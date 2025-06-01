import { Test, TestingModule } from '@nestjs/testing';
import { TermsAndConditionsDetailService } from './terms-and-conditions-detail.service';

describe('TermsAndConditionsDetailService', () => {
  let service: TermsAndConditionsDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TermsAndConditionsDetailService],
    }).compile();

    service = module.get<TermsAndConditionsDetailService>(TermsAndConditionsDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

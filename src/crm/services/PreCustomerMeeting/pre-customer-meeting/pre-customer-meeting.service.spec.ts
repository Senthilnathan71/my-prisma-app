import { Test, TestingModule } from '@nestjs/testing';
import { PreCustomerMeetingService } from './pre-customer-meeting.service';

describe('PreCustomerMeetingService', () => {
  let service: PreCustomerMeetingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PreCustomerMeetingService],
    }).compile();

    service = module.get<PreCustomerMeetingService>(PreCustomerMeetingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PreCustomerMeetingController } from './pre-customer-meeting.controller';

describe('PreCustomerMeetingController', () => {
  let controller: PreCustomerMeetingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreCustomerMeetingController],
    }).compile();

    controller = module.get<PreCustomerMeetingController>(PreCustomerMeetingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

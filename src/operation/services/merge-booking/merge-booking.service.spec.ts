import { Test, TestingModule } from '@nestjs/testing';
import { MergeBookingService } from './merge-booking.service';

describe('MergeBookingService', () => {
  let service: MergeBookingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MergeBookingService],
    }).compile();

    service = module.get<MergeBookingService>(MergeBookingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

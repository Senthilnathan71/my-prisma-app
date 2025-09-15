import { Test, TestingModule } from '@nestjs/testing';
import { MergeBookingController } from './merge-booking.controller';

describe('MergeBookingController', () => {
  let controller: MergeBookingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MergeBookingController],
    }).compile();

    controller = module.get<MergeBookingController>(MergeBookingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

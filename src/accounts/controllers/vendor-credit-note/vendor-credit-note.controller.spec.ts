import { Test, TestingModule } from '@nestjs/testing';
import { VendorCreditNoteController } from './vendor-credit-note.controller';

describe('VendorCreditNoteController', () => {
  let controller: VendorCreditNoteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorCreditNoteController],
    }).compile();

    controller = module.get<VendorCreditNoteController>(VendorCreditNoteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

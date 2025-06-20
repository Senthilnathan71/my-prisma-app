import { Test, TestingModule } from '@nestjs/testing';
import { AuthorityDetailController } from './authority-detail.controller';

describe('AuthorityDetailController', () => {
  let controller: AuthorityDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthorityDetailController],
    }).compile();

    controller = module.get<AuthorityDetailController>(AuthorityDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

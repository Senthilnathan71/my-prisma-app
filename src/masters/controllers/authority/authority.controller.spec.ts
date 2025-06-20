import { Test, TestingModule } from '@nestjs/testing';
import { AuthorityController } from './authority.controller';

describe('AuthorityController', () => {
  let controller: AuthorityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthorityController],
    }).compile();

    controller = module.get<AuthorityController>(AuthorityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

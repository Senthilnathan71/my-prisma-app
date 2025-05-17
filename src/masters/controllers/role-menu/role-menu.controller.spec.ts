import { Test, TestingModule } from '@nestjs/testing';
import { RoleMenuController } from './role-menu.controller';

describe('RoleMenuController', () => {
  let controller: RoleMenuController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleMenuController],
    }).compile();

    controller = module.get<RoleMenuController>(RoleMenuController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

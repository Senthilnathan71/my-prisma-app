import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database/database.service';
import {
  PUBLIC_RESOURCE_MENU_CODES,
  PublicAccessTokenError,
  PublicAccessTokenService,
} from './public-access-token.service';

const QUOTATION_MENU_SID = 59;

describe('PublicAccessTokenService', () => {
  let service: PublicAccessTokenService;
  let db: any;

  beforeEach(async () => {
    db = {
      menuMaster: {
        findMany: jest.fn().mockResolvedValue([
          { MenuMasterSid: QUOTATION_MENU_SID, MenuCode: 'QUA' },
        ]),
      },
      publicAccessToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (fn: any) => fn(db)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicAccessTokenService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<PublicAccessTokenService>(PublicAccessTokenService);
    await service.onModuleInit();
  });

  describe('issue', () => {
    it('invalidates older live tokens and creates a new row with the right expiry', async () => {
      db.publicAccessToken.create.mockResolvedValue({
        PublicAccessTokenSid: 42,
      });

      const before = Date.now();
      const result = await service.issue({
        menuCode: PUBLIC_RESOURCE_MENU_CODES.QUOTATION,
        resourceSid: 833,
        ttlHours: 72,
        sentToEmail: 'cust@example.com',
        createdBy: 'sales@dofi.co',
      });

      expect(db.publicAccessToken.updateMany).toHaveBeenCalledWith({
        where: {
          MenuMasterSid: QUOTATION_MENU_SID,
          ResourceSid: 833,
          UsedAt: null,
        },
        data: expect.objectContaining({
          UsedAt: expect.any(Date),
          updatedBy: 'sales@dofi.co',
        }),
      });

      expect(db.publicAccessToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          Token: expect.any(String),
          MenuMasterSid: QUOTATION_MENU_SID,
          ResourceSid: 833,
          SentToEmail: 'cust@example.com',
          createdBy: 'sales@dofi.co',
          ExpiresAt: expect.any(Date),
        }),
      });

      const expectedMs = before + 72 * 3600 * 1000;
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMs - 100);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 72 * 3600 * 1000 + 100,
      );
      expect(result.token.length).toBeGreaterThan(20);
      expect(result.publicAccessTokenSid).toBe(42);
    });

    it('throws if the menu code has not been seeded', async () => {
      db.menuMaster.findMany.mockResolvedValueOnce([]);
      await service.refreshMenuCodeMap();

      await expect(
        service.issue({
          menuCode: 'QUA' as any,
          resourceSid: 1,
          ttlHours: 1,
        }),
      ).rejects.toThrow(/MenuMaster row missing/);
    });
  });

  describe('findValid', () => {
    it('returns the row when the token is valid', async () => {
      const row = {
        PublicAccessTokenSid: 1,
        MenuMasterSid: QUOTATION_MENU_SID,
        ResourceSid: 100,
        ExpiresAt: new Date(Date.now() + 60_000),
        UsedAt: null,
      };
      db.publicAccessToken.findUnique.mockResolvedValue(row);

      const result = await service.findValid(
        'tok',
        PUBLIC_RESOURCE_MENU_CODES.QUOTATION,
      );
      expect(result).toBe(row);
    });

    it('throws NOT_FOUND when no row matches', async () => {
      db.publicAccessToken.findUnique.mockResolvedValue(null);
      await expect(
        service.findValid('tok', PUBLIC_RESOURCE_MENU_CODES.QUOTATION),
      ).rejects.toThrow(PublicAccessTokenError);
      await expect(
        service.findValid('tok', PUBLIC_RESOURCE_MENU_CODES.QUOTATION),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws NOT_FOUND when the token belongs to a different menu', async () => {
      db.publicAccessToken.findUnique.mockResolvedValue({
        PublicAccessTokenSid: 1,
        MenuMasterSid: 999,
        ResourceSid: 100,
        ExpiresAt: new Date(Date.now() + 60_000),
        UsedAt: null,
      });
      await expect(
        service.findValid('tok', PUBLIC_RESOURCE_MENU_CODES.QUOTATION),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws ALREADY_USED when UsedAt is set', async () => {
      db.publicAccessToken.findUnique.mockResolvedValue({
        PublicAccessTokenSid: 1,
        MenuMasterSid: QUOTATION_MENU_SID,
        ResourceSid: 100,
        ExpiresAt: new Date(Date.now() + 60_000),
        UsedAt: new Date(),
      });
      await expect(
        service.findValid('tok', PUBLIC_RESOURCE_MENU_CODES.QUOTATION),
      ).rejects.toMatchObject({ code: 'ALREADY_USED' });
    });

    it('throws EXPIRED when ExpiresAt is in the past', async () => {
      db.publicAccessToken.findUnique.mockResolvedValue({
        PublicAccessTokenSid: 1,
        MenuMasterSid: QUOTATION_MENU_SID,
        ResourceSid: 100,
        ExpiresAt: new Date(Date.now() - 1_000),
        UsedAt: null,
      });
      await expect(
        service.findValid('tok', PUBLIC_RESOURCE_MENU_CODES.QUOTATION),
      ).rejects.toMatchObject({ code: 'EXPIRED' });
    });
  });

  describe('consume', () => {
    it('stamps UsedAt on the given token row', async () => {
      const tx = {
        publicAccessToken: { update: jest.fn().mockResolvedValue({}) },
      };
      await service.consume(7, tx as any, 'PUBLIC_LINK');
      expect(tx.publicAccessToken.update).toHaveBeenCalledWith({
        where: { PublicAccessTokenSid: 7 },
        data: { UsedAt: expect.any(Date), updatedBy: 'PUBLIC_LINK' },
      });
    });
  });
});

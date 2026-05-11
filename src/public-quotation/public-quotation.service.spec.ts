import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PUBLIC_RESOURCE_MENU_CODES,
  PublicAccessTokenError,
  PublicAccessTokenService,
} from '../common/public-access-token/public-access-token.service';
import { DatabaseService } from '../database/database.service';
import {
  CarrierDecisionDto,
  PublicApprovalDecision,
  SubmitDecisionsDto,
} from './dto/submit-decisions.dto';
import { PublicQuotationService } from './public-quotation.service';

const QUOTATION_MENU_SID = 59;

const requestMeta = { ip: '203.0.113.10', userAgent: 'jest-test' };

function buildHeader(overrides: Partial<any> = {}): any {
  return {
    QuoteHeaderSid: 833,
    QuoteNumber: 'DML/JA/04/26/1240',
    QuoteDate: new Date('2026-04-30'),
    CustomerName: 'Acme Logistics',
    QuoteValidFrom: null,
    QuoteValidTo: null,
    deletedAt: null,
    status: 'A',
    quoteRoute: [
      {
        QuoteRouteSid: 1,
        PORSid: 11,
        POLSid: 12,
        PODSid: 13,
        FDPSid: 14,
        TransitDays: 7,
      },
    ],
    quoteCargo: [
      {
        CargoType: 'OOG',
        ContainerType: '20ft Standard',
        Qty: 1,
        GrossWeight: 100,
        NetWeight: 50,
        Volume: 333,
        ShipmentTerms: 'CFS/CFS',
      },
    ],
    quoteCarrier: [
      {
        QuoteCarrierSid: 71,
        CarrierName: 'Wayne Enterprise',
        TransitTime: '6',
        ApprovalStatus: 'Pending',
      },
    ],
    quoteCharge: [
      {
        QuoteCarrierSid: 71,
        ChargeDisplayName: 'Freight',
        Qty: 1,
        Rate: 94,
        Amount: 94,
        CurrencyMasterSid: 1,
      },
    ],
    ...overrides,
  };
}

describe('PublicQuotationService', () => {
  let service: PublicQuotationService;
  let db: any;
  let tokens: jest.Mocked<PublicAccessTokenService>;

  beforeEach(async () => {
    db = {
      quoteHeader: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      portMaster: {
        findMany: jest.fn().mockResolvedValue([
          { PortMasterSid: 11, PortCode: 'AEJEA', PortName: 'Jebel Ali Port' },
          { PortMasterSid: 12, PortCode: 'AEJEA', PortName: 'Jebel Ali Port' },
          { PortMasterSid: 13, PortCode: 'SGJUR', PortName: 'Jurong Port' },
          { PortMasterSid: 14, PortCode: 'SGJUR', PortName: 'Jurong Port' },
        ]),
      },
      currencyMaster: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ CurrencyMasterSid: 1, currencyCode: 'USD' }]),
      },
      quoteCarrier: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      publicAccessToken: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(db)),
    };

    tokens = {
      findValid: jest.fn(),
      consume: jest.fn().mockResolvedValue(undefined),
      issue: jest.fn(),
      onModuleInit: jest.fn(),
      refreshMenuCodeMap: jest.fn(),
    } as unknown as jest.Mocked<PublicAccessTokenService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicQuotationService,
        { provide: DatabaseService, useValue: db },
        { provide: PublicAccessTokenService, useValue: tokens },
      ],
    }).compile();

    service = module.get(PublicQuotationService);
  });

  describe('getPublicQuotation', () => {
    it('returns a curated DTO when the token is valid', async () => {
      tokens.findValid.mockResolvedValue({
        PublicAccessTokenSid: 1,
        MenuMasterSid: QUOTATION_MENU_SID,
        ResourceSid: 833,
        ExpiresAt: new Date(Date.now() + 60_000),
        UsedAt: null,
      } as any);
      db.quoteHeader.findUnique.mockResolvedValue(buildHeader());

      const result = await service.getPublicQuotation('tok-abc');

      expect(tokens.findValid).toHaveBeenCalledWith(
        'tok-abc',
        PUBLIC_RESOURCE_MENU_CODES.QUOTATION,
      );
      expect(result.quoteHeaderSid).toBe(833);
      expect(result.routes[0].pol?.PortName).toBe('Jebel Ali Port');
      expect(result.carriers).toHaveLength(1);
      expect(result.carriers[0].charges[0].currency).toBe('USD');
      expect(result).not.toHaveProperty('CompanyMasterSid');
    });

    it('propagates token errors from findValid', async () => {
      tokens.findValid.mockRejectedValue(
        new PublicAccessTokenError('EXPIRED'),
      );
      await expect(service.getPublicQuotation('tok')).rejects.toMatchObject({
        code: 'EXPIRED',
      });
    });

    it('returns NOT_FOUND when the underlying header is soft-deleted', async () => {
      tokens.findValid.mockResolvedValue({
        PublicAccessTokenSid: 1,
        MenuMasterSid: QUOTATION_MENU_SID,
        ResourceSid: 833,
        ExpiresAt: new Date(Date.now() + 60_000),
        UsedAt: null,
      } as any);
      db.quoteHeader.findUnique.mockResolvedValue(
        buildHeader({ deletedAt: new Date() }),
      );

      await expect(service.getPublicQuotation('tok')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('returns NOT_FOUND when the header status is inactive', async () => {
      tokens.findValid.mockResolvedValue({
        PublicAccessTokenSid: 1,
        MenuMasterSid: QUOTATION_MENU_SID,
        ResourceSid: 833,
        ExpiresAt: new Date(Date.now() + 60_000),
        UsedAt: null,
      } as any);
      db.quoteHeader.findUnique.mockResolvedValue(
        buildHeader({ status: 'I' }),
      );

      await expect(service.getPublicQuotation('tok')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('submitDecisions', () => {
    function decision(
      QuoteCarrierSid: number,
      status = PublicApprovalDecision.Approved,
    ): CarrierDecisionDto {
      const d = new CarrierDecisionDto();
      d.QuoteCarrierSid = QuoteCarrierSid;
      d.ApprovalStatus = status;
      d.ApprovedBy = 'Customer Joe';
      d.Remarks = 'Looks good';
      return d;
    }

    function body(decisions: CarrierDecisionDto[]): SubmitDecisionsDto {
      const dto = new SubmitDecisionsDto();
      dto.decisions = decisions;
      return dto;
    }

    function validTokenRow() {
      return {
        PublicAccessTokenSid: 9,
        MenuMasterSid: QUOTATION_MENU_SID,
        ResourceSid: 833,
        ExpiresAt: new Date(Date.now() + 60_000),
        UsedAt: null,
      };
    }

    it('rejects with 400 when a decision references a carrier from another quotation', async () => {
      tokens.findValid.mockResolvedValue(validTokenRow() as any);
      db.quoteCarrier.findMany.mockResolvedValue([
        {
          QuoteCarrierSid: 71,
          ApprovalStatus: 'Pending',
          ApprovedBy: null,
          Remarks: null,
        },
      ]);

      await expect(
        service.submitDecisions(
          'tok',
          body([decision(71), decision(999)]),
          requestMeta,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates carriers, writes audit logs, stamps header, and consumes the token in one transaction', async () => {
      tokens.findValid.mockResolvedValue(validTokenRow() as any);
      db.quoteCarrier.findMany.mockResolvedValue([
        {
          QuoteCarrierSid: 71,
          ApprovalStatus: 'Pending',
          ApprovedBy: null,
          Remarks: null,
        },
      ]);
      db.publicAccessToken.findUnique.mockResolvedValue(validTokenRow());

      const result = await service.submitDecisions(
        'tok',
        body([decision(71, PublicApprovalDecision.Approved)]),
        requestMeta,
      );

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(db.quoteCarrier.update).toHaveBeenCalledWith({
        where: { QuoteCarrierSid: 71 },
        data: expect.objectContaining({
          ApprovalStatus: 'Approved',
          ApprovedBy: 'Customer Joe',
          updatedBy: 'PUBLIC_LINK',
        }),
      });
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tableName: 'QuoteCarrier',
          recordId: '71',
          operation: 'CUSTOMER_APPROVAL',
          changedBy: 'Customer Joe',
          changes: expect.objectContaining({
            ip: '203.0.113.10',
            userAgent: 'jest-test',
            source: 'public-link',
            publicAccessTokenSid: 9,
          }),
        }),
      });
      expect(db.quoteHeader.update).toHaveBeenCalledWith({
        where: { QuoteHeaderSid: 833 },
        data: expect.objectContaining({
          CustomerApprovedBy: 'Customer Joe',
          CustomerApprovedOn: expect.any(Date),
          updatedBy: 'PUBLIC_LINK',
        }),
      });
      expect(tokens.consume).toHaveBeenCalledWith(9, db);
      expect(result.ok).toBe(true);
    });

    it('throws ALREADY_USED if the token is consumed between findValid and the transaction', async () => {
      tokens.findValid.mockResolvedValue(validTokenRow() as any);
      db.quoteCarrier.findMany.mockResolvedValue([
        {
          QuoteCarrierSid: 71,
          ApprovalStatus: 'Pending',
          ApprovedBy: null,
          Remarks: null,
        },
      ]);
      db.publicAccessToken.findUnique.mockResolvedValue({
        ...validTokenRow(),
        UsedAt: new Date(),
      });

      await expect(
        service.submitDecisions('tok', body([decision(71)]), requestMeta),
      ).rejects.toMatchObject({ code: 'ALREADY_USED' });
      expect(tokens.consume).not.toHaveBeenCalled();
    });

    it('throws EXPIRED if the token expires between findValid and the transaction', async () => {
      tokens.findValid.mockResolvedValue(validTokenRow() as any);
      db.quoteCarrier.findMany.mockResolvedValue([
        {
          QuoteCarrierSid: 71,
          ApprovalStatus: 'Pending',
          ApprovedBy: null,
          Remarks: null,
        },
      ]);
      db.publicAccessToken.findUnique.mockResolvedValue({
        ...validTokenRow(),
        ExpiresAt: new Date(Date.now() - 5_000),
      });

      await expect(
        service.submitDecisions('tok', body([decision(71)]), requestMeta),
      ).rejects.toMatchObject({ code: 'EXPIRED' });
    });
  });
});

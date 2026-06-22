import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  PUBLIC_RESOURCE_MENU_CODES,
  PublicAccessTokenError,
  PublicAccessTokenService,
} from 'src/common/public-access-token/public-access-token.service';
import { SubmitDecisionsDto } from './dto/submit-decisions.dto';

interface RequestMeta {
  ip: string;
  userAgent: string;
}

@Injectable()
export class PublicQuotationService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly tokens: PublicAccessTokenService,
  ) {}

  async getPublicQuotation(token: string) {
    const tokenRow = await this.tokens.findValid(
      token,
      PUBLIC_RESOURCE_MENU_CODES.QUOTATION,
    );

    const ACTIVE = 'A';

    const header = await this._db.quoteHeader.findUnique({
    where: { QuoteHeaderSid: tokenRow.ResourceSid },
    include: {
      quoteRoute: {
        where: { status: ACTIVE },
        orderBy: { createdOn: 'desc' },
        include: {
          quoteCarrier: {
            where: { status: ACTIVE },
            orderBy: { createdOn: 'desc' },
            include: {
              quoteCharge: {
                where: { status: ACTIVE },
                orderBy: { createdOn: 'desc' },
              },
            },
          },
          quoteCargo: {
            where: { Status: ACTIVE },
            orderBy: { CreatedOn: 'desc' },
            include: {
              quoteProduct: {
                where: { Status: ACTIVE },
                orderBy: { CreatedOn: 'desc' },
              },
            },
          },
        },
      },
    },
  });

    if (!header || header.deletedAt || header.status === 'I') {
      throw new PublicAccessTokenError('NOT_FOUND');
    }

    const portSids = new Set<number>();
    const currencySids = new Set<number>();
    const departmentSids = new Set<number>();
    for (const r of header.quoteRoute) {
      if (r.PORSid) portSids.add(r.PORSid);
      if (r.POLSid) portSids.add(r.POLSid);
      if (r.PODSid) portSids.add(r.PODSid);
      if (r.FDPSid) portSids.add(r.FDPSid);
      if (r.DepartmentMasterSid) departmentSids.add(r.DepartmentMasterSid);
      for (const carrier of r.quoteCarrier) {
      for (const ch of carrier.quoteCharge) {
        if (ch.CostCurrencyMasterSid) currencySids.add(ch.CostCurrencyMasterSid);
        if (ch.RevenueCurrencyMasterSid) currencySids.add(ch.RevenueCurrencyMasterSid);
      }
    }
    }

     const ports =
    portSids.size > 0
      ? await this._db.portMaster.findMany({
          where: { PortMasterSid: { in: Array.from(portSids) } },
          select: { PortMasterSid: true, PortCode: true, PortName: true },
        })
      : [];
  const portMap = new Map(ports.map((p) => [p.PortMasterSid, p]));

  const departments = 
        departmentSids.size > 0
      ? await this._db.departmentMaster.findMany({
          where: { DepartmentMasterSid: { in: Array.from(departmentSids) } },
          select: { DepartmentMasterSid: true, departmentName: true },
        })
      : [];
  const departmentMap = new Map(departments.map((d) => [d.DepartmentMasterSid, d.departmentName]));

    const currencies =
    currencySids.size > 0
      ? await this._db.currencyMaster.findMany({
          where: { CurrencyMasterSid: { in: Array.from(currencySids) } },
          select: { CurrencyMasterSid: true, currencyCode: true },
        })
      : [];
  const currencyMap = new Map(
    currencies.map((c) => [c.CurrencyMasterSid, c.currencyCode]),
  );

    return {
    quoteHeaderSid: header.QuoteHeaderSid,
    quoteNumber: header.QuoteNumber,
    quoteDate: header.QuoteDate,
    customerName: header.CustomerName,
    validFrom: header.QuoteValidFrom,
    validTo: header.QuoteValidTo,
    routes: header.quoteRoute.map((r) => ({
      quoteRouteSid: r.QuoteRouteSid,
      department: departmentMap.get(r.DepartmentMasterSid) ?? null,
      por: portMap.get(r.PORSid) ?? null,
      pol: portMap.get(r.POLSid) ?? null,
      pod: portMap.get(r.PODSid) ?? null,
      fdp: portMap.get(r.FDPSid) ?? null,
      carriers: r.quoteCarrier.map((carrier) => ({
        quoteCarrierSid: carrier.QuoteCarrierSid,
        carrierName: carrier.CarrierName,
        transitTime: carrier.TransitTime,
        approvalStatus: carrier.ApprovalStatus,
        charges: carrier.quoteCharge.map((ch) => ({
          chargeName: ch.ChargeDisplayName,
          qty: ch.Qty,
          revenue:ch.RevenueRate,
          revenuelcamount: ch.RevenueAmount,
          revenuecurrency: ch.RevenueCurrencyMasterSid
            ? (currencyMap.get(ch.RevenueCurrencyMasterSid) ?? null)
            : null,
        })),
      })),
      cargo: r.quoteCargo.map((c) => ({
        cargoType: c.CargoType,
        grossWeight: c.GrossWeight,
        netWeight: c.NetWeight,
        cbm: c.Volume,
        shipmentTerms: c.ShipmentTerms,
        products: c.quoteProduct.map((p) => ({
          productName: p.ProductName,
          grossWeight: p.GrossWeight,
          netweight: p.NetWeight,
          volume: p.Volume,
        })),
      })),
    })),
      expiresAt: tokenRow.ExpiresAt,
    };
  }

  async submitDecisions(
    token: string,
    body: SubmitDecisionsDto,
    meta: RequestMeta,
  ) {
    const tokenRow = await this.tokens.findValid(
      token,
      PUBLIC_RESOURCE_MENU_CODES.QUOTATION,
    );

    const carrierIds = body.decisions.map((d) => d.QuoteCarrierSid);
    const validCarriers = await this._db.quoteCarrier.findMany({
      where: {
        QuoteCarrierSid: { in: carrierIds },
        QuoteHeaderSid: tokenRow.ResourceSid,
      },
      select: {
        QuoteCarrierSid: true,
        ApprovalStatus: true,
        ApprovedBy: true,
        Remarks: true,
      },
    });
    const validIds = new Set(validCarriers.map((c) => c.QuoteCarrierSid));
    const invalid = carrierIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `QuoteCarrierSid(s) do not belong to this quotation: ${invalid.join(', ')}`,
      );
    }

    const oldByCarrier = new Map(
      validCarriers.map((c) => [c.QuoteCarrierSid, c]),
    );

    return this._db.$transaction(async (tx) => {
      const reFetched = await tx.publicAccessToken.findUnique({
        where: { Token: token },
      });
      if (!reFetched || reFetched.UsedAt !== null) {
        throw new PublicAccessTokenError('ALREADY_USED');
      }
      if (reFetched.ExpiresAt.getTime() <= Date.now()) {
        throw new PublicAccessTokenError('EXPIRED');
      }

      for (const d of body.decisions) {
        const old = oldByCarrier.get(d.QuoteCarrierSid);
        await tx.quoteCarrier.update({
          where: { QuoteCarrierSid: d.QuoteCarrierSid },
          data: {
            ApprovalStatus: d.ApprovalStatus,
            ApprovedBy: d.ApprovedBy,
            Remarks: d.Remarks ?? null,
            updatedBy: 'PUBLIC_LINK',
          },
        });
        await tx.auditLog.create({
          data: {
            tableName: 'QuoteCarrier',
            recordId: String(d.QuoteCarrierSid),
            operation: 'CUSTOMER_APPROVAL',
            changedBy: d.ApprovedBy,
            oldVal: old
              ? {
                  ApprovalStatus: old.ApprovalStatus,
                  ApprovedBy: old.ApprovedBy,
                  Remarks: old.Remarks,
                }
              : undefined,
            newVal: {
              ApprovalStatus: d.ApprovalStatus,
              ApprovedBy: d.ApprovedBy,
              Remarks: d.Remarks ?? null,
            },
            changes: {
              ip: meta.ip,
              userAgent: meta.userAgent,
              source: 'public-link',
              publicAccessTokenSid: reFetched.PublicAccessTokenSid,
            },
          },
        });
      }

      const firstDecision = body.decisions[0];
      await tx.quoteHeader.update({
        where: { QuoteHeaderSid: tokenRow.ResourceSid },
        data: {
          CustomerApprovedBy: firstDecision.ApprovedBy,
          CustomerApprovedOn: new Date(),
          updatedBy: 'PUBLIC_LINK',
        },
      });

      await this.tokens.consume(reFetched.PublicAccessTokenSid, tx);

      return {
        ok: true,
        decisions: body.decisions.map((d) => ({
          QuoteCarrierSid: d.QuoteCarrierSid,
          ApprovalStatus: d.ApprovalStatus,
          ApprovedBy: d.ApprovedBy,
          Remarks: d.Remarks ?? null,
        })),
      };
    });
  }
}

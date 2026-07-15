import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

/**
 * Authorize-before-post gate for accounts vouchers.
 *
 * Agreed rules:
 *  - Auto-posting voucher types (VoucherTypeMaster.IsAutoPosting = 'Y') are EXEMPT — normal flow.
 *  - Authority is keyed by MENU (VoucherTypeMaster.MenuMasterSid). Department is OPTIONAL and is
 *    therefore not used to scope the posting check.
 *  - No authority rule configured for the menu -> normal flow (posts exactly as before).
 *  - Rule configured -> the voucher must be approved by the FINAL authorizer before it can post.
 *
 * This lives inside the post service methods (not on the routes) so the manual Post button and the
 * implicit auto-post-on-create path both go through the same gate.
 */
@Injectable()
export class VoucherAuthorizationService {
  constructor(private _db: DatabaseService) {}

  async ensureAuthorizedToPost(params: {
    documentSid: number;
    menuMasterSid?: number | null;
    isAutoPosting?: string | null;
    companyMasterSid?: number | null;
    branchMasterSid?: number | null;
    documentLabel?: string;
  }): Promise<void> {
    // 1. Auto-posting voucher types never require authorization.
    if (String(params.isAutoPosting || '').toUpperCase() === 'Y') {
      return;
    }

    const menuMasterSid = Number(params.menuMasterSid);
    const documentSid = Number(params.documentSid);
    // Nothing to scope against -> normal flow.
    if (!menuMasterSid || !documentSid) {
      return;
    }

    const companyMasterSid = params.companyMasterSid ? Number(params.companyMasterSid) : undefined;
    const branchMasterSid = params.branchMasterSid ? Number(params.branchMasterSid) : undefined;

    // Menu-scoped only — department is optional for voucher authorization.
    const authorityMasterScope: any = {
      status: 'A',
      MenuMaster: menuMasterSid,
      ...(companyMasterSid ? { CompanyMasterSid: companyMasterSid } : {}),
      ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
    };

    const totalAuthorizers = await this._db.authorityDetail.count({
      where: {
        status: 'A',
        ...(companyMasterSid ? { CompanyMasterSid: companyMasterSid } : {}),
        ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
        authorityMaster: authorityMasterScope,
      },
    });

    // 2. No authority rule for this menu -> normal flow.
    if (totalAuthorizers === 0) {
      return;
    }

    const label = params.documentLabel || 'voucher';

    const logs = await this._db.authorityLog.findMany({
      where: {
        DocumentSid: documentSid,
        Status: 'A',
        AuthorityDetail: {
          status: 'A',
          authorityMaster: authorityMasterScope,
        },
      },
      select: {
        ApprovalStatus: true,
        AuthorityDetail: { select: { FinalAuthority: true } },
      },
    });

    if (logs.some((log) => log.ApprovalStatus === 'Rejected')) {
      throw new BadRequestException(`This ${label} has been rejected and cannot be posted.`);
    }

    // 3. Approved == the FINAL authorizer approved (same rule the approval log uses).
    const finalApproved = logs.some(
      (log) => log.AuthorityDetail?.FinalAuthority === 'Y' && log.ApprovalStatus === 'Approved',
    );
    if (!finalApproved) {
      throw new BadRequestException(`This ${label} must be authorized before it can be posted.`);
    }
  }
}

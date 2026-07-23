import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { AuthorityService } from 'src/masters/services/authority/authority.service';
import {
  ApprovalDocSource,
  resolveApprovalDocSource,
  getVoucherDocSource,
  resolveMenuRoute,
} from 'src/common/config/approval-document.registry';
import { PendingApprovalDto } from 'src/masters/DTO/pending-approval.dto';
import {
  ApproveDocumentDto,
  BulkApproveDto,
  AutoApproveDto,
} from 'src/masters/DTO/approve-document.dto';

/**
 * Authorization Approval
 * --------------------------------------------------------------------------
 * A unified "pending approvals" inbox for the logged-in user. It is a READ +
 * thin-wrapper layer over the EXISTING approval engine (AuthorityService):
 *   - pending scan     : <docTable>.authorizerStatus='Pending' minus AuthorityLog
 *                        for the approver's AuthorityDetailSid (same rule the current
 *                        Document Authorization screen uses).
 *   - approve / reject : delegates to AuthorityService.authorizeDocument (writes
 *                        AuthorityLog, enforces level order + FinalAuthority).
 *   - details          : delegates to AuthorityService.getApprovalStatusData.
 *
 * It does NOT modify any document create/update flow. On a FINAL decision it
 * additionally flips the document header's own status column so the document
 * disappears from the pending list for everyone (mirrors the enquiry flow).
 */
@Injectable()
export class AuthorizationApprovalService {
  constructor(
    private _db: DatabaseService,
    private authorityService: AuthorityService,
    private logger: Logger,
  ) {}

  // ── Menus assigned to the logged-in user (Menu dropdown) ──────────────────
  async getAvailableMenus(
    userMasterSid: number,
    companyMasterSid: number,
    branchMasterSid: number,
  ) {
    // Scope is driven by the AuthorityMaster (menu tenancy). We intentionally do NOT
    // also constrain AuthorityDetail.Company/Branch — those are sometimes saved with
    // slightly different values and would wrongly drop valid approver rows.
    const details = await this._db.authorityDetail.findMany({
      where: {
        UserMasterSid: userMasterSid,
        status: statusWhereClause,
        authorityMaster: {
          status: 'A',
          CompanyMasterSid: companyMasterSid,
          BranchMasterSid: branchMasterSid,
        },
      },
      select: {
        authorityMaster: {
          select: {
            MenuMaster: true,
            menuMaster: { select: { MenuMasterSid: true, MenuName: true } },
          },
        },
      },
    });

    // Distinct menus assigned to the user (AuthorityDetail -> AuthorityMaster -> MenuMaster).
    const seen = new Map<number, string>();
    for (const d of details) {
      const menu = d.authorityMaster?.menuMaster;
      if (!menu) continue;
      seen.set(menu.MenuMasterSid, menu.MenuName);
    }

    return Array.from(seen.entries())
      .map(([MenuMasterSid, MenuName]) => ({ MenuMasterSid, MenuName }))
      .sort((a, b) => a.MenuName.localeCompare(b.MenuName));
  }

  // ── Pending documents across the user's menus (the grid) ──────────────────
  async getPendingDocuments(param: PendingApprovalDto) {
    const userMasterSid = Number(param.UserMasterSid);
    const companyMasterSid = Number(param.activeCompanyId);
    const branchMasterSid = param.activeBranchId ? Number(param.activeBranchId) : undefined;
    const menuFilter = param.MenuMasterSid ? Number(param.MenuMasterSid) : undefined;
    const departmentFilter = param.DepartmentMasterSid ? Number(param.DepartmentMasterSid) : undefined;
    const search = (param.search || '').trim().toLowerCase();
    const page = Number(param.page) || 1;
    const pageSize = Number(param.pageSize) || 10;
    const dateFrom = param.dateFrom ? new Date(param.dateFrom) : undefined;
    const dateTo = param.dateTo ? new Date(param.dateTo) : undefined;

    if (!userMasterSid || !companyMasterSid) {
      throw new BadRequestException('User and company are required.');
    }

    // 1. Every menu this user approves (optionally narrowed to one menu).
    const details = await this._db.authorityDetail.findMany({
      where: {
        UserMasterSid: userMasterSid,
        status: statusWhereClause,
        authorityMaster: {
          status: 'A',
          CompanyMasterSid: companyMasterSid,
          ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
          ...(menuFilter ? { MenuMaster: menuFilter } : {}),
        },
      },
      select: {
        AuthorityDetailSid: true,
        AuthorityLevel: true,
        AuthorityMasterSid: true,
        authorityMaster: {
          select: {
            MenuMaster: true,
            menuMaster: {
              select: {
                MenuMasterSid: true,
                MenuName: true,
                menuConfig: { select: { ModelName: true, PrimaryKey: true, LinkPattern: true } },
              },
            },
          },
        },
      },
    });

    // Group into one context per menu (a user normally has one detail row per menu).
    type MenuCtx = {
      menuMasterSid: number;
      menuName: string;
      source: ApprovalDocSource;
      authorityDetailSid: number;
      authorityLevel: number;
      authorityMasterSid: number | null;
    };
    // Voucher menus (Invoice, Credit Note, Journal Voucher, ...) are detected from
    // VoucherTypeMaster.MenuMasterSid and all resolve to the shared VoucherHeader source.
    let voucherMenuSids = new Set<number>();
    try {
      voucherMenuSids = new Set(await this.authorityService.getMenuOnlyAuthorityMenus());
    } catch (err) {
      this.logger.warn(`Voucher menu lookup failed: ${err}`);
    }

    const menuContexts: MenuCtx[] = [];
    for (const d of details) {
      const menu = d.authorityMaster?.menuMaster;
      if (!menu) continue;
      // Prefer the DB MenuConfig.ModelName (environment-accurate), else the menu name,
      // else treat any voucher-type menu as VoucherHeader.
      const modelName = menu.menuConfig?.[0]?.ModelName;
      let source = resolveApprovalDocSource(menu.MenuName, modelName);
      if (!source && voucherMenuSids.has(menu.MenuMasterSid)) source = getVoucherDocSource();
      if (!source) continue; // menu we don't know how to scan yet
      menuContexts.push({
        menuMasterSid: menu.MenuMasterSid,
        menuName: menu.MenuName,
        source,
        authorityDetailSid: d.AuthorityDetailSid,
        authorityLevel: d.AuthorityLevel,
        authorityMasterSid: d.AuthorityMasterSid,
      });
    }

    // Total approver levels per authority-master (for the "L2/3" display).
    const totalLevelByMaster = new Map<number, number>();
    const masterSids = Array.from(
      new Set(menuContexts.map((c) => c.authorityMasterSid).filter((s): s is number => !!s)),
    );
    if (masterSids.length) {
      const grouped = await this._db.authorityDetail.groupBy({
        by: ['AuthorityMasterSid'],
        where: { AuthorityMasterSid: { in: masterSids }, status: statusWhereClause },
        _count: { AuthorityDetailSid: true },
      });
      grouped.forEach((g) => {
        if (g.AuthorityMasterSid != null) {
          totalLevelByMaster.set(g.AuthorityMasterSid, g._count.AuthorityDetailSid);
        }
      });
    }

    // Approver detail rows per authority-master (for logOnly finalized detection):
    // which AuthorityDetailSids belong to the menu and which are the final authority.
    const masterDetail = new Map<number, { detailSids: number[]; finalSids: Set<number> }>();
    if (masterSids.length) {
      const mds = await this._db.authorityDetail.findMany({
        where: { AuthorityMasterSid: { in: masterSids }, status: statusWhereClause },
        select: { AuthorityDetailSid: true, AuthorityMasterSid: true, FinalAuthority: true },
      });
      for (const md of mds) {
        if (md.AuthorityMasterSid == null) continue;
        const entry = masterDetail.get(md.AuthorityMasterSid) || { detailSids: [], finalSids: new Set<number>() };
        entry.detailSids.push(md.AuthorityDetailSid);
        if (md.FinalAuthority === 'Y') entry.finalSids.add(md.AuthorityDetailSid);
        masterDetail.set(md.AuthorityMasterSid, entry);
      }
    }

    // 2. Scan each menu's table and subtract already-acted / finalized documents.
    const rows: any[] = [];
    const branchSids = new Set<number>();
    const departmentSids = new Set<number>();

    for (const ctx of menuContexts) {
      const src = ctx.source;
      const delegate = (this._db as any)[src.model];
      if (!delegate) continue;

      const where: any = {
        [src.softDeleteField]: statusWhereClause,
        [src.companyField]: companyMasterSid,
      };
      if (branchMasterSid) where[src.branchField] = branchMasterSid;
      if (departmentFilter) where[src.departmentField] = departmentFilter;
      // Only list documents that actually belong to this authority rule's menu, so a
      // document filed under another menu (e.g. an Air-Waybill House Job) is not shown
      // here and always resolves to real approvers in the details view.
      if (src.menuMasterField) where[src.menuMasterField] = ctx.menuMasterSid;

      if (src.pendingMode === 'statusField' && src.statusField) {
        // Pending = NOT finalized. Includes NULL (fresh doc, no log yet) and
        // Pending/Open/WaitingForFinalApproval; excludes Approved/Rejected.
        where.OR = [
          { [src.statusField]: null },
          { [src.statusField]: { notIn: [ApprovalStatus.Approved, ApprovalStatus.Rejected] } },
        ];
      } else {
        // logOnly (Master Job / Voucher): no status column. Restrict vouchers to
        // this menu's non-auto-posting types and to unposted rows.
        if (src.postStatusField && src.postStatusPendingValue) {
          where[src.postStatusField] = src.postStatusPendingValue;
        }
        if (src.voucherTypeMenuScope) {
          const vts = await this._db.voucherTypeMaster.findMany({
            where: {
              MenuMasterSid: ctx.menuMasterSid,
              status: 'A',
              NOT: { IsAutoPosting: 'Y' },
            },
            select: { VoucherTypeMasterSid: true },
          });
          const vtSids = vts.map((v) => v.VoucherTypeMasterSid);
          if (!vtSids.length) continue; // nothing scannable for this menu
          where.VoucherTypeMasterSid = { in: vtSids };
        }
      }

      // Build a precise select from the registry field names.
      const select: any = {
        [src.primaryKey]: true,
        [src.branchField]: true,
        [src.departmentField]: true,
        [src.submittedByField]: true,
        [src.submittedDateField]: true,
      };
      if (src.statusField) select[src.statusField] = true;
      src.docNoFields.forEach((f) => (select[f] = true));
      if (src.customerNameField) select[src.customerNameField] = true;
      if (src.customerSidField) select[src.customerSidField] = true;

      let docs: any[] = [];
      try {
        docs = await delegate.findMany({ where, select });
      } catch (err) {
        this.logger.warn(`Pending scan failed for model ${src.model}: ${err}`);
        continue;
      }
      if (!docs.length) continue;

      const docSids = docs.map((d) => d[src.primaryKey]);

      // Determine which docs to hide. This runs for EVERY mode (including the header
      // docs) because AuthorityLog is the source of truth: a document can be fully
      // approved in AuthorityLog while its own authorizerStatus column is still stale
      // (e.g. approved via the older authority-log modal / a "final authorizer directly
      // approved" path that never flipped the column). We hide a document when it is
      // finalized (final authority approved, or any rejection) OR already acted on by me.
      const actedSet = new Set<number>();
      const finalizedSet = new Set<number>();
      {
        const detail = ctx.authorityMasterSid ? masterDetail.get(ctx.authorityMasterSid) : undefined;
        const menuDetailSids = detail?.detailSids || [ctx.authorityDetailSid];
        const finalSids = detail?.finalSids || new Set<number>();
        const logs = await this._db.authorityLog.findMany({
          where: {
            DocumentSid: { in: docSids },
            Status: 'A',
            AuthorityDetailSid: { in: menuDetailSids },
          },
          select: { DocumentSid: true, AuthorityDetailSid: true, ApprovalStatus: true },
        });
        for (const l of logs) {
          if (l.AuthorityDetailSid === ctx.authorityDetailSid) actedSet.add(l.DocumentSid);
          const isFinalApproved = finalSids.has(l.AuthorityDetailSid) && l.ApprovalStatus === ApprovalStatus.Approved;
          if (isFinalApproved || l.ApprovalStatus === ApprovalStatus.Rejected) finalizedSet.add(l.DocumentSid);
        }
      }

      for (const doc of docs) {
        const docSid = doc[src.primaryKey];
        if (actedSet.has(docSid) || finalizedSet.has(docSid)) continue;

        const docNo =
          src.docNoFields.map((f) => doc[f]).find((v) => v !== null && v !== undefined && v !== '') || '';
        const branchSid = doc[src.branchField];
        const deptSid = doc[src.departmentField];
        if (branchSid) branchSids.add(branchSid);
        if (deptSid) departmentSids.add(deptSid);

        rows.push({
          MenuMasterSid: ctx.menuMasterSid,
          MenuName: ctx.menuName, // Form Name
          DocumentSid: docSid, // Transaction id (internal)
          DocumentNo: String(docNo), // Transaction id (display)
          CustomerName: src.customerNameField ? doc[src.customerNameField] || '' : '',
          CustomerMasterSid: src.customerSidField ? doc[src.customerSidField] ?? null : null,
          BranchMasterSid: branchSid ?? null,
          LocationName: '', // filled after branch lookup
          DepartmentMasterSid: deptSid ?? null,
          DepartmentName: '', // filled after department lookup
          SubmittedBy: doc[src.submittedByField] || '',
          SubmittedDate: doc[src.submittedDateField] || null,
          ApprovalLevel: ctx.authorityLevel,
          TotalLevels: ctx.authorityMasterSid
            ? totalLevelByMaster.get(ctx.authorityMasterSid) || ctx.authorityLevel
            : ctx.authorityLevel,
          CurrentStatus: (src.statusField ? doc[src.statusField] : null) || 'Pending',
          AuthorityDetailSid: ctx.authorityDetailSid,
          // Route resolved by MENU name (several menus share one table but open
          // different screens); falls back to the source's default link pattern.
          authorizeLink:
            resolveMenuRoute(ctx.menuName, docSid) ||
            (src.linkPattern ? src.linkPattern.replace('{id}', String(docSid)) : ''),
        });
      }
    }

    // 3. Resolve branch + department names in one batch each.
    if (branchSids.size) {
      const branches = await this._db.branchMaster.findMany({
        where: { BranchMasterSid: { in: Array.from(branchSids) } },
        select: { BranchMasterSid: true, branchName: true },
      });
      const bMap = new Map(branches.map((b) => [b.BranchMasterSid, b.branchName]));
      rows.forEach((r) => (r.LocationName = r.BranchMasterSid ? bMap.get(r.BranchMasterSid) || '' : ''));
    }
    if (departmentSids.size) {
      const depts = await this._db.departmentMaster.findMany({
        where: { DepartmentMasterSid: { in: Array.from(departmentSids) } },
        select: { DepartmentMasterSid: true, departmentName: true },
      });
      const dMap = new Map(depts.map((d) => [d.DepartmentMasterSid, d.departmentName]));
      rows.forEach(
        (r) => (r.DepartmentName = r.DepartmentMasterSid ? dMap.get(r.DepartmentMasterSid) || '' : ''),
      );
    }

    // 4. Waiting days + date-range filter + free-text search.
    const now = Date.now();
    let result = rows.map((r) => {
      const submitted = r.SubmittedDate ? new Date(r.SubmittedDate).getTime() : null;
      const waitingDays = submitted ? Math.max(0, Math.floor((now - submitted) / 86400000)) : null;
      return { ...r, WaitingDays: waitingDays };
    });

    if (dateFrom) result = result.filter((r) => r.SubmittedDate && new Date(r.SubmittedDate) >= dateFrom);
    if (dateTo) result = result.filter((r) => r.SubmittedDate && new Date(r.SubmittedDate) <= dateTo);

    if (search) {
      result = result.filter((r) =>
        [r.MenuName, r.DocumentNo, r.CustomerName, r.SubmittedBy, r.LocationName, r.DepartmentName]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(search)),
      );
    }

    // 5. Newest first (descending by submitted date), then paginate.
    result.sort((a, b) => {
      const da = a.SubmittedDate ? new Date(a.SubmittedDate).getTime() : 0;
      const db = b.SubmittedDate ? new Date(b.SubmittedDate).getTime() : 0;
      if (db !== da) return db - da;
      // Tie-breaker: newest document first for a stable, fully-descending order.
      return (b.DocumentSid || 0) - (a.DocumentSid || 0);
    });

    const totalCount = result.length;
    const skip = (page - 1) * pageSize;
    const items = result.slice(skip, skip + pageSize);

    return { items, totalCount };
  }

  // ── Approval timeline for one document (View) ─────────────────────────────
  async getApprovalDetails(
    menuMasterSid: number,
    documentSid: number,
    companyMasterSid?: number,
    branchMasterSid?: number,
    departmentMasterSid?: number,
  ) {
    return this.authorityService.getApprovalStatusData(
      menuMasterSid,
      documentSid,
      companyMasterSid,
      branchMasterSid,
      departmentMasterSid,
    );
  }

  // ── Single approve / reject (reuses existing engine) ──────────────────────
  async decide(payload: ApproveDocumentDto, decision: 'Approved' | 'Rejected') {
    const result = await this.authorityService.authorizeDocument({
      ...payload,
      decision,
    });

    // On a terminal outcome, flip the document header so it leaves the pending
    // list for everyone. Best-effort: never let this break the recorded approval.
    await this.syncHeaderStatus(
      Number(payload.MenuMasterSid),
      Number(payload.DocumentSid),
      decision,
      result?.status,
    );

    return result;
  }

  // ── Bulk approve / reject (one per doc; collects per-doc failures) ─────────
  async bulkDecide(payload: BulkApproveDto, decision: 'Approved' | 'Rejected') {
    const items = payload.items || [];
    if (!items.length) throw new BadRequestException('No documents selected.');

    const approved: any[] = [];
    const failed: { DocumentSid: number; MenuMasterSid: number; reason: string }[] = [];

    for (const item of items) {
      try {
        const single: ApproveDocumentDto = {
          UserMasterSid: payload.UserMasterSid,
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          MenuMasterSid: item.MenuMasterSid,
          DocumentSid: item.DocumentSid,
          DepartmentMasterSid: item.DepartmentMasterSid,
          Remarks: payload.Remarks,
          ApprovedBy: payload.ApprovedBy,
        };
        await this.decide(single, decision);
        approved.push({ DocumentSid: item.DocumentSid, MenuMasterSid: item.MenuMasterSid });
      } catch (err: any) {
        failed.push({
          DocumentSid: item.DocumentSid,
          MenuMasterSid: item.MenuMasterSid,
          reason: err?.message || 'Failed',
        });
      }
    }

    return { approvedCount: approved.length, failedCount: failed.length, approved, failed };
  }

  // ── Auto approval (config-driven, System actor) ───────────────────────────
  async autoApprove(payload: AutoApproveDto) {
    const menuMasterSid = Number(payload.MenuMasterSid);
    const documentSid = Number(payload.DocumentSid);
    const companyMasterSid = Number(payload.CompanyMasterSid);
    const branchMasterSid = Number(payload.BranchMasterSid);
    if (!menuMasterSid || !documentSid || !companyMasterSid || !branchMasterSid) {
      throw new BadRequestException('Menu, document, company and branch are required.');
    }

    const enabled = await this.isAutoApprovalEnabled(companyMasterSid, menuMasterSid);
    if (!enabled) {
      return { autoApproved: false, message: 'Auto approval is not enabled for this menu/company.' };
    }

    // Approve on behalf of the FINAL authority so the whole chain is satisfied.
    const finalAuthority = await this._db.authorityDetail.findFirst({
      where: {
        status: 'A',
        CompanyMasterSid: companyMasterSid,
        BranchMasterSid: branchMasterSid,
        FinalAuthority: 'Y',
        authorityMaster: {
          status: 'A',
          MenuMaster: menuMasterSid,
          CompanyMasterSid: companyMasterSid,
          BranchMasterSid: branchMasterSid,
        },
      },
      select: { AuthorityDetailSid: true },
    });

    if (!finalAuthority) {
      return { autoApproved: false, message: 'No final authority configured for this menu.' };
    }

    await this._db.authorityLog.create({
      data: {
        CompanyMasterSid: companyMasterSid,
        BranchMasterSid: branchMasterSid,
        AuthorityDetailSid: finalAuthority.AuthorityDetailSid,
        AuthorisedDate: new Date(),
        ApprovalStatus: ApprovalStatus.Approved,
        DocumentSid: documentSid,
        Remarks: 'Auto approved by System',
        CreatedBy: 'System',
        UpdatedBy: 'System',
        Status: 'A',
      },
    });

    await this.syncHeaderStatus(menuMasterSid, documentSid, 'Approved', 'Approved');

    return { autoApproved: true, message: 'Document auto approved by System.' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Flip the source document's own status column on a terminal decision so it
   * disappears from the pending list for everyone. Rejection is always terminal;
   * approval is terminal only when the final authority has approved (status
   * comes back 'Approved' from getApprovalStatusData). Best-effort by design.
   */
  private async syncHeaderStatus(
    menuMasterSid: number,
    documentSid: number,
    decision: 'Approved' | 'Rejected',
    overallStatus?: string,
  ) {
    const terminal = decision === 'Rejected' || overallStatus === 'Approved';
    if (!terminal) return;

    const source = await this.resolveDocSourceByMenuSid(menuMasterSid);
    if (!source) return;
    // logOnly documents (Master Job / Voucher) have no header status column to flip;
    // their "disappearance" is driven purely by the AuthorityLog they now carry.
    if (!source.statusField) return;
    const statusField = source.statusField;

    const delegate = (this._db as any)[source.model];
    if (!delegate) return;

    try {
      await delegate.update({
        where: { [source.primaryKey]: documentSid },
        data: { [statusField]: decision as ApprovalStatus },
      });
    } catch (err) {
      this.logger.warn(
        `syncHeaderStatus failed (menu ${menuMasterSid}, doc ${documentSid}): ${err}`,
      );
    }
  }

  private async resolveDocSourceByMenuSid(menuMasterSid: number): Promise<ApprovalDocSource | undefined> {
    const menu = await this._db.menuMaster.findUnique({
      where: { MenuMasterSid: menuMasterSid },
      select: { MenuName: true, menuConfig: { select: { ModelName: true } } },
    });
    return resolveApprovalDocSource(menu?.MenuName, menu?.menuConfig?.[0]?.ModelName);
  }

  private async isAutoApprovalEnabled(companyMasterSid: number, menuMasterSid: number): Promise<boolean> {
    const configs = await this._db.companyConfiguration.findMany({
      where: {
        CompanyMasterSid: companyMasterSid,
        Status: 'A',
        ConfigurationName: { in: ['AUTO_APPROVAL', `AUTO_APPROVAL_MENU_${menuMasterSid}`] },
      },
      select: { ConfigurationName: true, ConfigurationValue: true },
    });
    const truthy = (v?: string) => ['y', 'yes', 'true', '1'].includes(String(v || '').trim().toLowerCase());
    // Per-menu config wins if present; else fall back to the company-wide flag.
    const perMenu = configs.find((c) => c.ConfigurationName === `AUTO_APPROVAL_MENU_${menuMasterSid}`);
    if (perMenu) return truthy(perMenu.ConfigurationValue);
    const global = configs.find((c) => c.ConfigurationName === 'AUTO_APPROVAL');
    return global ? truthy(global.ConfigurationValue) : false;
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { JournalVoucherService } from '../journal-voucher/journal-voucher.service';
import { VoucherService } from '../voucher/voucher.service';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import {
  interBranchStrategyFor,
  ResolvedBranchAllocation,
} from './strategies/inter-branch.strategy';

/** Shape the frontend posts to stage inter-branch allocations before the source voucher is posted. */
export interface StageAllocationsPayload {
  CompanyMasterSid: number;
  BranchMasterSid: number; // source branch
  VoucherHeaderSid: number; // source receipt/payment voucher
  CreatedBy: string;
  CurrencyCode: string;
  ExchangeRate: number;
  allocations: Array<{
    AllotmentBranchSid: number;
    CurrencyAmount: number;
    LocalAmount: number;
    /** Owning-branch invoices the user matched in the multi-branch matching grid. */
    matches?: Array<{
      VoucherHeaderSid: number;
      VoucherDetailSid: number;
      VoucherTransactionSid: number;
      VoucherType: string; // doc type code of the invoice (e.g. 'INV','VIN')
      BranchName?: string;
      CurrencyCode: string;
      ExchangeRate: number;
      DrCr: string;
      Amount: number;
      LocalAmount: number;
      MatchingAmount: number;
      MatchingLocalAmount: number;
      PartyAmount?: number;
      MatchingCurrency?: number;
    }>;
  }>;
}

@Injectable()
export class InterBranchService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly journalVoucherService: JournalVoucherService,
    private readonly voucherService: VoucherService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // STAGING (called on Save, before posting)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Upsert the staged inter-branch allocations + owning-branch matching rows for a source voucher.
   * Rule (R3): update existing rows, insert new ones, delete ONLY rows the user genuinely removed —
   * never delete-all + recreate (that churns the sequence PKs).
   */
  async stageAllocations(payload: StageAllocationsPayload): Promise<{ staged: number }> {
    return this._db.$transaction(async (tx) => {
      const incomingBranchSids = (payload.allocations || []).map((a) => a.AllotmentBranchSid);

      // Remove only allocations/matches for owning branches the user dropped.
      await tx.voucherInterBranch.deleteMany({
        where: {
          VoucherHeaderSid: payload.VoucherHeaderSid,
          ...(incomingBranchSids.length ? { AllotmentBranchSid: { notIn: incomingBranchSids } } : {}),
        },
      });
      await tx.matchingDetail.deleteMany({
        where: {
          SourceVoucherHeaderSid: payload.VoucherHeaderSid,
          AllotmentBranchSid: { not: null },
          VoucherMatchingHeaderSid: null, // only unposted staging
          ...(incomingBranchSids.length ? { AllotmentBranchSid: { notIn: incomingBranchSids } } : {}),
        },
      });

      let staged = 0;
      for (const a of payload.allocations || []) {
        // Upsert the allocation by (VoucherHeaderSid, AllotmentBranchSid).
        const existing = await tx.voucherInterBranch.findFirst({
          where: { VoucherHeaderSid: payload.VoucherHeaderSid, AllotmentBranchSid: a.AllotmentBranchSid },
          select: { VoucherInterBranchSid: true },
        });
        if (existing) {
          await tx.voucherInterBranch.update({
            where: { VoucherInterBranchSid: existing.VoucherInterBranchSid },
            data: {
              CurrencyAmount: a.CurrencyAmount,
              LocalAmount: a.LocalAmount,
              UpdatedBy: payload.CreatedBy,
              UpdatedOn: new Date(),
            },
          });
        } else {
          await tx.voucherInterBranch.create({
            data: {
              CompanyMasterSid: payload.CompanyMasterSid,
              BranchMasterSid: payload.BranchMasterSid,
              VoucherHeaderSid: payload.VoucherHeaderSid,
              AllotmentBranchSid: a.AllotmentBranchSid,
              CurrencyAmount: a.CurrencyAmount,
              LocalAmount: a.LocalAmount,
              CreatedBy: payload.CreatedBy,
              UpdatedBy: payload.CreatedBy,
            },
          });
        }
        staged++;

        // Upsert this branch's matches by VoucherTransactionSid (delete only those removed).
        const incomingTxnSids = (a.matches || []).map((m) => m.VoucherTransactionSid);
        const existingMatches = await tx.matchingDetail.findMany({
          where: {
            SourceVoucherHeaderSid: payload.VoucherHeaderSid,
            AllotmentBranchSid: a.AllotmentBranchSid,
            VoucherMatchingHeaderSid: null,
          },
          select: { MatchingDetailSid: true, VoucherTransactionSid: true },
        });
        const existingByTxn = new Map(existingMatches.map((m) => [m.VoucherTransactionSid, m.MatchingDetailSid]));

        const removedSids = existingMatches
          .filter((m) => !incomingTxnSids.includes(m.VoucherTransactionSid))
          .map((m) => m.MatchingDetailSid);
        if (removedSids.length) {
          await tx.matchingDetail.deleteMany({ where: { MatchingDetailSid: { in: removedSids } } });
        }

        let sno = 1;
        for (const m of a.matches || []) {
          const data = {
            Sno: sno++,
            BranchName: m.BranchName,
            VoucherHeaderSid: m.VoucherHeaderSid,
            VoucherDetailSid: m.VoucherDetailSid,
            VoucherTransactionSid: m.VoucherTransactionSid,
            VoucherType: m.VoucherType,
            CurrencyCode: m.CurrencyCode,
            ExchangeRate: m.ExchangeRate,
            DrCr: m.DrCr,
            Amount: m.Amount,
            LocalAmount: m.LocalAmount,
            MatchingAmount: m.MatchingAmount,
            MatchingLocalAmount: m.MatchingLocalAmount,
            PartyAmount: m.PartyAmount,
            MatchingCurrency: m.MatchingCurrency,
            SourceVoucherHeaderSid: payload.VoucherHeaderSid,
            AllotmentBranchSid: a.AllotmentBranchSid,
          };
          const existingSid = existingByTxn.get(m.VoucherTransactionSid);
          if (existingSid) {
            await tx.matchingDetail.update({
              where: { MatchingDetailSid: existingSid },
              data: { ...data, UpdatedBy: payload.CreatedBy, UpdatedOn: new Date() },
            });
          } else {
            await tx.matchingDetail.create({ data: { ...data, CreatedBy: payload.CreatedBy } });
          }
        }
      }
      return { staged };
    });
  }

  /**
   * Read allocations + their owning-branch matches for re-opening a voucher.
   * - DRAFT: re-tick targets come from the staged `MatchingDetail` (the frontend fetches the owning
   *   outstanding and re-ticks these).
   * - POSTED: the matched owning invoices are fully paid → excluded from the outstanding fetch, so we
   *   read the actual matches from the posted `VoucherMatching` (JV② mirror) and return them as full
   *   rows for the frontend to render directly. Each allocation carries a `posted` flag.
   */
  async getAllocations(voucherHeaderSid: number) {
    const rows = await this._db.voucherInterBranch.findMany({
      where: { VoucherHeaderSid: voucherHeaderSid },
      include: {
        allotmentBranch: { select: { branchName: true } },
        mirrorJV: { select: { VoucherNumber: true } },
        sourceJV: { select: { VoucherNumber: true } },
        sourceVoucher: { select: { PartyMasterSid: true, CurrencyMasterSid: true, CurrencyCode: true, ExchangeRate: true, PostStatus: true } },
      },
      orderBy: { VoucherInterBranchSid: 'asc' },
    });

    const isPosted = rows[0]?.sourceVoucher?.PostStatus === 'P';
    const matchesByBranch = isPosted
      ? await this.getPostedOwningMatches(rows)
      : await this.getStagedOwningMatches(voucherHeaderSid);

    return rows.map((r) => ({ ...r, posted: isPosted, matches: matchesByBranch.get(r.AllotmentBranchSid) ?? [] }));
  }

  /** Draft: re-tick targets are the staged `MatchingDetail` (VoucherMatchingHeaderSid null). */
  private async getStagedOwningMatches(voucherHeaderSid: number): Promise<Map<number, any[]>> {
    const staged = await this._db.matchingDetail.findMany({
      where: {
        SourceVoucherHeaderSid: voucherHeaderSid,
        AllotmentBranchSid: { not: null },
        VoucherMatchingHeaderSid: null,
      },
      orderBy: { Sno: 'asc' },
    });
    const byBranch = new Map<number, any[]>();
    for (const m of staged) {
      const list = byBranch.get(m.AllotmentBranchSid!) ?? [];
      list.push(m);
      byBranch.set(m.AllotmentBranchSid!, list);
    }
    return byBranch;
  }

  /**
   * Posted: read the owning matches from the JV② mirror's `VoucherMatching` pairs. The owning invoice is
   * the `Object` side; joined to `VoucherTransaction` for the row's display fields. Returns full matching
   * rows per owning branch (the frontend renders these directly — the fully-matched invoices are gone
   * from the outstanding fetch).
   */
  private async getPostedOwningMatches(rows: any[]): Promise<Map<number, any[]>> {
    const byBranch = new Map<number, any[]>();
    const jvToBranch = new Map<number, number>(); // JV② VoucherHeaderSid → owning branch
    for (const r of rows) if (r.InterBranchVoucherSid) jvToBranch.set(r.InterBranchVoucherSid, r.AllotmentBranchSid);
    if (!jvToBranch.size) return byBranch;

    const headers = await this._db.voucherMatchingHeader.findMany({
      where: { VoucherHeaderSid: { in: [...jvToBranch.keys()] } },
      select: { VoucherMatchingHeaderSid: true, VoucherHeaderSid: true },
    });
    const headerToBranch = new Map<number, number>();
    for (const h of headers) {
      if (h.VoucherHeaderSid == null) continue;
      const branch = jvToBranch.get(h.VoucherHeaderSid);
      if (branch != null) headerToBranch.set(h.VoucherMatchingHeaderSid, branch);
    }
    if (!headerToBranch.size) return byBranch;

    const objectMatches = await this._db.voucherMatching.findMany({
      where: { VoucherMatchingHeaderSid: { in: [...headerToBranch.keys()] }, MatchingType: 'Object', Status: 'A' },
      orderBy: { VoucherMatchingSid: 'asc' },
    });
    if (!objectMatches.length) return byBranch;

    const txns = await this._db.voucherTransaction.findMany({
      where: { VoucherTransactionSid: { in: objectMatches.map((m) => m.VoucherTransactionSid) } },
      select: {
        VoucherTransactionSid: true,
        VoucherNumber: true,
        VoucherDate: true,
        VoucherTypeMasterSid: true,
        voucherTypeMaster: { select: { DocumentTypeCode: true } },
        LedgerMasterSid: true,
        COAMasterSid: true,
        Amount: true,
        LocalAmount: true,
        BranchMaster: { select: { branchName: true } },
      },
    });
    const txnById = new Map(txns.map((t) => [t.VoucherTransactionSid, t as any]));

    for (const m of objectMatches) {
      const branchSid = headerToBranch.get(m.VoucherMatchingHeaderSid!);
      if (branchSid == null) continue;
      const t = txnById.get(m.VoucherTransactionSid);
      const match = {
        VoucherTransactionSid: m.VoucherTransactionSid,
        VoucherHeaderSid: m.VoucherHeaderSid,
        VoucherDetailSid: m.VoucherDetailSid,
        VoucherNumber: t?.VoucherNumber,
        VoucherType: t?.voucherTypeMaster?.DocumentTypeCode,
        VoucherTypeMasterSid: t?.VoucherTypeMasterSid,
        VoucherDate: t?.VoucherDate,
        LedgerMasterSid: t?.LedgerMasterSid,
        COAMasterSid: t?.COAMasterSid,
        DrCr: m.DrCr,
        CurrencyCode: m.CurrencyCode,
        ExchangeRate: m.ExchangeRate,
        OriginalCurrencyAmount: t?.Amount,
        OriginalLocalAmount: t?.LocalAmount,
        OutstandingCurrencyAmount: m.Amount,
        OutstandingLocalAmount: m.LocalAmount,
        MatchingAmount: m.Amount,
        MatchingLocalAmount: m.LocalAmount,
        PartyAmount: m.Amount,
        BranchName: t?.BranchMaster?.branchName,
      };
      const list = byBranch.get(branchSid) ?? [];
      list.push(match);
      byBranch.set(branchSid, list);
    }
    return byBranch;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POSTING (called from executePostReceipt / executePostPayment, same tx)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * On posting a MultiBranch receipt/payment, create the source re-allocation JV (JV①) and one mirror
   * JV per owning branch (JV②, type IJV), then match each mirror JV's party lines against the
   * owning-branch invoices. Runs inside the caller's transaction.
   */
  async postInterBranch(
    ctx: {
      source: any; // loaded VoucherHeader (with VoucherDetail, voucherTypeMaster, subledgerMaster)
      companyMasterSid: number;
      branchMasterSid: number; // source branch
      yearMasterSid: number;
      localCurrencyMasterSid: number;
      localCurrencyCode: string;
      postedBy: string;
      taxDetails: any;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { source } = ctx;
    if (source?.MultiBranch !== 'Y') return;

    const vibs = await tx.voucherInterBranch.findMany({
      where: { VoucherHeaderSid: source.VoucherHeaderSid },
      orderBy: { VoucherInterBranchSid: 'asc' },
    });
    if (!vibs.length) return;

    const docTypeCode: string = source.voucherTypeMaster?.DocumentTypeCode;
    const strategy = interBranchStrategyFor(docTypeCode);
    const docWord = strategy.partySign === 'C' ? 'receipt' : 'payment';
    const partyName = source.PartyName || 'party';

    const partyCOAMasterSid = source.COAMasterSid;
    const partyLedgerMasterSid = source.PartyMasterSid;
    if (!partyCOAMasterSid || !partyLedgerMasterSid) {
      throw new BadRequestException('Inter-branch: source voucher has no party ledger to re-allocate.');
    }

    // Branch names for human-readable narrations.
    const branchRows = await tx.branchMaster.findMany({
      where: { BranchMasterSid: { in: [source.BranchMasterSid, ...vibs.map((v) => v.AllotmentBranchSid)] } },
      select: { BranchMasterSid: true, branchName: true },
    });
    const branchNameMap = new Map(branchRows.map((b) => [b.BranchMasterSid, b.branchName]));
    const sourceBranchName = branchNameMap.get(source.BranchMasterSid) || `branch ${source.BranchMasterSid}`;
    const owningNames = vibs
      .map((v) => branchNameMap.get(v.AllotmentBranchSid) || `branch ${v.AllotmentBranchSid}`)
      .join(', ');

    // Resolve the bridge ledgers + matched/advance split for each owning branch.
    const resolved: ResolvedBranchAllocation[] = [];
    const matchesByBranch = new Map<number, any[]>();

    for (const vib of vibs) {
      const bridgeForOwningCOA = await this.resolveBridgeLedger(ctx.companyMasterSid, vib.AllotmentBranchSid, tx);
      const bridgeForSourceCOA = await this.resolveBridgeLedger(ctx.companyMasterSid, source.BranchMasterSid, tx);

      const branchMatches = await tx.matchingDetail.findMany({
        where: {
          SourceVoucherHeaderSid: source.VoucherHeaderSid,
          AllotmentBranchSid: vib.AllotmentBranchSid,
          VoucherMatchingHeaderSid: null,
        },
        orderBy: { Sno: 'asc' },
      });
      matchesByBranch.set(vib.AllotmentBranchSid, branchMatches);

      const matched = branchMatches.map((m) => ({
        currencyAmount: this.num(m.MatchingAmount),
        localAmount: this.num(m.MatchingLocalAmount),
      }));
      const matchedCurrency = matched.reduce((s, m) => s + m.currencyAmount, 0);
      const matchedLocal = matched.reduce((s, m) => s + m.localAmount, 0);
      const advanceCurrency = this.round(this.num(vib.CurrencyAmount) - matchedCurrency);
      const advanceLocal = this.round(this.num(vib.LocalAmount) - matchedLocal);

      resolved.push({
        allotmentBranchSid: vib.AllotmentBranchSid,
        allotmentBranchName: branchNameMap.get(vib.AllotmentBranchSid) || undefined,
        bridgeForOwningCOA,
        bridgeForSourceCOA,
        currencyAmount: this.num(vib.CurrencyAmount),
        localAmount: this.num(vib.LocalAmount),
        matched,
        advanceCurrency: advanceCurrency > 0 ? advanceCurrency : 0,
        advanceLocal: advanceLocal > 0 ? advanceLocal : 0,
      });
    }

    const plan = strategy.buildEntryPlan({ partyCOAMasterSid, partyLedgerMasterSid, sourceBranchName, partyName, branches: resolved });

    const exRate = this.num(source.ExchangeRate) || 1;
    const postingInfo = {
      LocalCurrencyMasterSid: ctx.localCurrencyMasterSid,
      LocalCurrencyCode: ctx.localCurrencyCode,
      TaxDetails: ctx.taxDetails,
    };

    // ── JV① — source re-allocation JV (booked in the source branch) ──
    const jv1 = await this.journalVoucherService.createJournalVoucher(
      {
        DocumentTypeCode: DOC_TYPE_CODE.INTER_BRANCH_JV,
        CompanyMasterSid: ctx.companyMasterSid,
        BranchMasterSid: source.BranchMasterSid,
        VoucherDate: source.VoucherDate,
        PostDate: source.PostDate || new Date(),
        Narration: `Inter-branch re-allocation of ${docWord} ${source.VoucherNumber} (${sourceBranchName} → ${owningNames})`,
        PartyMasterSid: partyLedgerMasterSid,
        PartyName: source.PartyName,
        YearMasterSid: ctx.yearMasterSid,
        CurrencyMasterSid: source.CurrencyMasterSid,
        CurrencyCode: source.CurrencyCode,
        ExchangeRate: exRate,
        Amount: plan.sourceJv.totalCurrency,
        LocalAmount: plan.sourceJv.totalLocal,
        PostStatus: 'U',
        CreatedBy: ctx.postedBy,
        PostingInfo: postingInfo,
        VoucherDetail: plan.sourceJv.lines.map((l) => this.toJvDetail(l, source, exRate, ctx.yearMasterSid)),
      },
      tx,
    );

    // Write JV① back to every staging row for this voucher.
    await tx.voucherInterBranch.updateMany({
      where: { VoucherHeaderSid: source.VoucherHeaderSid },
      data: { SourceJVHeaderSid: jv1.VoucherHeaderSid, UpdatedBy: ctx.postedBy, UpdatedOn: new Date() },
    });

    // Match the source receipt/payment's party line against JV①'s party line for Σ allocated. The
    // remainder stays as the source advance — the source voucher is NOT split (just partially matched).
    await this.matchSourceAgainstSourceJv(
      jv1.VoucherHeaderSid,
      source,
      partyLedgerMasterSid,
      plan.sourceJv.totalCurrency,
      plan.sourceJv.totalLocal,
      strategy.partySign,
      ctx,
      tx,
    );

    // ── JV② — one mirror JV per owning branch (booked in that owning branch) ──
    for (const mirror of plan.mirrorJvs) {
      const vib = vibs.find((v) => v.AllotmentBranchSid === mirror.allotmentBranchSid)!;
      const owningBr = branchNameMap.get(mirror.allotmentBranchSid) || `branch ${mirror.allotmentBranchSid}`;
      const jv2 = await this.journalVoucherService.createJournalVoucher(
        {
          DocumentTypeCode: DOC_TYPE_CODE.INTER_BRANCH_JV,
          CompanyMasterSid: ctx.companyMasterSid,
          BranchMasterSid: mirror.allotmentBranchSid,
          VoucherDate: source.VoucherDate,
          PostDate: source.PostDate || new Date(),
          Narration: `Inter-branch ${docWord} mirror of ${source.VoucherNumber} — ${owningBr} (from ${sourceBranchName})`,
          PartyMasterSid: partyLedgerMasterSid,
          PartyName: source.PartyName,
          YearMasterSid: ctx.yearMasterSid,
          CurrencyMasterSid: source.CurrencyMasterSid,
          CurrencyCode: source.CurrencyCode,
          ExchangeRate: exRate,
          Amount: this.num(vib.CurrencyAmount),
          LocalAmount: this.num(vib.LocalAmount),
          PostStatus: 'U',
          CreatedBy: ctx.postedBy,
          PostingInfo: postingInfo,
          VoucherDetail: mirror.lines.map((l) => this.toJvDetail(l, source, exRate, ctx.yearMasterSid)),
        },
        tx,
      );

      await tx.voucherInterBranch.update({
        where: { VoucherInterBranchSid: vib.VoucherInterBranchSid },
        data: { InterBranchVoucherSid: jv2.VoucherHeaderSid, UpdatedBy: ctx.postedBy, UpdatedOn: new Date() },
      });

      // Match JV②'s party MATCHING lines against the owning-branch invoices.
      const branchMatches = matchesByBranch.get(mirror.allotmentBranchSid) || [];
      if (branchMatches.length) {
        await this.matchMirrorAgainstInvoices(jv2.VoucherHeaderSid, mirror.allotmentBranchSid, branchMatches, ctx, tx);
      }
    }
  }

  /**
   * Pair the mirror JV's posted party lines with the existing owning-branch invoices via the shared
   * VoucherMatching engine — mirrors how receipt.service builds its createVoucherMatching payload.
   * NOTE: integration-test against voucher.service.createVoucherMatching (the most coupled step).
   */
  private async matchMirrorAgainstInvoices(
    mirrorJvHeaderSid: number,
    owningBranchSid: number,
    branchMatches: any[],
    ctx: { companyMasterSid: number; yearMasterSid: number; postedBy: string; localCurrencyMasterSid: number },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const jv2 = await tx.voucherHeader.findUnique({
      where: { VoucherHeaderSid: mirrorJvHeaderSid },
      include: {
        voucherTypeMaster: true,
        VoucherDetail: { where: { Status: 'A' }, orderBy: { Sno: 'asc' } },
      },
    });
    if (!jv2) return;

    // JV②'s party lines (LedgerMasterSid set) become the "source" side of the matching.
    const partyDetails = (jv2.VoucherDetail || []).filter((d) => d.LedgerMasterSid != null);

    // Build the bill (invoice) side from the staged owning-branch matches + their posted transactions.
    const txnSids = branchMatches.map((m) => m.VoucherTransactionSid);
    const invoiceTxns = await tx.voucherTransaction.findMany({ where: { VoucherTransactionSid: { in: txnSids } } });
    const txnById = new Map(invoiceTxns.map((t) => [t.VoucherTransactionSid, t]));

    const voucherMatching = branchMatches.map((m) => {
      const t = txnById.get(m.VoucherTransactionSid);
      return {
        VoucherHeaderSid: m.VoucherHeaderSid,
        VoucherDetailSid: m.VoucherDetailSid,
        VoucherTransactionSid: m.VoucherTransactionSid,
        VoucherType: t?.VoucherTypeMasterSid,
        COAMasterSid: t?.COAMasterSid,
        LedgerMasterSid: t?.LedgerMasterSid,
        CurrencyCode: m.CurrencyCode,
        ExchangeRate: this.num(m.ExchangeRate) || 1,
        DrCr: m.DrCr,
        Amount: this.num(m.MatchingAmount),
        LocalAmount: this.num(m.MatchingLocalAmount),
        PartyAmount: this.num(m.PartyAmount ?? m.MatchingAmount),
        MatchingCurrency: m.MatchingCurrency ?? null,
      };
    });

    await this.voucherService.createVoucherMatching(
      {
        CompanyMasterSid: ctx.companyMasterSid,
        BranchMasterSid: owningBranchSid,
        VoucherHeaderSid: mirrorJvHeaderSid,
        SubledgerName: '',
        VoucherTypeCode: jv2.voucherTypeMaster?.DocumentTypeCode,
        VoucherTypeMasterSid: jv2.voucherTypeMaster?.VoucherTypeMasterSid,
        VoucherMatchingDate: jv2.VoucherDate,
        PostDate: new Date(),
        YearMasterSid: ctx.yearMasterSid,
        Narration: `Inter-branch matching for ${jv2.VoucherNumber}`,
        createdBy: ctx.postedBy,
        voucherMatching,
        partyVoucherDetail: partyDetails,
        BillMatchingCurrencyAmount: voucherMatching.reduce((s, v) => s + v.Amount, 0),
        BillMatchingLocalAmount: voucherMatching.reduce((s, v) => s + v.LocalAmount, 0),
        LocalCurrencyMasterSid: ctx.localCurrencyMasterSid,
      } as any,
      tx,
    );
  }

  /**
   * Match the source receipt/payment's party line against JV①'s party line for the allocated amount
   * (Σ allocated) — leaving the remainder as the source advance. The source voucher is NOT split, just
   * partially matched. Mirrors `matchMirrorAgainstInvoices`: JV① is the matching voucher and the source
   * voucher's posted party transaction is the single bill (DrCr is read, so RPT/PMT both work).
   */
  private async matchSourceAgainstSourceJv(
    jv1HeaderSid: number,
    source: any,
    partyLedgerMasterSid: number,
    allocatedCurrency: number,
    allocatedLocal: number,
    partySign: 'C' | 'D',
    ctx: { companyMasterSid: number; yearMasterSid: number; postedBy: string; localCurrencyMasterSid: number },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (allocatedCurrency <= 0 && allocatedLocal <= 0) return;

    // Re-load JV① fresh so the party VoucherDetail carries its posted VoucherTransactionSid (the IJV
    // auto-posts in this tx; the object returned by createJournalVoucher predates that write-back).
    const jv1 = await tx.voucherHeader.findUnique({
      where: { VoucherHeaderSid: jv1HeaderSid },
      include: {
        voucherTypeMaster: true,
        VoucherDetail: { where: { Status: 'A' }, orderBy: { Sno: 'asc' } },
      },
    });
    const partyDetails = (jv1?.VoucherDetail || []).filter((d) => d.LedgerMasterSid != null);
    if (!jv1 || !partyDetails.length) return;

    // The source receipt/payment's party transaction = the single bill matched against JV①.
    const sourceTxn = await tx.voucherTransaction.findFirst({
      where: {
        VoucherHeaderSid: source.VoucherHeaderSid,
        LedgerMasterSid: partyLedgerMasterSid,
        DrCr: partySign,
        Status: 'A',
      },
      orderBy: { Sno: 'asc' },
    });
    if (!sourceTxn) return;

    // Guard: never over-allocate (would drive the source party outstanding negative).
    const matched = await tx.voucherMatching.aggregate({
      where: { VoucherTransactionSid: sourceTxn.VoucherTransactionSid, Status: 'A' },
      _sum: { Amount: true },
    });
    const outstanding = this.round(this.num(sourceTxn.Amount) - this.num(matched._sum.Amount));
    if (outstanding < this.round(allocatedCurrency) - 0.0001) {
      throw new BadRequestException(
        `Inter-branch: ${source.VoucherNumber} has only ${outstanding} ${source.CurrencyCode || ''} left to allocate, but ${this.round(allocatedCurrency)} was requested.`,
      );
    }

    const exRate = this.num(source.ExchangeRate) || 1;
    const voucherMatching = [
      {
        VoucherHeaderSid: source.VoucherHeaderSid,
        VoucherDetailSid: sourceTxn.VoucherDetailSid,
        VoucherTransactionSid: sourceTxn.VoucherTransactionSid,
        VoucherType: sourceTxn.VoucherTypeMasterSid,
        COAMasterSid: sourceTxn.COAMasterSid,
        LedgerMasterSid: sourceTxn.LedgerMasterSid,
        CurrencyCode: source.CurrencyCode,
        ExchangeRate: exRate,
        DrCr: sourceTxn.DrCr,
        Amount: allocatedCurrency, // the allocated portion only — NOT the source txn's full amount
        LocalAmount: allocatedLocal,
        PartyAmount: allocatedCurrency,
        MatchingCurrency: source.CurrencyMasterSid ?? null,
      },
    ];

    await this.voucherService.createVoucherMatching(
      {
        CompanyMasterSid: ctx.companyMasterSid,
        BranchMasterSid: source.BranchMasterSid,
        VoucherHeaderSid: jv1HeaderSid,
        SubledgerName: '',
        VoucherTypeCode: jv1.voucherTypeMaster?.DocumentTypeCode,
        VoucherTypeMasterSid: jv1.voucherTypeMaster?.VoucherTypeMasterSid,
        VoucherMatchingDate: jv1.VoucherDate,
        PostDate: new Date(),
        YearMasterSid: ctx.yearMasterSid,
        Narration: `Inter-branch source allocation for ${source.VoucherNumber}`,
        createdBy: ctx.postedBy,
        voucherMatching,
        partyVoucherDetail: partyDetails,
        BillMatchingCurrencyAmount: allocatedCurrency,
        BillMatchingLocalAmount: allocatedLocal,
        LocalCurrencyMasterSid: ctx.localCurrencyMasterSid,
      } as any,
      tx,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  /** Find the active "Inter Branch - <branch>" ledger COA for the given location; error (with name) if missing. */
  private async resolveBridgeLedger(
    companyMasterSid: number,
    interBranchLocationSid: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const ledger = await tx.cOAMaster.findFirst({
      where: {
        CompanyMasterSid: companyMasterSid,
        LedgerType: 'Inter Branch',
        InterBranchLocation: interBranchLocationSid,
        Status: 'A',
      },
      select: { COAMasterSid: true },
    });
    if (!ledger) {
      const branch = await tx.branchMaster.findUnique({
        where: { BranchMasterSid: interBranchLocationSid },
        select: { branchName: true },
      });
      throw new BadRequestException(
        `No active 'Inter Branch' ledger configured for branch '${branch?.branchName ?? interBranchLocationSid}'. Create it in Chart of Accounts first.`,
      );
    }
    return ledger.COAMasterSid;
  }

  private toJvDetail(line: any, source: any, exRate: number, yearMasterSid: number) {
    return {
      COAMasterSid: line.COAMasterSid,
      LedgerMasterSid: line.LedgerMasterSid ?? null,
      DrCr: line.DrCr,
      Amount: line.Amount,
      LocalAmount: line.LocalAmount,
      Rate: line.Amount,
      TaxableAmount: line.Amount,
      CurrencyCode: source.CurrencyCode,
      CurrencyMasterSid: source.CurrencyMasterSid,
      ExchangeRate: exRate,
      Narration: line.Narration,
      YearMasterSid: yearMasterSid,
    };
  }

  private num(v: any): number {
    if (v === null || v === undefined) return 0;
    return typeof v === 'number' ? v : Number(v.toString());
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}

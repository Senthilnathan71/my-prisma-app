import { getPartyDrCr } from 'src/common/config/voucher-type.config';

export type DrCr = 'D' | 'C';

/** One ledger line of a generated inter-branch JV. */
export interface JvLine {
  COAMasterSid: number;
  LedgerMasterSid?: number | null;
  DrCr: DrCr;
  Amount: number; // transaction (party) currency
  LocalAmount: number; // company local currency
  Narration?: string;
}

/** A single owning-branch allocation, with its inter-branch ledger COAs + matched/advance split resolved by the service. */
export interface ResolvedBranchAllocation {
  allotmentBranchSid: number;
  allotmentBranchName?: string;
  /** "Inter Branch - <owning>" ledger COA — used in JV① (booked in the source branch). */
  bridgeForOwningCOA: number;
  /** "Inter Branch - <source>" ledger COA — used in JV② (booked in the owning branch). */
  bridgeForSourceCOA: number;
  currencyAmount: number;
  localAmount: number;
  /** Party lines matched against existing owning-branch invoices (one per invoice). */
  matched: Array<{ currencyAmount: number; localAmount: number }>;
  /** Remainder of this branch's amount booked as advance (0 if none). */
  advanceCurrency: number;
  advanceLocal: number;
}

export interface EntryPlanInput {
  /** Party ledger (COA) of the source receipt/payment — same party across all owning branches. */
  partyCOAMasterSid: number;
  partyLedgerMasterSid: number; // SubledgerMasterSid
  sourceBranchName?: string;
  partyName?: string;
  /** Instrument label for the bridge-line narration, e.g. "NEFT 678" (empty for cash). */
  instrument?: string;
  branches: ResolvedBranchAllocation[];
}

export interface SourceJvPlan {
  lines: JvLine[];
  totalCurrency: number;
  totalLocal: number;
}

export interface MirrorJvPlan {
  allotmentBranchSid: number;
  lines: JvLine[];
  /** Number of party MATCHING lines at the head of the party lines (the rest, if any, is the single ADVANCE line). */
  matchingLineCount: number;
}

export interface InterBranchPlan {
  sourceJv: SourceJvPlan;
  mirrorJvs: MirrorJvPlan[];
}

/**
 * Encapsulates the only real difference between Receipt and Payment inter-branch posting: the party DrCr sign.
 * `buildEntryPlan` is pure (no IO) so it can be unit-tested against the Excel scenarios.
 */
export abstract class InterBranchStrategy {
  abstract readonly partySign: DrCr; // RPT → 'C', PMT → 'D' (getPartyDrCr)
  get opp(): DrCr {
    return this.partySign === 'C' ? 'D' : 'C';
  }

  buildEntryPlan(input: EntryPlanInput): InterBranchPlan {
    const sign = this.partySign;
    const opp = this.opp;
    const isReceipt = sign === 'C';
    const docWord = isReceipt ? 'receipt' : 'payment';
    const party = input.partyName || 'party';
    const sourceBr = input.sourceBranchName || 'source branch';
    const instrPart = input.instrument ? ` ${input.instrument}` : '';
    const owningName = (b: ResolvedBranchAllocation) => b.allotmentBranchName || `branch ${b.allotmentBranchSid}`;

    // ── JV① — source re-allocation JV (booked in the source branch) ──
    const totalCurrency = input.branches.reduce((s, b) => s + b.currencyAmount, 0);
    const totalLocal = input.branches.reduce((s, b) => s + b.localAmount, 0);
    const owningNames = input.branches.map(owningName).join(', ');

    const sourceLines: JvLine[] = [
      // Party line: reverse the party side held in the source branch.
      {
        COAMasterSid: input.partyCOAMasterSid,
        LedgerMasterSid: input.partyLedgerMasterSid,
        DrCr: opp,
        Amount: totalCurrency,
        LocalAmount: totalLocal,
        Narration: `Re-allocate ${party} ${docWord} to inter-branch (${owningNames})`,
      },
      // One "Inter Branch - <owning>" line per owning branch.
      ...input.branches.map((b) => ({
        COAMasterSid: b.bridgeForOwningCOA,
        DrCr: sign,
        Amount: b.currencyAmount,
        LocalAmount: b.localAmount,
        Narration: isReceipt
          ? `Being Amt received from ${party}${instrPart} by ${sourceBr} Br`
          : `Being Amt paid to ${party}${instrPart} On behalf of ${owningName(b)} Br`,
      })),
    ];

    // ── JV② — mirror JV per owning branch (booked in that owning branch) ──
    const mirrorJvs: MirrorJvPlan[] = input.branches.map((b) => {
      const owningBr = owningName(b);
      const partyLines: JvLine[] = [];
      // One MATCHING party line per matched invoice.
      for (const m of b.matched) {
        partyLines.push({
          COAMasterSid: input.partyCOAMasterSid,
          LedgerMasterSid: input.partyLedgerMasterSid,
          DrCr: sign,
          Amount: m.currencyAmount,
          LocalAmount: m.localAmount,
          Narration: `${party} — invoice settlement (inter-branch ${docWord} via ${sourceBr})`,
        });
      }
      // One ADVANCE party line for the remainder, if any.
      if (b.advanceCurrency > 0 || b.advanceLocal > 0) {
        partyLines.push({
          COAMasterSid: input.partyCOAMasterSid,
          LedgerMasterSid: input.partyLedgerMasterSid,
          DrCr: sign,
          Amount: b.advanceCurrency,
          LocalAmount: b.advanceLocal,
          Narration: `${party} — advance (inter-branch ${docWord} via ${sourceBr})`,
        });
      }
      const lines: JvLine[] = [
        // Inter Branch - <source>: the receivable/payable from the source branch.
        {
          COAMasterSid: b.bridgeForSourceCOA,
          DrCr: opp,
          Amount: b.currencyAmount,
          LocalAmount: b.localAmount,
          Narration: isReceipt
            ? `Being Cash received from ${party}${instrPart} by ${sourceBr} Br`
            : `On behalf of paid to ${party}${instrPart} by ${sourceBr} Br`,
        },
        ...partyLines,
      ];
      return { allotmentBranchSid: b.allotmentBranchSid, lines, matchingLineCount: b.matched.length };
    });

    return { sourceJv: { lines: sourceLines, totalCurrency, totalLocal }, mirrorJvs };
  }
}

export class ReceiptInterBranchStrategy extends InterBranchStrategy {
  readonly partySign: DrCr = 'C'; // getPartyDrCr('RPT')
}

export class PaymentInterBranchStrategy extends InterBranchStrategy {
  readonly partySign: DrCr = 'D'; // getPartyDrCr('PMT')
}

/** Resolve the strategy for a source document type code (RPT/PMT). */
export function interBranchStrategyFor(docTypeCode: string): InterBranchStrategy {
  const sign = getPartyDrCr(docTypeCode);
  if (sign === 'D') return new PaymentInterBranchStrategy();
  return new ReceiptInterBranchStrategy();
}

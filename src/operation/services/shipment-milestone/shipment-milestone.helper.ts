import { BadRequestException } from '@nestjs/common';

/**
 * Common ShipmentMilestone helper — the single source of truth for CREATE, UPDATE,
 * conversion RE-LINK, and FETCH of shipment milestones, shared by every screen
 * (Booking, House Job, Service Job, Agent MAWB) and by Tracking.
 *
 * Why this exists: the same "loop the milestones[] array and create-or-update"
 * block, and several divergent fetch queries, used to be copy-pasted across the
 * booking / house-job / service-job / tracking services, each with subtle
 * differences (createMany vs per-row, missing HouseJobSid / BookingHeaderSid,
 * inconsistent AutoCaptured/Status handling, ShipmentNo-only fetch, missing
 * Company/Branch scope, wrong ordering). Centralising guarantees identical,
 * correct behaviour everywhere.
 *
 * Identifier model (for reference):
 *   - Booking milestone:        ShipmentNo = BookingNo, BookingHeaderSid set, HouseJobSid NULL
 *   - Converted House Job:       BookingHeaderSid set + HouseJobSid set (re-linked at conversion)
 *   - Manual House Job:          ShipmentNo = HBLNo, BookingHeaderSid NULL, HouseJobSid set
 *
 * Callers pass their own Prisma client or transaction client so the operation
 * participates in the caller's transaction.
 */

/* ------------------------------------------------------------------ *
 *  Normalisers
 * ------------------------------------------------------------------ */

/** Normalise AutoCaptured (boolean or 'Y'/'N') to 'Y' / 'N'. */
function toAutoCaptured(value: any): string {
  return value === true || value === 'Y' || value === 'y' ? 'Y' : 'N';
}

/** Normalise Status ('Active'/'Suspended'/'Deleted' or 'A'/'S'/'D') to a single uppercase char. */
function toStatusChar(status: any): string {
  if (status === null || status === undefined || status === '') return 'A';
  const value = String(status).trim();
  if (value.length === 1) return value.toUpperCase();
  const lower = value.toLowerCase();
  if (lower === 'active') return 'A';
  if (lower === 'suspended') return 'S';
  if (lower === 'deleted') return 'D';
  return value.charAt(0).toUpperCase();
}

/* ------------------------------------------------------------------ *
 *  WRITE — create / update (upsert)
 * ------------------------------------------------------------------ */

export interface ShipmentMilestoneSaveContext {
  ShipmentNo: string | null;
  CompanyMasterSid: number | null;
  BranchMasterSid: number | null;
  /** Set on House Job / Service Job saves. Omitted/null for Booking-only milestones. */
  HouseJobSid?: number | null;
  /** Set when the milestone belongs to (or originated from) a Booking. Preserves the Booking link. */
  BookingHeaderSid?: number | null;
  /** Email of the acting user (createdBy on create flows, updatedBy on update flows). */
  actorEmail?: string;
}

/**
 * Create or update each milestone in `milestones`, scoped/keyed from `context`,
 * with duplicate prevention by milestone **code**.
 *
 *   - Row WITH ShipmentMilestoneSid    -> update by PK (an existing, loaded row).
 *   - Row WITHOUT ShipmentMilestoneSid -> de-duplicated create:
 *       if an ACTIVE milestone with the SAME MilestoneCode already exists on this
 *       shipment (or was just saved in this same call), that row is UPDATED instead
 *       of inserting a second one; otherwise a new row is created.
 *
 * Why by code, not MilestoneMasterSid: the master is multi-department, so two
 * different MilestoneMasterSid records can share one MilestoneCode. Code is the real
 * business identity. The milestone row stores MilestoneMasterSid (not the code), so
 * codes are resolved once from milestoneMaster. When a code can't be resolved the
 * key falls back to the MilestoneMasterSid so we still never insert an exact dup.
 *
 * HouseJobSid / BookingHeaderSid are written only when supplied (non-null), so an
 * existing Booking link is never wiped when a House Job re-saves the same milestone.
 * Returns the saved/updated rows in input order (empty array when nothing to save).
 */
export async function saveShipmentMilestones(
  tx: any,
  milestones: any[] | undefined | null,
  context: ShipmentMilestoneSaveContext,
): Promise<any[]> {
  const list = Array.isArray(milestones) ? milestones : [];
  if (!list.length || !context?.ShipmentNo) {
    return [];
  }

  const linkData = {
    ...(context.HouseJobSid != null ? { HouseJobSid: context.HouseJobSid } : {}),
    ...(context.BookingHeaderSid != null ? { BookingHeaderSid: context.BookingHeaderSid } : {}),
  };

  let existingRows: any[] = [];
  const existingWhere: any = { Status: 'A', deletedAt: null };
  if (context.CompanyMasterSid != null) existingWhere.CompanyMasterSid = context.CompanyMasterSid;
  if (context.BranchMasterSid != null) existingWhere.BranchMasterSid = context.BranchMasterSid;

  // House identity is exact. BookingHeaderSid is deliberately matched as NULL for
  // manual/cross-company houses; ShipmentNo/HBLNo is never part of this lookup.
  if (context.HouseJobSid != null) {
    existingWhere.HouseJobSid = context.HouseJobSid;
    existingWhere.BookingHeaderSid = context.BookingHeaderSid ?? null;
  } else if (context.BookingHeaderSid != null) {
    existingWhere.BookingHeaderSid = context.BookingHeaderSid;
  } else {
    // Legacy callers with neither relational key retain the old ShipmentNo path.
    existingWhere.ShipmentNo = context.ShipmentNo;
  }
  existingRows = await tx.shipmentMilestone.findMany({
    where: existingWhere,
    select: { ShipmentMilestoneSid: true, MilestoneMasterSid: true },
  });

  // 2) Resolve MilestoneMasterSid -> MilestoneCode for every master involved
  //    (incoming + existing), in one lookup.
  const allMasterSids = [
    ...new Set(
      [...list.map((m) => m.MilestoneMasterSid), ...existingRows.map((r) => r.MilestoneMasterSid)]
        .filter((value) => value != null)
        .map((value) => Number(value)),
    ),
  ];
  const codeMap = new Map<number, string>();
  if (allMasterSids.length) {
    const masters = await tx.milestoneMaster.findMany({
      where: { MilestoneMasterSid: { in: allMasterSids } },
      select: { MilestoneMasterSid: true, MilestoneCode: true },
    });
    for (const master of masters) {
      codeMap.set(master.MilestoneMasterSid, master.MilestoneCode);
    }
  }

  // Dedup key: the milestone code (case-insensitive) when known, else the master Sid.
  const dedupKey = (milestoneMasterSid: any): string | null => {
    if (milestoneMasterSid == null) return null;
    const code = codeMap.get(Number(milestoneMasterSid));
    return code != null && String(code).trim() !== ''
      ? `CODE:${String(code).trim().toLowerCase()}`
      : `MID:${milestoneMasterSid}`;
  };

  // Existing active rows indexed by dedup key (first one wins).
  const existingByKey = new Map<string, number>();
  for (const row of existingRows) {
    const key = dedupKey(row.MilestoneMasterSid);
    if (key && !existingByKey.has(key)) {
      existingByKey.set(key, row.ShipmentMilestoneSid);
    }
  }

  const buildShared = (milestone: any) => ({
    ...linkData,
    ShipmentNo: context.ShipmentNo,
    MilestoneMasterSid: milestone.MilestoneMasterSid,
    MilestoneName: milestone.MilestoneName,
    MilestoneDate: milestone.MilestoneDate,
    Remarks: milestone.Remarks,
    AutoCaptured: toAutoCaptured(milestone.AutoCaptured),
  });

  const updateBySid = (sid: number, milestone: any) =>
    tx.shipmentMilestone.update({
      where: { ShipmentMilestoneSid: sid },
      data: {
        ...buildShared(milestone),
        Status: toStatusChar(milestone.Status),
        UpdatedBy: context.actorEmail ?? milestone.UpdatedBy ?? milestone.CreatedBy ?? 'system',
        UpdatedOn: new Date(),
      },
    });

  // Tracks codes already created/updated in THIS call (in-payload dedup).
  const seenKey = new Map<string, number>();
  const saved: any[] = [];

  for (const milestone of list) {
    const key = dedupKey(milestone.MilestoneMasterSid);

    // Explicit existing row -> update only when it belongs to this exact save
    // context. Never trust a client-supplied PK across company/job boundaries.
    if (milestone.ShipmentMilestoneSid) {
      const ownedRow = await tx.shipmentMilestone.findFirst({
        where: {
          ShipmentMilestoneSid: Number(milestone.ShipmentMilestoneSid),
          ...(context.CompanyMasterSid != null
            ? { CompanyMasterSid: context.CompanyMasterSid }
            : {}),
          ...(context.BranchMasterSid != null
            ? { BranchMasterSid: context.BranchMasterSid }
            : {}),
          ...(context.HouseJobSid != null
            ? { HouseJobSid: context.HouseJobSid }
            : context.BookingHeaderSid != null
              ? { BookingHeaderSid: context.BookingHeaderSid, HouseJobSid: null }
              : { ShipmentNo: context.ShipmentNo }),
          deletedAt: null,
        },
        select: { ShipmentMilestoneSid: true },
      });
      if (!ownedRow) {
        throw new BadRequestException(
          `Shipment milestone ${milestone.ShipmentMilestoneSid} does not belong to the supplied shipment context`,
        );
      }
      const updated = await updateBySid(milestone.ShipmentMilestoneSid, milestone);
      saved.push(updated);
      if (key) seenKey.set(key, milestone.ShipmentMilestoneSid);
      continue;
    }

    // New row -> if the same code already exists (this call or in DB), update it.
    const targetSid = key ? seenKey.get(key) ?? existingByKey.get(key) : undefined;
    if (targetSid) {
      const updated = await updateBySid(targetSid, milestone);
      saved.push(updated);
      if (key) seenKey.set(key, targetSid);
      continue;
    }

    const created = await tx.shipmentMilestone.create({
      data: {
        ...buildShared(milestone),
        CompanyMasterSid: context.CompanyMasterSid,
        BranchMasterSid: context.BranchMasterSid,
        Status: 'A',
        CreatedBy: context.actorEmail ?? milestone.CreatedBy ?? milestone.UpdatedBy ?? 'system',
      },
    });
    saved.push(created);
    if (key) seenKey.set(key, created.ShipmentMilestoneSid);
  }

  return saved;
}

/* ------------------------------------------------------------------ *
 *  RE-LINK — Booking -> House Job conversion
 * ------------------------------------------------------------------ */

export interface RelinkBookingMilestonesContext {
  /** Source booking(s) whose pre-conversion milestones should be linked to the House Job. */
  BookingHeaderSid: number | number[] | null | undefined;
  /** Newly created House Job to attach the milestones to. */
  HouseJobSid: number;
  CompanyMasterSid?: number | null;
  BranchMasterSid?: number | null;
  actorEmail?: string;
}

/**
 * Booking -> House Job conversion link-up.
 *
 * When a House Job is created from a Booking, the Booking's existing milestones
 * (created at booking time with HouseJobSid = NULL) must be attached to the new
 * House Job so the House Job screen / Tracking can fetch them by HouseJobSid.
 *
 * Only `HouseJobSid` is added — `BookingHeaderSid` and `ShipmentNo` are preserved,
 * so the original Booking relationship remains intact.
 *
 * Ownership safety: the update targets ONLY rows still unlinked
 * (`HouseJobSid = NULL`) for the given Booking(s), scoped by Company/Branch and
 * active/not-deleted. This is safe because the application allows a Booking to have
 * only ONE Active House Job at a time (enforced in house-job.service.createHouseJob),
 * so there is never a second concurrent House Job competing for the same milestones.
 *
 * Returns the number of milestones re-linked.
 */
export async function relinkBookingMilestonesToHouseJob(
  tx: any,
  context: RelinkBookingMilestonesContext,
): Promise<number> {
  const ids = (Array.isArray(context.BookingHeaderSid)
    ? context.BookingHeaderSid
    : [context.BookingHeaderSid]
  ).filter((value): value is number => value != null);

  if (!ids.length || !context.HouseJobSid) {
    return 0;
  }

  const result = await tx.shipmentMilestone.updateMany({
    where: {
      BookingHeaderSid: { in: ids },
      HouseJobSid: null,
      Status: 'A',
      deletedAt: null,
      ...(context.CompanyMasterSid != null ? { CompanyMasterSid: context.CompanyMasterSid } : {}),
      ...(context.BranchMasterSid != null ? { BranchMasterSid: context.BranchMasterSid } : {}),
    },
    data: {
      HouseJobSid: context.HouseJobSid,
      ...(context.actorEmail ? { UpdatedBy: context.actorEmail } : {}),
      UpdatedOn: new Date(),
    },
  });

  return result?.count ?? 0;
}

/* ------------------------------------------------------------------ *
 *  FETCH — read saved milestones for a shipment
 * ------------------------------------------------------------------ */

export interface ShipmentMilestoneFetchContext {
  /** House Job screen / Service Job / converted house. Most specific key. */
  HouseJobSid?: number | null;
  /** Booking screen, and the booking relationship of a converted house. */
  BookingHeaderSid?: number | null;
  /** Fallback link (BookingNo for bookings, HBLNo for houses) and legacy rows. */
  ShipmentNo?: string | null;
  CompanyMasterSid?: number | null;
  BranchMasterSid?: number | null;
}

/**
 * Fetch a shipment's saved milestones, keyed by whichever identifiers the caller
 * supplies, ordered by the configured milestone master `SortBy`.
 *
 * Matching: an OR of the provided keys — HouseJobSid, BookingHeaderSid, ShipmentNo
 * — so the SAME function serves every case correctly:
 *   - Booking screen  -> pass BookingHeaderSid (+ ShipmentNo)            -> Case 1
 *   - House Job screen -> pass HouseJobSid (+ BookingHeaderSid, ShipmentNo) -> Case 2 (converted) & Case 3 (manual)
 *   - Manual House     -> pass HouseJobSid only (BookingHeaderSid NULL is never required)
 * `BookingHeaderSid` is NEVER ANDed with `HouseJobSid`, so a manual house (NULL
 * BookingHeaderSid) is not filtered out.
 *
 * Always scoped by Company + Branch (when supplied), Status = 'A', deletedAt = NULL.
 * A single DB row can satisfy more than one OR branch but is still returned once.
 */
export async function getShipmentMilestones(
  db: any,
  context: ShipmentMilestoneFetchContext,
): Promise<any[]> {
  // Prefer immutable relational identities. ShipmentNo is only a compatibility
  // fallback for legacy callers that cannot supply a House/Booking SID.
  let identityWhere: any = null;
  if (context.HouseJobSid != null) {
    identityWhere = { HouseJobSid: context.HouseJobSid };
  } else if (context.BookingHeaderSid != null) {
    identityWhere = { BookingHeaderSid: context.BookingHeaderSid };
  } else if (context.ShipmentNo) {
    identityWhere = { ShipmentNo: context.ShipmentNo };
  }

  if (!identityWhere) {
    return [];
  }

  const where: any = {
    Status: 'A',
    deletedAt: null,
    ...identityWhere,
  };
  if (context.CompanyMasterSid != null) where.CompanyMasterSid = context.CompanyMasterSid;
  if (context.BranchMasterSid != null) where.BranchMasterSid = context.BranchMasterSid;

  const rows = await db.shipmentMilestone.findMany({ where });

  // Order by the configured master SortBy. The milestone row does not store SortBy,
  // so look it up per MilestoneMasterSid; MilestoneDate is the tie-breaker.
  const masterSids = [
    ...new Set(rows.map((row: any) => row.MilestoneMasterSid).filter((value: any) => value != null)),
  ];
  const masters = masterSids.length
    ? await db.milestoneMaster.findMany({
        where: { MilestoneMasterSid: { in: masterSids } },
        select: { MilestoneMasterSid: true, SortBy: true },
      })
    : [];
  const sortMap = new Map<number, number>(masters.map((m: any) => [m.MilestoneMasterSid, Number(m.SortBy)]));

  rows.sort((a: any, b: any) => {
    const sa = sortMap.get(a.MilestoneMasterSid) ?? Number.MAX_SAFE_INTEGER;
    const sb = sortMap.get(b.MilestoneMasterSid) ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    const da = a.MilestoneDate ? new Date(a.MilestoneDate).getTime() : 0;
    const dbb = b.MilestoneDate ? new Date(b.MilestoneDate).getTime() : 0;
    return da - dbb;
  });

  return rows;
}

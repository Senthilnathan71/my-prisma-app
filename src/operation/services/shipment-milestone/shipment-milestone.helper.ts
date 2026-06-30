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
 * Create or update each milestone in `milestones`, scoped/keyed from `context`.
 *   - Row WITH ShipmentMilestoneSid  -> update (so re-saving never duplicates).
 *   - Row WITHOUT ShipmentMilestoneSid -> create.
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

  const saved: any[] = [];
  for (const milestone of list) {
    const shared = {
      ...linkData,
      ShipmentNo: context.ShipmentNo,
      MilestoneMasterSid: milestone.MilestoneMasterSid,
      MilestoneName: milestone.MilestoneName,
      MilestoneDate: milestone.MilestoneDate,
      Remarks: milestone.Remarks,
      AutoCaptured: toAutoCaptured(milestone.AutoCaptured),
    };

    if (milestone.ShipmentMilestoneSid) {
      const updated = await tx.shipmentMilestone.update({
        where: { ShipmentMilestoneSid: milestone.ShipmentMilestoneSid },
        data: {
          ...shared,
          Status: toStatusChar(milestone.Status),
          UpdatedBy: context.actorEmail ?? milestone.UpdatedBy ?? milestone.CreatedBy ?? 'system',
          UpdatedOn: new Date(),
        },
      });
      saved.push(updated);
    } else {
      const created = await tx.shipmentMilestone.create({
        data: {
          ...shared,
          CompanyMasterSid: context.CompanyMasterSid,
          BranchMasterSid: context.BranchMasterSid,
          Status: 'A',
          CreatedBy: context.actorEmail ?? milestone.CreatedBy ?? milestone.UpdatedBy ?? 'system',
        },
      });
      saved.push(created);
    }
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
  const orConditions: any[] = [];
  if (context.HouseJobSid != null) orConditions.push({ HouseJobSid: context.HouseJobSid });
  if (context.BookingHeaderSid != null) orConditions.push({ BookingHeaderSid: context.BookingHeaderSid });
  if (context.ShipmentNo) orConditions.push({ ShipmentNo: context.ShipmentNo });

  if (!orConditions.length) {
    return [];
  }

  const where: any = {
    Status: 'A',
    deletedAt: null,
    OR: orConditions,
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

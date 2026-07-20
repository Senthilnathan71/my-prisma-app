import { BadRequestException } from '@nestjs/common';

const ACTIVE_STATUSES = ['A', 'S'];

export interface DedupeMilestoneRow {
    CustomerMilestoneSid?: number | null;
    MilestoneMasterSid: number;
    CustomerBranchSid?: number | null;
    CustomerMasterSid?: number | null;
    Status?: string | null;
}

interface ResolvedRow extends DedupeMilestoneRow {
    branchSid: number | null;
    customerSid: number | null;
}

/**
 * A customer milestone is identified by its MilestoneMasterSid, which already carries the
 * department (MilestoneMaster.DepartmentMasterSid). CustomerMilestone itself has no department
 * column, so keying on the master sid is what enforces "one milestone per department".
 * Scope is the customer branch; rows saved without a branch (the customer-milestone/save
 * endpoint never sets one) fall back to customer-wide scope.
 */
function scopeKey(row: ResolvedRow): string {
    return row.branchSid != null ? `b:${row.branchSid}` : `c:${row.customerSid}`;
}

function dedupeKey(row: ResolvedRow): string {
    return `${scopeKey(row)}|${row.MilestoneMasterSid}`;
}

async function describeMilestones(prisma: any, milestoneMasterSids: number[]): Promise<string> {
    const uniqueSids = [...new Set(milestoneMasterSids)];
    const masters = await prisma.milestoneMaster.findMany({
        where: { MilestoneMasterSid: { in: uniqueSids } },
        select: { MilestoneMasterSid: true, MilestoneName: true, DepartmentMasterSid: true }
    });
    const bySid = new Map<number, any>(masters.map(m => [m.MilestoneMasterSid, m]));

    return uniqueSids
        .map(sid => {
            const master = bySid.get(sid);
            if (!master) {
                return `Milestone #${sid}`;
            }
            const departments = (master.DepartmentMasterSid ?? []).filter(Boolean).join(', ');
            return departments ? `${master.MilestoneName} (${departments})` : master.MilestoneName;
        })
        .join(', ');
}

/**
 * Rejects a customer-milestone payload that would create a duplicate milestone for the same
 * customer branch, checking both within the payload itself and against rows already stored.
 * Call inside the transaction, after any soft-deletes have been applied, before writing.
 */
export async function assertNoDuplicateCustomerMilestones(
    prisma: any,
    milestones: DedupeMilestoneRow[],
    defaults: { CustomerMasterSid?: number | null; CustomerBranchSid?: number | null } = {}
): Promise<void> {
    const rows: ResolvedRow[] = (milestones ?? [])
        .filter(m => m && m.MilestoneMasterSid != null && m.Status !== 'D')
        .map(m => ({
            ...m,
            branchSid: m.CustomerBranchSid ?? defaults.CustomerBranchSid ?? null,
            customerSid: m.CustomerMasterSid ?? defaults.CustomerMasterSid ?? null
        }));

    if (rows.length === 0) {
        return;
    }

    // Duplicates inside the submitted payload.
    const seen = new Set<string>();
    const payloadClashes: number[] = [];
    for (const row of rows) {
        const key = dedupeKey(row);
        if (seen.has(key)) {
            payloadClashes.push(row.MilestoneMasterSid);
        } else {
            seen.add(key);
        }
    }

    if (payloadClashes.length > 0) {
        const description = await describeMilestones(prisma, payloadClashes);
        throw new BadRequestException(
            `Duplicate milestone selected for this customer: ${description}. Each milestone can be added only once per department.`
        );
    }

    // Duplicates against milestones already saved for the same scope.
    const existing = await prisma.customerMilestone.findMany({
        where: {
            Status: { in: ACTIVE_STATUSES },
            OR: rows.map(row => ({
                MilestoneMasterSid: row.MilestoneMasterSid,
                ...(row.branchSid != null
                    ? { CustomerBranchSid: row.branchSid }
                    : { CustomerMasterSid: row.customerSid, CustomerBranchSid: null })
            }))
        },
        select: {
            CustomerMilestoneSid: true,
            MilestoneMasterSid: true,
            CustomerBranchSid: true,
            CustomerMasterSid: true
        }
    });

    if (existing.length === 0) {
        return;
    }

    const existingByKey = new Map<string, number[]>();
    for (const row of existing) {
        const key = dedupeKey({
            ...row,
            branchSid: row.CustomerBranchSid,
            customerSid: row.CustomerMasterSid
        });
        existingByKey.set(key, [...(existingByKey.get(key) ?? []), row.CustomerMilestoneSid]);
    }

    const storedClashes: number[] = [];
    for (const row of rows) {
        const conflicting = (existingByKey.get(dedupeKey(row)) ?? []).filter(
            sid => sid !== row.CustomerMilestoneSid
        );
        if (conflicting.length > 0) {
            storedClashes.push(row.MilestoneMasterSid);
        }
    }

    if (storedClashes.length > 0) {
        const description = await describeMilestones(prisma, storedClashes);
        throw new BadRequestException(
            `Milestone already exists for this customer: ${description}. Each milestone can be added only once per department.`
        );
    }
}

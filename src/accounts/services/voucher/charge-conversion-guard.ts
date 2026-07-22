import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type ChargeConversionSide = 'Revenue' | 'Cost';

/**
 * Blocks converting a BookingRates / CostRevenueCharges row into a second voucher
 * on the same side (Revenue = customer invoice, Cost = vendor invoice).
 * Runs on the caller's open transaction client; throws BadRequestException listing
 * every already-converted charge (grid Sno + description + existing voucher number).
 * Accepts raw payload.VoucherDetail rows — normalizes BookingRatesSid ?? BookingRateSid.
 */
export async function assertChargesNotConverted(
  prisma: Prisma.TransactionClient,
  details: any[],
  side: ChargeConversionSide,
): Promise<void> {
  const bookingRateSids = new Set<number>();
  const costRevenueSids = new Set<number>();
  for (const d of details ?? []) {
    const brSid = d?.BookingRatesSid ?? d?.BookingRateSid;
    if (brSid) bookingRateSids.add(Number(brSid));
    if (d?.CostRevenueChargesSid) costRevenueSids.add(Number(d.CostRevenueChargesSid));
  }
  if (bookingRateSids.size === 0 && costRevenueSids.size === 0) return;

  const isRevenue = side === 'Revenue';
  const voucherLinkFilter = isRevenue
    ? { RevenueVoucherHeaderSid: { not: null } }
    : { CostVoucherHeaderSid: { not: null } };
  const relationSelect = {
    SerialNumber: true,
    ChargeDescription: true,
    revenueVoucherHeader: { select: { VoucherNumber: true } },
    costVoucherHeader: { select: { VoucherNumber: true } },
  };

  const converted: { SerialNumber: any; ChargeDescription: string | null; VoucherNumber: string | null }[] = [];
  const collect = (rows: any[]) => {
    for (const r of rows) {
      converted.push({
        SerialNumber: r.SerialNumber,
        ChargeDescription: r.ChargeDescription,
        VoucherNumber: (isRevenue ? r.revenueVoucherHeader : r.costVoucherHeader)?.VoucherNumber ?? null,
      });
    }
  };

  if (bookingRateSids.size > 0) {
    collect(await prisma.bookingRates.findMany({
      where: { BookingRatesSid: { in: [...bookingRateSids] }, ...voucherLinkFilter },
      select: relationSelect,
    }));
  }
  if (costRevenueSids.size > 0) {
    collect(await prisma.costRevenueCharges.findMany({
      where: { CostRevenueChargesSid: { in: [...costRevenueSids] }, ...voucherLinkFilter },
      select: relationSelect,
    }));
  }

  if (converted.length > 0) {
    const lines = converted.map((c) => {
      const sno = c.SerialNumber != null ? `Sno ${Number(c.SerialNumber)} - ` : '';
      const voucher = c.VoucherNumber ? ` ${c.VoucherNumber}` : '';
      return `${sno}${c.ChargeDescription || 'Charge'} is already converted into Voucher${voucher}`;
    });
    throw new BadRequestException(lines.join('\n'));
  }
}

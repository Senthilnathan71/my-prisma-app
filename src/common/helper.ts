import { LeadStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt'
import *as fs from 'fs'

export const statusWhereClause = { in : ["A","S"]} 

export const encodePassword = async (password: string) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
}

export const checkPassword = (password: string, hash: string) => {
    const check = bcrypt.compareSync(password, hash);
    return check
}


export const checkIfFileExists = (path = '') => {
    try {
        if (fs.existsSync(path)) {
            return true;
        }
        return false
    } catch (error) {
        return false
    }
}



export const getClientIp = (req: any): string => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // Sometimes contains a list: "client, proxy1, proxy2"
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0]; // return the first (client IP)
  }

  return (
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    'unknown'
  );
};


// ── Branch Timezone Helpers ──────────────────────────────────────────────────

export function normalizeTimezoneOffset(offset?: string | null): string {
  if (!offset) return '+00:00';
  let value = String(offset).trim();
  if (!value) return '+00:00';
  if (!['+', '-'].includes(value[0])) value = `+${value}`;
  const match = value.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return '+00:00';
  const sign = match[1];
  const hours = match[2].padStart(2, '0');
  const minutes = match[3] || '00';
  return `${sign}${hours}:${minutes}`;
}

export function getOffsetMinutes(offset: string): number {
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Converts a raw UTC-midnight Date (the datepicker's chosen calendar date)
 * to the UTC instant that represents midnight in the given branch timezone.
 *
 * Example: rawDate = 2026-05-28T00:00:00Z, timeZone = "+05:30" (IST)
 *   → 2026-05-27T18:30:00.000Z  (= midnight 28 May in IST)
 */
export function branchMidnightToUtc(rawDate: Date, timeZone?: string | null): Date {
  const offset = normalizeTimezoneOffset(timeZone);
  const offsetMs = getOffsetMinutes(offset) * 60_000;
  return new Date(rawDate.getTime() - offsetMs);
}

export function parseDateFromString(input: string): Date | null {
  const parts = input.trim().split('-');
  if (parts.length !== 3) return null;

  const [dayStr, monthStr, yearStr] = parts;

  const months: { [key: string]: number } = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  };

  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const month = months[monthStr.toUpperCase()];

  if (isNaN(day) || isNaN(year) || month === undefined) return null;

  const localDate = new Date(year, month, day);

  const offsetInMs = localDate.getTimezoneOffset() * 60 * 1000;

  const adjustedDate = new Date(localDate.getTime() - offsetInMs);

  return isNaN(adjustedDate.getTime()) ? null : adjustedDate;
}

export function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s_-]+/) // Split by spaces, underscores, or hyphens
    .map((word, index) =>
      index === 0
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
}


export function toUTCISO(localDateTime: string) {
        const local = new Date(localDateTime);
        return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
    }

/**
 * 
 * @param date From Date you want to add
 * @param days Number of days to add
 * @returns added date
 * 
 * @example
 * 
 * console.log(addDaysCalendar(new Date('2025-02-28'), 3));  // 2025-03-03T00:00:00.000Z
 * console.log(addDaysCalendar(new Date('2024-02-28'), 3));  // 2024-03-02T00:00:00.000Z
 */
export function addDaysCalendar(date:Date, days:number) : Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Decide whether a customer's `CashCredit` flag means CREDIT.
 * The column holds mixed values ('Cash' | 'Credit' | 'Prepd' | '' | null), and
 * both 'Cash' and 'Credit' start with 'C' — so only a value that clearly says
 * "credit" counts as CREDIT. Everything else (Cash/Prepd/blank/null/unknown)
 * defaults to CASH, the safe side for credit control.
 */
export function isCreditCustomer(cashCredit?: string | null): boolean {
  return (cashCredit ?? '').trim().toUpperCase().startsWith('CRE');
}

/**
 * Normalize any date (or now) to UTC midnight (date-only). Mirrors the trick in
 * currency-exchange.getExchangeRate so effective-dated lookups against `@db.Date`
 * columns don't slip a day across timezones.
 */
export function toUtcDateOnly(input?: Date | string | null): Date {
  const d = input ? new Date(input) : new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
  * Helper: Converts Prisma Decimal to number
*/
export function toNumber(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Decimal) {
    return value.toNumber();
  }
  return parseFloat(value.toString()) || 0;
}

/**
 * Round an amount to the specified number of decimal places.
 * Handles negative decimals, invalid inputs, and floating precision safely.
 */
export function roundAmount(amount: number, decimalPlaces: number): number {
  if (isNaN(amount) || amount === null || amount === undefined) return 0;
  if (isNaN(decimalPlaces) || decimalPlaces < 0) decimalPlaces = 0;

  const factor = Math.pow(10, decimalPlaces);

  // Fix floating-point issues: (e.g., 1.005 → 1.01)
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

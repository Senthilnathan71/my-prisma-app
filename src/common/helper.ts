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

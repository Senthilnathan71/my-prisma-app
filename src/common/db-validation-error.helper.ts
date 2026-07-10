import { BadRequestException, Logger } from '@nestjs/common';

/**
 * Extracts a user-facing validation message raised by a PostgreSQL trigger.
 *
 * Our DB triggers (e.g. `voucher_transaction_validate`) RAISE EXCEPTION messages
 * prefixed with the sentinel `VCHK|`. Prisma surfaces the PostgreSQL error text in
 * `error.message` (and sometimes `error.meta.message`). This helper looks for the
 * marker and returns the clean message that follows it, so the caller can rethrow a
 * `BadRequestException` and show the exact wording in the frontend toastr.
 *
 * Returns `null` when the error is not one of our marked trigger errors, so the
 * caller can fall through to its normal error handling.
 *
 * When a marked error IS recognized it emits ONE distinctive, greppable log line
 * under the `DbTriggerValidation` context, so DB-trigger rejections are easy to
 * spot in the server logs and can never be confused with an app-level JS check
 * (e.g. the receipt/payment "posting validation failed" messages, which have no
 * `VCHK|` marker). Logging lives here so EVERY path is covered uniformly — the
 * throwing service catch blocks AND `voucher.controller.ts`, which sets
 * `output.message` instead of throwing.
 */
export const DB_VALIDATION_MARKER = 'VCHK|';

const dbTriggerLogger = new Logger('DbTriggerValidation');

/**
 * A `BadRequestException` whose message originated from a DB validation trigger
 * (the `VCHK|` sentinel). It has ALREADY been logged once — as a clean line under
 * the `DbTriggerValidation` context — by the time it's thrown, so controllers use
 * `instanceof DbTriggerValidationException` to avoid emitting a second, generic
 * catch-block log for it. It still extends `BadRequestException`, so every existing
 * `instanceof BadRequestException` check and `error.message` → `resp.message`
 * handling keeps working unchanged, and genuine app-level `BadRequestException`s
 * (e.g. the receipt/payment "posting validation failed" checks) are still logged.
 */
export class DbTriggerValidationException extends BadRequestException {}

/**
 * If `error` is a recognized DB-trigger validation error, throw it as a
 * `DbTriggerValidationException` carrying the clean user-facing message (already
 * logged once by `extractVoucherValidationMessage`). Otherwise no-op, so the caller
 * falls through to its normal error handling. Use this in a posting service catch
 * block in place of the `const vmsg = …; if (vmsg) throw new BadRequestException(vmsg);`
 * pattern.
 */
export function throwIfVoucherTriggerValidation(error: any): void {
  const message = extractVoucherValidationMessage(error);
  if (message) {
    throw new DbTriggerValidationException(message);
  }
}

export function extractVoucherValidationMessage(error: any): string | null {
  const raw =
    error?.meta?.message ??
    error?.message ??
    (typeof error === 'string' ? error : '');

  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const idx = raw.indexOf(DB_VALIDATION_MARKER);
  if (idx === -1) {
    return null;
  }

  // take everything after the marker, up to the end of that line, and trim
  const message = raw
    .slice(idx + DB_VALIDATION_MARKER.length)
    .split('\n')[0]
    .trim();

  // one clear, greppable line so it's obvious this came from the DB trigger
  dbTriggerLogger.warn(`[DB Trigger] post rejected → ${message}`);

  return message;
}

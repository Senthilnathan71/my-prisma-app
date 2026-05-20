import { CookieOptions, Request } from 'express';

export const AUTH_COOKIE_NAME = 'crm_session';

export function getAuthCookieOptions(): CookieOptions {
  const isProduction = process.env.ENVIRONMENT === 'Production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 3 * 60 * 60 * 1000,
  };
}

export function getAuthCookieClearOptions(): CookieOptions {
  const { maxAge, ...options } = getAuthCookieOptions();
  return options;
}

export function extractAuthTokenFromRequest(req: Request | undefined): string | null {
  const token = req?.cookies?.[AUTH_COOKIE_NAME];
  return typeof token === 'string' && token.trim() ? token : null;
}

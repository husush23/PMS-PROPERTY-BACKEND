import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Parse expiresIn string (e.g., "15m", "7d") to seconds
 */
function parseExpiresIn(expiresIn: string): number {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1), 10);

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      // Default to 15 minutes if format is invalid
      return 15 * 60;
  }
}

/**
 * Set access token cookie
 */
interface JwtConfig {
  cookieName: string;
  refreshCookieName: string;
  cookieHttpOnly: boolean;
  cookieSecure: boolean;
  cookieSameSite: 'strict' | 'lax' | 'none';
  cookieDomain?: string;
}

export function setAccessTokenCookie(
  res: Response,
  token: string,
  expiresIn: string,
  configService: ConfigService,
): void {
  const cookieConfig = configService.get<JwtConfig>('jwt');
  if (!cookieConfig) {
    throw new Error('JWT configuration not found');
  }
  const maxAge = parseExpiresIn(expiresIn);

  res.cookie(cookieConfig.cookieName, token, {
    httpOnly: cookieConfig.cookieHttpOnly,
    secure: cookieConfig.cookieSecure,
    sameSite: cookieConfig.cookieSameSite,
    maxAge: maxAge * 1000, // Convert to milliseconds
    path: '/',
    ...(cookieConfig.cookieDomain && { domain: cookieConfig.cookieDomain }),
  });
}

/**
 * Set refresh token cookie
 */
export function setRefreshTokenCookie(
  res: Response,
  token: string,
  expiresIn: string,
  configService: ConfigService,
): void {
  const cookieConfig = configService.get<JwtConfig>('jwt');
  if (!cookieConfig) {
    throw new Error('JWT configuration not found');
  }
  const maxAge = parseExpiresIn(expiresIn);

  res.cookie(cookieConfig.refreshCookieName, token, {
    httpOnly: cookieConfig.cookieHttpOnly,
    secure: cookieConfig.cookieSecure,
    sameSite: cookieConfig.cookieSameSite,
    maxAge: maxAge * 1000, // Convert to milliseconds
    path: '/',
    ...(cookieConfig.cookieDomain && { domain: cookieConfig.cookieDomain }),
  });
}

/**
 * Clear both access and refresh token cookies
 */
export function clearAuthCookies(
  res: Response,
  configService: ConfigService,
): void {
  const cookieConfig = configService.get<JwtConfig>('jwt');
  if (!cookieConfig) {
    throw new Error('JWT configuration not found');
  }

  res.clearCookie(cookieConfig.cookieName, {
    httpOnly: cookieConfig.cookieHttpOnly,
    secure: cookieConfig.cookieSecure,
    sameSite: cookieConfig.cookieSameSite,
    path: '/',
    ...(cookieConfig.cookieDomain && { domain: cookieConfig.cookieDomain }),
  });

  res.clearCookie(cookieConfig.refreshCookieName, {
    httpOnly: cookieConfig.cookieHttpOnly,
    secure: cookieConfig.cookieSecure,
    sameSite: cookieConfig.cookieSameSite,
    path: '/',
    ...(cookieConfig.cookieDomain && { domain: cookieConfig.cookieDomain }),
  });
}

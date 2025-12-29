export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    cookieName: process.env.COOKIE_NAME || 'access_token',
    refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'refresh_token',
    cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    cookieSameSite: (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'lax',
    cookieHttpOnly: process.env.COOKIE_HTTP_ONLY !== 'false', // Default true
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  },
});









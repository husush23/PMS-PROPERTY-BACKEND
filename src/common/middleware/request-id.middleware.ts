import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Middleware that assigns a unique request ID to each request for tracing and support.
 * - Attaches requestId to the request object
 * - Sets X-Request-Id response header so clients can send it back for support
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existingId = req.headers[REQUEST_ID_HEADER.toLowerCase()];
  const requestId =
    typeof existingId === 'string' ? existingId : randomUUID();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

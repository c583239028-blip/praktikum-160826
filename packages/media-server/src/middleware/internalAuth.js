// Guards service-to-service routes (e.g. moderation enforcement from the
// app-server). Never reachable via a client socket — HTTP only, and keyed
// off a secret distinct from JWT_SECRET (that one authenticates end users).
import { timingSafeEqual } from 'crypto';
import { ERROR_MESSAGES, INTERNAL_API } from '@worldplay/shared';

// Plain !== leaks timing info proportional to how many leading characters
// match — irrelevant for most app secrets, but this one guards a
// service-to-service channel, so compare in constant time.
function matchesSecret(received, expected) {
  if (!received || !expected) return false;

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export const internalAuth = (req, res, next) => {
  const secret = req.headers[INTERNAL_API.HEADER_SECRET];

  if (!matchesSecret(secret, process.env.INTERNAL_SERVICE_SECRET)) {
    return res.status(401).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
  }

  next();
};

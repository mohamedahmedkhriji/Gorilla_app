import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import process from 'node:process';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const generatedFallbackSecret = crypto.randomBytes(48).toString('hex');

const HASH_PREFIX = 'scrypt';
const DEFAULT_SCRYPT_COST = 16384;
const DEFAULT_SCRYPT_BLOCK_SIZE = 8;
const DEFAULT_SCRYPT_PARALLELIZATION = 1;
const DEFAULT_HASH_KEY_LENGTH = 64;
const DEFAULT_TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const fromBase64Url = (value) => {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
};

const getTokenSecret = () => {
  const raw = String(process.env.AUTH_SECRET || '').trim();
  if (raw) return raw;
  const fallback = String(process.env.DB_PASSWORD || '').trim();
  if (fallback) return `${fallback}:gorella-auth-fallback`;
  return generatedFallbackSecret;
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const isStructuredPasswordHash = (value) => String(value || '').startsWith(`${HASH_PREFIX}$`);

export const isPasswordHash = (value) => isStructuredPasswordHash(value);

export const hashPassword = async (password) => {
  const normalizedPassword = String(password || '');
  if (!normalizedPassword) {
    throw new Error('Password is required');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(normalizedPassword, salt, DEFAULT_HASH_KEY_LENGTH, {
    N: DEFAULT_SCRYPT_COST,
    r: DEFAULT_SCRYPT_BLOCK_SIZE,
    p: DEFAULT_SCRYPT_PARALLELIZATION,
  });

  return [
    HASH_PREFIX,
    DEFAULT_SCRYPT_COST,
    DEFAULT_SCRYPT_BLOCK_SIZE,
    DEFAULT_SCRYPT_PARALLELIZATION,
    salt,
    Buffer.from(derivedKey).toString('hex'),
  ].join('$');
};

const verifyStructuredPassword = async (password, storedHash) => {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) {
    return false;
  }

  const [, costRaw, blockSizeRaw, parallelizationRaw, salt, hashHex] = parts;
  const derivedKey = await scryptAsync(String(password || ''), salt, Buffer.from(hashHex, 'hex').length, {
    N: Number(costRaw) || DEFAULT_SCRYPT_COST,
    r: Number(blockSizeRaw) || DEFAULT_SCRYPT_BLOCK_SIZE,
    p: Number(parallelizationRaw) || DEFAULT_SCRYPT_PARALLELIZATION,
  });

  return safeEqual(Buffer.from(derivedKey).toString('hex'), hashHex);
};

export const verifyPassword = async (password, storedValue) => {
  if (isStructuredPasswordHash(storedValue)) {
    return verifyStructuredPassword(password, storedValue);
  }
  return safeEqual(password, storedValue);
};

export const verifyPasswordWithUpgrade = async (password, storedValue) => {
  const valid = await verifyPassword(password, storedValue);
  return {
    valid,
    needsUpgrade: valid && !isStructuredPasswordHash(storedValue),
  };
};

export const createAuthToken = (user) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    sub: Number(user?.id || 0),
    role: String(user?.role || ''),
    gymId: user?.gym_id == null ? null : Number(user.gym_id),
    coachId: user?.coach_id == null ? null : Number(user.coach_id),
    iat: nowSeconds,
    exp: nowSeconds + DEFAULT_TOKEN_TTL_SECONDS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getTokenSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
};

export const verifyAuthToken = (token) => {
  const raw = String(token || '').trim();
  if (!raw || !raw.includes('.')) return null;

  const [encodedPayload, signature] = raw.split('.', 2);
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', getTokenSecret())
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  let payload = null;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }

  const subjectId = Number(payload?.sub || 0);
  const expiresAt = Number(payload?.exp || 0);
  if (!subjectId || !expiresAt || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    userId: subjectId,
    role: String(payload?.role || ''),
    gymId: payload?.gymId == null ? null : Number(payload.gymId),
    coachId: payload?.coachId == null ? null : Number(payload.coachId),
    exp: expiresAt,
    iat: Number(payload?.iat || 0),
  };
};

export const getBearerToken = (headers = {}) => {
  const authHeader = String(headers.authorization || headers.Authorization || '').trim();
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ? String(match[1]).trim() : null;
};

export const createSecurityHeadersMiddleware = () => (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
};

export const createSimpleRateLimit = ({
  windowMs = 60_000,
  max = 60,
  keySelector = (req) => req.ip || 'unknown',
} = {}) => {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = String(keySelector(req) || 'unknown');
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }

    current.count += 1;
    return next();
  };
};

export const getRoleSocketType = (role) => (String(role || '').trim().toLowerCase() === 'coach' ? 'coach' : 'user');

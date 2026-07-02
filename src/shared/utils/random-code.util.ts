import { randomBytes, randomInt } from 'node:crypto';

/**
 * Human-friendly alphabet: uppercase letters + digits, minus the ambiguous
 * ones (0/O, 1/I/L) so an invite code can be read aloud or written on a
 * whiteboard without confusion.
 */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Short, readable class invite code (default 8 chars, e.g. "K7MP2XQ9"). */
export function generateInviteCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

/**
 * Opaque, URL-safe session join token. Long enough (128 bits) that guessing
 * is infeasible — it doubles as the "anyone with the link can join" secret.
 */
export function generateJoinToken(): string {
  return randomBytes(16).toString('base64url');
}

import { generateInviteCode, generateJoinToken } from './random-code.util';

describe('random-code.util', () => {
  describe('generateInviteCode', () => {
    it('produces 8 chars from the unambiguous alphabet by default', () => {
      for (let i = 0; i < 50; i += 1) {
        const code = generateInviteCode();
        expect(code).toHaveLength(8);
        // No 0/O, 1/I/L — readable out loud.
        expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
      }
    });

    it('respects a custom length', () => {
      expect(generateInviteCode(12)).toHaveLength(12);
    });
  });

  describe('generateJoinToken', () => {
    it('produces URL-safe tokens', () => {
      const token = generateJoinToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(20);
    });

    it('does not repeat across calls', () => {
      const tokens = new Set(
        Array.from({ length: 100 }, () => generateJoinToken()),
      );
      expect(tokens.size).toBe(100);
    });
  });
});

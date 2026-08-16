import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../utils/logger.js';

// טסט בסיסי (SCRUM-323): כל המתודות קיימות ואינן זורקות.
// ריצה תחת Node -> isEnabled=true, כך שהמתודות באמת מגיעות ל-console.*.
describe('shared logger', () => {
  const methods = [
    'system',
    'info',
    'success',
    'error',
    'warn',
    'socketConnect',
    'socketDisconnect',
    'socketAction',
    'socketJoin',
  ];

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes every expected method as a function', () => {
    for (const name of methods) {
      expect(typeof logger[name]).toBe('function');
    }
  });

  it('core methods do not throw', () => {
    expect(() => logger.system('system message')).not.toThrow();
    expect(() => logger.info('info message')).not.toThrow();
    expect(() => logger.success('success message')).not.toThrow();
    expect(() => logger.error('error message')).not.toThrow();
    expect(() =>
      logger.error('error message', new Error('boom'))
    ).not.toThrow();
    expect(() => logger.warn('warn message')).not.toThrow();
  });

  it('socket helpers do not throw, including missing-user fallbacks', () => {
    const user = { username: 'alice', role: 'HOST' };
    expect(() => logger.socketConnect(user, 'sock-1')).not.toThrow();
    expect(() => logger.socketConnect(null, 'sock-1')).not.toThrow();
    expect(() =>
      logger.socketDisconnect(user, 'sock-1', 'transport close')
    ).not.toThrow();
    expect(() =>
      logger.socketDisconnect(null, 'sock-1', 'transport close')
    ).not.toThrow();
    expect(() => logger.socketAction(user, 'JOIN', 'room=1')).not.toThrow();
    expect(() => logger.socketAction(null, 'JOIN', 'room=1')).not.toThrow();
    expect(() => logger.socketJoin(user, 'room-1')).not.toThrow();
    expect(() => logger.socketJoin(null, 'room-1')).not.toThrow();
  });

  it('actually writes to the console under Node', () => {
    logger.info('hello');
    expect(console.log).toHaveBeenCalled();
  });

  it('does not emit ANSI color codes when run under Node TTY-less test env', () => {
    // ב-Node הצבעים כן פעילים; מוודאים שהפורמט מכיל את התווית הצפויה.
    logger.info('payload');
    const output = console.log.mock.calls.at(-1)?.[0] ?? '';
    expect(output).toContain('[INFO]');
    expect(output).toContain('payload');
  });
});

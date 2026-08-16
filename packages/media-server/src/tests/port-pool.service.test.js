import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES } from '@worldplay/shared';
import { PortPool } from '../services/port-pool.service.js';

describe('PortPool', () => {
  it('allocates unique ports in order', () => {
    const portPool = new PortPool(11000, 11002);

    expect(portPool.allocate()).toBe(11000);
    expect(portPool.allocate()).toBe(11001);
    expect(portPool.allocate()).toBe(11002);
  });

  it('throws when the pool is exhausted', () => {
    const portPool = new PortPool(11000, 11000);

    portPool.allocate();

    expect(() => portPool.allocate()).toThrow(
      ERROR_MESSAGES.RTP_PORT_POOL_EXHAUSTED
    );
  });

  it('returns a released port to the pool', () => {
    const portPool = new PortPool(11000, 11000);

    const port = portPool.allocate();
    const wasReleased = portPool.release(port);

    expect(wasReleased).toBe(true);
    expect(portPool.allocate()).toBe(port);
  });

  it('does not release a port that was not allocated', () => {
    const portPool = new PortPool(11000, 11000);

    expect(portPool.release(11000)).toBe(false);
  });

  it('does not release the same port twice', () => {
    const portPool = new PortPool(11000, 11000);

    const port = portPool.allocate();

    expect(portPool.release(port)).toBe(true);
    expect(portPool.release(port)).toBe(false);
  });
});

import { ERROR_MESSAGES } from '@worldplay/shared';

const MIN_RTP_PORT = 11000;
const MAX_RTP_PORT = 12999;

export class PortPool {
  constructor(minPort, maxPort) {
    this.availablePorts = new Set();
    this.allocatedPorts = new Set();

    for (let port = minPort; port <= maxPort; port += 1) {
      this.availablePorts.add(port);
    }
  }

  allocate() {
    const nextAvailablePort = this.availablePorts.values().next();

    if (nextAvailablePort.done) {
      throw new Error(ERROR_MESSAGES.RTP_PORT_POOL_EXHAUSTED);
    }

    const port = nextAvailablePort.value;

    this.availablePorts.delete(port);
    this.allocatedPorts.add(port);

    return port;
  }

  release(port) {
    if (!this.allocatedPorts.has(port)) {
      return false;
    }

    this.allocatedPorts.delete(port);
    this.availablePorts.add(port);

    return true;
  }
}

export const rtpPortPool = new PortPool(MIN_RTP_PORT, MAX_RTP_PORT);

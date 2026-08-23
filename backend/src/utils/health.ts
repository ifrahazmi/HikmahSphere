export type KeepalivePayload = {
  status: 'success';
  keepalive: true;
  timestamp: string;
  uptimeSeconds: number;
  services: {
    database: 'connected' | 'disconnected';
  };
};

export const createKeepalivePayload = (
  databaseConnected: boolean,
  now: Date = new Date(),
  uptimeSeconds: number = process.uptime()
): KeepalivePayload => ({
  status: 'success',
  keepalive: true,
  timestamp: now.toISOString(),
  uptimeSeconds: Math.max(0, Math.floor(uptimeSeconds)),
  services: {
    database: databaseConnected ? 'connected' : 'disconnected',
  },
});

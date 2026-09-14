import dgram from 'dgram';
const DISCOVERY_PORT = 4001;
const socket = dgram.createSocket('udp4');

export function startDiscovery(onFound) {
  socket.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.deviceId && data.ip === rinfo.address) onFound({ id: data.deviceId, name: data.deviceName || data.deviceId, ip: rinfo.address, port: data.port || DISCOVERY_PORT });
    } catch (e) { /* ignore bad packets */ }
  });
  socket.bind(DISCOVERY_PORT, () => console.log('LAN discovery listening on UDP', DISCOVERY_PORT));
}

export function announce(deviceId, deviceName, port = DISCOVERY_PORT) {
  const s = dgram.createSocket('udp4');
  s.bind(() => {
    const msg = Buffer.from(JSON.stringify({ deviceId, deviceName, port, ts: Date.now() }));
    s.send(msg, 0, msg.length, DISCOVERY_PORT, '255.255.255.255');
  });
  setInterval(() => {
    const msg = Buffer.from(JSON.stringify({ deviceId, deviceName, port, ts: Date.now() }));
    s.send(msg, 0, msg.length, DISCOVERY_PORT, '255.255.255.255');
  }, 5000);
}

const http = require('node:http');
const { URL } = require('node:url');

const HOST = process.env.API_HOST || '0.0.0.0';
const PORT = Number(process.env.API_PORT || 3001);

const fieldMetadata = [
  { key: 'temperature', name: '温度', unit: '℃' },
  { key: 'current', name: '电流', unit: 'A' },
  { key: 'status', name: '状态', unit: '' }
];

const devices = [
  { id: 'D001', name: '1号进线柜' },
  { id: 'D002', name: '2号变压器' },
  { id: 'D003', name: '3号负载' },
  { id: 'D004', name: '4号母联柜' }
];

const realtimeData = new Map();
let currentUpdatedAt = new Date().toISOString();

const round = (value, precision = 1) => Number(value.toFixed(precision));
const randomBetween = (min, max, precision = 1) =>
  round(min + Math.random() * (max - min), precision);

const createDeviceSnapshot = () => ({
  temperature: randomBetween(22, 36, 1),
  current: randomBetween(5, 80, 2),
  status: Math.random() > 0.18 ? '运行' : '停止'
});

const refreshCurrent = () => {
  devices.forEach((device) => {
    const previous = realtimeData.get(device.id) || createDeviceSnapshot();
    realtimeData.set(device.id, {
      ...previous,
      current: randomBetween(5, 80, 2)
    });
  });
  currentUpdatedAt = new Date().toISOString();
};

devices.forEach((device) => {
  realtimeData.set(device.id, createDeviceSnapshot());
});
setInterval(refreshCurrent, 5000);

const sendJson = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(body));
};

const getRequestedDeviceIds = (searchParams) => {
  const ids = searchParams.get('ids');
  if (!ids || ids === 'all') {
    return devices.map((device) => device.id);
  }

  return ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
};

const getRealtimePayload = (ids) => {
  const data = {};
  const unknownIds = [];

  ids.forEach((id) => {
    const snapshot = realtimeData.get(id);
    if (!snapshot) {
      unknownIds.push(id);
      return;
    }
    data[id] = snapshot;
  });

  return { data, unknownIds };
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null);
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, {
      code: 405,
      message: 'Method Not Allowed'
    });
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(res, 200, {
      code: 0,
      message: 'ok',
      data: {
        uptime: process.uptime(),
        currentUpdatedAt
      }
    });
    return;
  }

  if (url.pathname === '/api/devices') {
    sendJson(res, 200, devices);
    return;
  }

  if (url.pathname === '/api/device/fields') {
    sendJson(res, 200, fieldMetadata);
    return;
  }

  if (url.pathname === '/api/device/realtime') {
    const ids = getRequestedDeviceIds(url.searchParams);
    const { data, unknownIds } = getRealtimePayload(ids);

    sendJson(res, 200, {
      code: 0,
      message: 'ok',
      data,
      unknownIds,
      updatedAt: currentUpdatedAt
    });
    return;
  }

  sendJson(res, 404, {
    code: 404,
    message: 'Not Found',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/devices',
      'GET /api/device/fields',
      'GET /api/device/realtime?ids=D001,D002'
    ]
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Mock device API listening on http://${HOST}:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET /api/devices');
  console.log('  GET /api/device/fields');
  console.log('  GET /api/device/realtime?ids=D001,D002');
});

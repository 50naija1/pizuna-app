// lib/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token, baseUrl = null) {
  if (!token) throw new Error('token required to connect socket');
  // default to API_BASE if baseUrl not provided
  const url = baseUrl || global.__API_BASE__ || 'http://localhost:4000';
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect_error', (err) => {
    console.warn('socket connect_error', err.message);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

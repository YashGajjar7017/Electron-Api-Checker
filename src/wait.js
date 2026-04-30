const fs = require('fs');
const path = require('path');

// Check if a process is listening on a port
const isPortOpen = (port) => {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();

    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, 'localhost');
  });
};

// Wait for React dev server to start
const waitForPort = async (port, timeout = 30000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await isPortOpen(port)) {
      console.log(`Port ${port} is ready!`);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error(`Timeout waiting for port ${port}`);
  process.exit(1);
};

waitForPort(3000);

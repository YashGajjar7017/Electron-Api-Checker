const fs = require('fs');
const path = require('path');

// Check if a process is listening on a port
const isPortOpen = (port) => {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    server.once('error', () => {
      // Error means port is already in use (server is running)
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      // Successfully listened means port was free (no server running)
      resolve(true);
    });
    server.listen(port, 'localhost');
  });
};

// Wait for React dev server to start
const waitForPort = async (port, timeout = 30000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await isPortOpen(port)) {
      console.log(`Port ${port} is now open!`);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error(`Timeout waiting for port ${port}`);
  return false;
};

waitForPort(3000);

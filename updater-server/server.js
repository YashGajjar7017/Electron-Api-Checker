const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 4222;

app.use(cors());
app.use(express.json());

// Reference directories
const workspaceDir = path.join(__dirname, '..');
const distDir = path.join(workspaceDir, 'dist');
const packageJsonPath = path.join(workspaceDir, 'package.json');

// Read version from package.json dynamically
function getAppVersion() {
  try {
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return pkg.version || '2.0.2';
    }
  } catch (e) {
    console.error('Failed to read package.json version:', e.message);
  }
  return '2.0.2';
}

// Serve update.xml for Maintenance updating checks
app.get('/update.xml', (req, res) => {
  const version = getAppVersion();
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<update>
  <version>${version}</version>
  <url>http://localhost:${PORT}/downloads/api-checker-setup.exe</url>
  <description>Automated Electron App installer update. Removes current .exe and updates to ${version} safely, retaining all local profiles, histories, and certificate caches.</description>
</update>`);
});

// Mock download file endpoint (serves actual file from dist/ if it exists, else serves mock stream)
app.get('/downloads/:filename', (req, res) => {
  const filename = req.params.filename;
  console.log(`[Download] Client requested download: ${filename}`);

  // Try to find the file in the workspace /dist directory
  const filePath = path.join(distDir, filename);
  if (fs.existsSync(filePath)) {
    console.log(`[Download] Serving actual file from dist/ directory: ${filePath}`);
    return res.sendFile(filePath);
  }

  // Fallback: If installer files are in parent dir or root
  const rootFilePath = path.join(workspaceDir, filename);
  if (fs.existsSync(rootFilePath)) {
    console.log(`[Download] Serving actual file from root directory: ${rootFilePath}`);
    return res.sendFile(rootFilePath);
  }

  // Fallback to generating a mock data stream
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`Mock binary installer payload stream for ${filename}. Replaces current executable with updated codebase version, maintaining local storage folder intact.`);
});

// Standard API Endpoint to check for updates (JSON version)
app.get('/api/check-update', (req, res) => {
  const currentVersion = getAppVersion();
  const clientVersion = req.query.current_version || '1.0.0';
  
  // Semantic comparison
  const hasUpdate = clientVersion !== currentVersion;
  
  res.json({
    updateAvailable: hasUpdate,
    latestVersion: currentVersion,
    url: `http://localhost:${PORT}/downloads/api-checker-setup.exe`,
    releaseNotes: `Electron App upgrade to ${currentVersion}. Syncs code variables, scripts and databases while retaining user configuration caches.`,
    updatedAt: new Date().toISOString()
  });
});

// Status monitor endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    port: PORT,
    latestVersion: getAppVersion(),
    distFolderExists: fs.existsSync(distDir),
    distContent: fs.existsSync(distDir) ? fs.readdirSync(distDir) : []
  });
});

// Root route redirects to update.xml
app.get('/', (req, res) => {
  res.redirect('/update.xml');
});

app.listen(PORT, () => {
  console.log(`🚀 Updater Server running on http://localhost:${PORT}`);
  console.log(`📡 XML metadata endpoint available at http://localhost:${PORT}/update.xml`);
});

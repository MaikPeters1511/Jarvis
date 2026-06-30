const fs = require('fs');
const path = require('path');

// Read targets injected by .NET Aspire
let target = process.env.services__api__https__0 || process.env.services__api__http__0;

if (!target) {
  // If not running under Aspire, try reading local ApiService launchSettings
  try {
    const launchSettingsPath = path.resolve(__dirname, '../ApiService/Properties/launchSettings.json');
    if (fs.existsSync(launchSettingsPath)) {
      const launchSettings = JSON.parse(fs.readFileSync(launchSettingsPath, 'utf8'));
      const httpProfile = launchSettings.profiles?.http;
      if (httpProfile && httpProfile.applicationUrl) {
        target = httpProfile.applicationUrl.split(';')[0];
      }
    }
  } catch (e) {
    console.warn('[Proxy] Could not read launchSettings.json', e);
  }
}

if (!target) {
  target = 'http://localhost:5180'; // fallback
}

console.log(`[Proxy] Routing /api and /hubs to ${target}`);

module.exports = {
  '/api': {
    target: target,
    secure: false,
    changeOrigin: true
  },
  '/hubs': {
    target: target,
    secure: false,
    ws: true
  }
};

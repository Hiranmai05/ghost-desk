const { execSync } = require('child_process');

console.log('🔧 Attempting to build native addon (Windows screen-capture exclusion)...');

try {
  execSync('node-gyp rebuild', { stdio: 'inherit' });
  console.log('✅ Native addon built successfully — full WDA_EXCLUDEFROMCAPTURE support enabled.');
} catch (e) {
  console.warn('⚠️  Native addon build skipped (non-Windows or missing build tools).');
  console.warn('   GhostDesk will use setContentProtection() for screen-share invisibility.');
  console.warn('   To enable full Windows support: npm install --global windows-build-tools');
}

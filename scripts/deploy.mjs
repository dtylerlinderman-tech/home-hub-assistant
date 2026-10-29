// Build the app and copy it to Home Assistant's /config/www/kitchen, served at /local/kitchen/index.html.
//
//   npm run deploy                      (copies to \\<HA>\config\www\kitchen via the Samba share add-on)
//   npm run deploy -- D:\some\folder    (or DEPLOY_DIR=...) to copy somewhere else, e.g. a mounted share
//
// public/config.json and the photo it names (config.background) go along with the build. Other photos in
// public/backgrounds/ (like the full-size original) and config.example.json stay behind.
//
// Old build files are kept on purpose: HA tells browsers to cache /local/ for 31 days, so a tablet may keep
// an old index.html for a while, and it must still find the assets that page points to.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const haHost = (readFileSync('.env.local', 'utf8').match(/^VITE_HA_URL=https?:\/\/([^/:\s]+)/m) ?? [])[1] ?? '192.168.68.67';
const target = process.argv[2] ?? process.env.DEPLOY_DIR ?? `\\\\${haHost}\\config\\www\\kitchen`;
const share = target.startsWith('\\\\') ? target.split('\\').slice(0, 4).join('\\') : null; // \\host\config

if (share && !existsSync(share)) {
  console.error(`Can't reach ${share}.\n`
    + 'Install and start the "Samba share" add-on in Home Assistant (Settings → Add-ons), sign in to the share\n'
    + `once in File Explorer (${share}), then run this again. See ha/README-tablet.md for other options.`);
  process.exit(1);
}

console.log('Building…');
execSync('npm run build', { stdio: 'inherit' });

const cfg = JSON.parse(readFileSync('public/config.json', 'utf8'));
const keepPhoto = cfg.background ? join('dist', cfg.background) : null;
const skip = (src) => {
  const rel = relative('dist', src);
  return rel === 'config.example.json' || (rel.startsWith('backgrounds' + sep) && src !== keepPhoto);
};

mkdirSync(target, { recursive: true });

// File by file, making each folder. HA's Samba app vetoes names matching "icon?" (an old Mac junk-file
// rule), so a folder called "icons" can never be created there; the app's icons live in img/ instead.
let sent = 0;
for (const f of readdirSync('dist', { recursive: true, withFileTypes: true })) {
  const src = join(f.parentPath, f.name);
  if (!f.isFile() || skip(src)) continue;
  const dest = join(target, relative('dist', src));
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  sent++;
}
console.log(`\nCopied ${sent} files to ${target}`);
console.log(`Open http://${haHost}/local/kitchen/index.html and sign in as "kitchen".`);

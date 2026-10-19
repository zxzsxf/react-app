const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '../../formflow/packages/pc/dist');
const destination = path.resolve(__dirname, '../vendor/flowform-pc/dist');
if (!fs.existsSync(path.join(source, 'index.js'))) {
  throw new Error('Build formflow/packages/pc before syncing its runtime.');
}
fs.mkdirSync(destination, { recursive: true });
fs.cpSync(source, destination, { recursive: true, force: true });
const stripMaps = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) stripMaps(file);
    else if (entry.name.endsWith('.map')) fs.unlinkSync(file);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) {
      const contents = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, contents.replace(/^\/\/# sourceMappingURL=.*$/gm, ''), 'utf8');
    }
  }
};
stripMaps(destination);
console.log(`Synced flowform-pc runtime to ${destination}`);

const fs = require('fs')
const path = require('path')

const appRoot = path.resolve(__dirname, '..')
const vendorRoot = path.join(appRoot, 'vendor')
const packages = [
  {
    name: 'flowform-mobile',
    source: path.resolve(appRoot, '../formflow/packages/mobile'),
    built: 'dist',
    package: { main: 'dist/index.js', module: 'dist/index.esm.js', types: 'dist/index.d.ts', peerDependencies: { react: '^18.0.0', 'react-dom': '^18.0.0', '@formily/core': '^2.2.27', '@formily/react': '^2.2.27', '@formily/antd': '^2.2.27' } }
  },
  {
    name: 'remote-component-loader',
    source: path.resolve(appRoot, '../remote-component'),
    built: 'build',
    package: { main: 'build/lib/index.js', types: 'build/index.d.ts', dependencies: { 'global-cache': '^1.2.1', '@babel/runtime': '^7.7.6' }, peerDependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' } }
  },
  {
    name: 'flowform-designable-bridge',
    source: path.resolve(appRoot, '../flowform-editor/packages/designable-bridge'),
    built: 'dist',
    package: { main: 'dist/index.js', types: 'dist/index.d.ts', peerDependencies: { '@designable/core': '^1.0.0-beta.45', '@designable/formily-transformer': '^1.0.0-beta.45' } }
  }
]

for (const item of packages) {
  const destination = path.resolve(vendorRoot, item.name)
  if (!destination.startsWith(`${vendorRoot}${path.sep}`)) throw new Error('Destination escapes vendor directory')
  const builtSource = path.join(item.source, item.built)
  if (!fs.existsSync(builtSource)) throw new Error(`Build ${item.name} before syncing: ${builtSource}`)
  fs.mkdirSync(destination, { recursive: true })
  fs.cpSync(builtSource, path.join(destination, item.built), { recursive: true, force: true })
  fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({ name: item.name, version: require(path.join(item.source, 'package.json')).version, ...item.package }, null, 2) + '\n')
  console.log(`Synced ${item.name}`)
}

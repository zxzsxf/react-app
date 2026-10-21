const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} 缺少参数。`);
  }
  args.splice(index, 2);
  return value;
}

const root = path.resolve(option('--project', process.cwd()));
const configFile = path.resolve(root, option('--config', 'route-map.config.json'));
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
for (const key of ['routeSource', 'output']) {
  if (typeof config[key] !== 'string' || !config[key].trim()) {
    throw new Error(`配置缺少 ${key} 字符串：${configFile}`);
  }
}
if (!Array.isArray(config.pageDirectories) || !config.pageDirectories.length
  || config.pageDirectories.some(item => typeof item !== 'string' || !item.trim())) {
  throw new Error('配置 pageDirectories 必须为非空页面目录数组。');
}
if (!['browser', 'hash'].includes(config.router || 'browser')) {
  throw new Error('配置 router 只支持 browser 或 hash。');
}
const projectRequire = createRequire(path.join(root, 'package.json'));
const ts = projectRequire('typescript');
const { matchRoutes } = projectRequire('react-router-dom');
const routeSource = config.routeSource;
const mapFile = path.resolve(root, config.output);
const pageDirectories = config.pageDirectories.map(directory => `${directory.replace(/\\/g, '/').replace(/\/$/, '')}/`);
const relative = file => path.relative(root, file).split(path.sep).join('/');

function resolveModule(specifier) {
  const base = path.resolve(root, path.dirname(routeSource), specifier);
  const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`];
  for (const extension of ['tsx', 'ts', 'jsx', 'js']) {
    candidates.push(path.join(base, `index.${extension}`));
  }
  const file = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!file) {
    throw new Error(`无法解析路由组件：${specifier}`);
  }
  return relative(file);
}

function attribute(opening, name) {
  return opening.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.text === name);
}

function stringAttribute(opening, name) {
  const item = attribute(opening, name);
  if (!item) {
    return undefined;
  }
  const value = item.initializer;
  if (value && ts.isStringLiteral(value)) {
    return value.text;
  }
  if (value && ts.isJsxExpression(value) && value.expression && ts.isStringLiteral(value.expression)) {
    return value.expression.text;
  }
  throw new Error(`${name} 必须为静态字符串；请调整映射脚本以支持新的路由写法。`);
}

function readSavedMap(allowMissing = false) {
  if (!fs.existsSync(mapFile)) {
    if (allowMissing) {
      return { routes: [] };
    }
    throw new Error('映射不存在，请执行 npm run routes:generate。');
  }
  const saved = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  if (!saved || !Array.isArray(saved.routes)) {
    throw new Error(`映射必须包含 routes 数组：${relative(mapFile)}`);
  }
  const paths = new Set();
  for (const entry of saved.routes) {
    if (!entry || typeof entry.path !== 'string' || paths.has(entry.path)) {
      throw new Error(`映射中存在无效或重复的路由 path：${relative(mapFile)}`);
    }
    paths.add(entry.path);
  }
  return saved;
}

function generate(saved, renames = []) {
  const source = ts.createSourceFile(
    routeSource,
    fs.readFileSync(path.join(root, routeSource), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const imports = new Map();
  const routes = [];
  if (source.parseDiagnostics.length) {
    throw new Error(`路由文件存在语法错误：${routeSource}`);
  }

  function collectImports(node) {
    if (ts.isImportDeclaration(node) && node.importClause && node.moduleSpecifier.text.startsWith('.')) {
      const file = resolveModule(node.moduleSpecifier.text);
      if (node.importClause.name) {
        imports.set(node.importClause.name.text, file);
      }
      const bindings = node.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const item of bindings.elements) {
          imports.set(item.name.text, file);
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = node.initializer;
      if (ts.isCallExpression(initializer) && ['React.lazy', 'lazy'].includes(initializer.expression.getText(source))) {
        function findImport(child) {
          if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword) {
            const specifier = child.arguments[0];
            if (!specifier || !ts.isStringLiteral(specifier)) {
              throw new Error('懒加载路由必须使用静态 import 路径。');
            }
            imports.set(node.name.text, resolveModule(specifier.text));
          }
          ts.forEachChild(child, findImport);
        }
        findImport(initializer);
      }
    }
    ts.forEachChild(node, collectImports);
  }
  collectImports(source);

  function visit(node, parentPath = '/', layouts = []) {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (!opening || opening.tagName.getText(source) !== 'Route') {
      ts.forEachChild(node, child => visit(child, parentPath, layouts));
      return;
    }
    if (opening.attributes.properties.some(item => ts.isJsxSpreadAttribute(item))) {
      throw new Error('暂不支持 Route 的展开属性，请扩展路由适配器。');
    }
    const routePath = stringAttribute(opening, 'path');
    const fullPath = routePath?.startsWith('/')
      ? routePath
      : path.posix.join(parentPath, routePath || '');
    const element = attribute(opening, 'element');
    const components = [];
    let redirect;

    function inspectElement(child) {
      const tag = ts.isJsxElement(child) ? child.openingElement : ts.isJsxSelfClosingElement(child) ? child : null;
      if (tag) {
        const name = tag.tagName.getText(source);
        if (name === 'Navigate') {
          redirect = stringAttribute(tag, 'to');
          if (!redirect?.startsWith('/')) {
            throw new Error('当前适配器仅支持绝对路径重定向，请扩展适配器后再使用相对重定向。');
          }
        } else if (imports.has(name)) {
          components.push({ name, file: imports.get(name), tag });
        }
      }
      ts.forEachChild(child, inspectElement);
    }
    if (element?.initializer) {
      inspectElement(element.initializer);
    }

    const children = ts.isJsxElement(node)
      ? node.children.filter(child => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child))
      : [];
    if (ts.isJsxElement(node) && node.children.some(child =>
      ts.isJsxFragment(child) || (ts.isJsxExpression(child) && child.expression))) {
      throw new Error('暂不支持 Route 子级的片段、条件或循环表达式，请扩展路由适配器。');
    }
    const page = components.find(component => pageDirectories.some(directory => component.file.startsWith(directory)));
    const wrappers = components.filter(component => component !== page).map(component => component.file);
    const context = [...layouts, ...wrappers];

    if (page || redirect !== undefined) {
      const entry = { path: fullPath, routeSource, layouts };
      if (page) {
        entry.page = page.file;
        entry.component = page.name;
        const props = {};
        for (const item of page.tag.attributes.properties) {
          if (ts.isJsxSpreadAttribute(item)) {
            throw new Error(`页面 ${page.name} 存在展开 props，请扩展路由适配器。`);
          }
          if (ts.isJsxAttribute(item)) {
            props[item.name.text] = stringAttribute(page.tag, item.name.text);
          }
        }
        if (Object.keys(props).length) {
          entry.pageProps = props;
        }
      }
      if (redirect !== undefined) {
        entry.redirect = redirect;
      }
      if (wrappers.length) {
        entry.wrappers = wrappers;
      }
      routes.push(entry);
    } else if (!children.length) {
      throw new Error(`路由 ${fullPath} 无法解析页面或重定向；请调整脚本，避免生成不完整映射。`);
    }

    for (const child of children) {
      visit(child, fullPath, context);
    }
  }
  visit(source);
  if (!routes.length) {
    throw new Error(`未找到路由；请确认配置的路由入口：${routeSource}`);
  }
  const metadata = new Map(saved.routes.map(entry => [entry.path, entry]));
  for (const [from, to] of renames) {
    if (!metadata.has(from) || metadata.has(to) || !routes.some(entry => entry.path === to)
      || routes.some(entry => entry.path === from)) {
      throw new Error(`无法迁移 ${from} → ${to}：旧路径必须仅存在于原映射，新路径必须仅存在于当前源码。`);
    }
    metadata.set(to, metadata.get(from));
    metadata.delete(from);
  }
  const routePaths = new Set();
  for (const entry of routes) {
    if (routePaths.has(entry.path)) {
      throw new Error(`存在重复路由模式 ${entry.path}，请调整脚本以区分嵌套路由。`);
    }
    routePaths.add(entry.path);
    const meta = metadata.get(entry.path);
    for (const key of ['title', 'description']) {
      entry[key] = typeof meta?.[key] === 'string' ? meta[key] : '';
    }
  }
  return { version: 3, routeSource, router: config.router || 'browser', routes };
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readCurrentMap() {
  const saved = readSavedMap();
  if (serialize(saved) !== serialize(generate(saved))) {
    throw new Error('映射与源码不一致，请执行 npm run routes:generate，并检查 diff。');
  }
  for (const entry of saved.routes) {
    for (const key of ['title', 'description']) {
      if (typeof entry[key] !== 'string' || !entry[key].trim()) {
        throw new Error(`路由 ${entry.path} 缺少 ${key}，请直接在 ${relative(mapFile)} 中补充。`);
      }
    }
  }
  return saved;
}

function main() {
  const renames = [];
  let index;
  while ((index = args.indexOf('--rename')) !== -1) {
    const [from, to] = args.slice(index + 1, index + 3);
    if (!from || !to || from.startsWith('--') || to.startsWith('--') || from === to) {
      throw new Error('--rename 需要两个不同的完整路由模式：--rename <旧路径> <新路径>');
    }
    renames.push([from, to]);
    args.splice(index, 3);
  }
  const [mode, input] = args;
  if (renames.length && mode !== '--write') {
    throw new Error('--rename 仅可与 --write（routes:generate）一起使用。');
  }
  if (mode === '--write') {
    const map = generate(readSavedMap(true), renames);
    fs.mkdirSync(path.dirname(mapFile), { recursive: true });
    fs.writeFileSync(mapFile, serialize(map), 'utf8');
    console.log(`已生成 ${map.routes.length} 条路由：${relative(mapFile)}`);
    const incomplete = map.routes.filter(entry => !entry.title.trim() || !entry.description.trim());
    if (incomplete.length) {
      console.log(`请在映射中补齐 title 和 description 后执行 routes:check：${incomplete.map(entry => entry.path).join(', ')}`);
    }
    return;
  }
  if (mode === '--check') {
    const map = readCurrentMap();
    console.log(`路由映射校验通过（${map.routes.length} 条）。`);
    return;
  }
  if (mode === '--url' && input) {
    const map = readCurrentMap();
    const url = new URL(input, 'http://route-map.local');
    const pathname = map.router === 'hash' && url.hash
      ? new URL(url.hash.slice(1), 'http://route-map.local').pathname
      : url.pathname;
    const matches = matchRoutes(map.routes.map(entry => ({ path: entry.path })), pathname);
    if (!matches) {
      throw new Error(`没有匹配路由：${pathname}；请检查 URL 或路由入口。`);
    }
    const match = matches[matches.length - 1];
    const entry = map.routes.find(item => item.path === match.route.path);
    const result = { ...entry, params: match.params };
    if (entry.redirect) {
      const targetPath = new URL(entry.redirect, 'http://route-map.local').pathname;
      const targetMatches = matchRoutes(map.routes.map(item => ({ path: item.path })), targetPath);
      if (targetMatches) {
        result.redirectTarget = map.routes.find(item => item.path === targetMatches[targetMatches.length - 1].route.path);
      }
    }
    console.log(serialize(result).trimEnd());
    return;
  }
  throw new Error('用法：node <skill>/scripts/route-map.cjs [--project <项目目录>] [--config <配置路径>] --write [--rename <旧路径> <新路径>] | --check | --url <URL或路径>');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

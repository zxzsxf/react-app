# 单测使用文档

测试分类和各文件覆盖的功能见 [README](README.md)。以下命令均在项目根目录执行，兼容 PowerShell，无需设置额外的 `CI` 环境变量。

## 1. 准备环境

项目现有本地联调使用 Node.js 18.17.1 和 npm。先安装依赖：

```bash
npm ci
```

`package.json` 中部分依赖引用本地 `vendor` 目录，该目录被 Git 忽略。新环境需要先按项目现有联调流程准备这些依赖，再运行安装命令；已经安装好依赖时可直接执行测试。

测试命令会自动使用 `NODE_ENV=test`。无需启动 React 开发服务器、Express、CLI 或独立表单编辑器，也无需为 iframe 测试手动设置编辑器地址，该用例会自行配置和清理环境。

## 2. 运行全部测试

执行一次并退出，适用于提交前检查和 CI：

```bash
npm run test:ci
```

该命令等价于 `npm test -- --watchAll=false --runInBand`。`--runInBand` 串行运行测试文件，`--watchAll=false` 关闭监听；失败时返回非零退出码。

开发时进入交互监听：

```bash
npm test
```

在交互终端中，默认监听与改动相关的测试；按 `a` 运行全部，按 `p` 按路径筛选，按 `t` 按测试名称筛选，按 `q` 退出。持续监听全部测试可使用 `npm test -- --watchAll`。

## 3. 按类别运行

基础逻辑和 API 封装：

```bash
npm run test:unit
```

组件渲染和通信：

```bash
npm run test:components
```

页面交互和业务流程：

```bash
npm run test:pages
```

这三个命令都会执行一次并退出。

## 4. 运行指定文件或用例

使用完整路径运行指定文件，避免名称相近的文件被一起匹配：

```bash
npm run test:ci -- --runTestsByPath src/tests/pages/LowCodeFormBuilderPage.test.tsx
```

只验证拖拽交互：

```bash
npm run test:ci -- --runTestsByPath src/tests/pages/LowCodeFormBuilderPage.drag.test.tsx
```

使用测试名称筛选单条用例，`-t` 接受正则表达式：

```bash
npm run test:unit -- -t "rejects missing targets and conflicting field names"
```

`--` 后面的参数会传给 Jest。仅检查测试发现结果、不执行用例：

```bash
npm run test:ci -- --listTests
```

## 5. 查看覆盖率

```bash
npm run test:ci -- --coverage
```

运行后终端会输出覆盖率摘要，可打开 `coverage/lcov-report/index.html` 查看逐文件报告。`coverage` 已被 Git 忽略，无需提交。

默认统计本次测试加载的业务模块。要同时看到尚未被测试引用的业务文件，可明确指定范围：

```bash
npm run test:ci -- --coverage --collectCoverageFrom="src/lowcode/**/*.{ts,tsx}" --collectCoverageFrom="src/pages/**/*.{ts,tsx}"
```

项目目前未设置覆盖率门槛；测试通过不代表所有业务路径均已覆盖。

## 6. 新增与维护用例

1. 按职责选择 `unit`、`components` 或 `pages`，使用 `模块名.test.ts` 或 `组件名.test.tsx` 命名。复杂交互可以使用 `模块名.场景.test.tsx` 拆分。
2. 从测试目录引用业务实现，例如 `../../lowcode/schema-drag` 或 `../../pages/LowCodeManagerPage`。`jest.mock` 的相对路径也从当前测试文件计算，必须指向同一个业务模块。
3. 复用现有 Jest、React `act`、`createRoot` 和 `Simulate` 写法。React 18 DOM 用例需设置 `IS_REACT_ACT_ENVIRONMENT`，并将渲染、交互和异步更新包在 `act` 内。
4. mock 请求、远程组件、路由和必要的浏览器 API，避免用例依赖真实服务或网络。优先断言界面行为、表单值或请求参数。
5. 在 `afterEach` 或 `finally` 中卸载 React root、删除 DOM 容器，恢复修改过的全局对象、环境变量和计时器；使用本地存储的用例应清理存储，避免串扰。
6. 先执行对应分类命令，提交前执行 `npm run test:ci`；新增测试文件或覆盖场景后同步更新 [README](README.md)。

基础逻辑用例示例：

```ts
import { moveSchemaNode } from '../../lowcode/schema-drag';
import { SchemaNode } from '../../lowcode/api';

test('移动到不存在的节点时不修改原始数据', () => {
  const schema: SchemaNode = {
    type: 'object',
    properties: {
      name: { type: 'string', 'x-component': 'Input' },
    },
  };
  const original = JSON.parse(JSON.stringify(schema));

  const result = moveSchemaNode(schema, 'name', {
    path: 'missing',
    placement: 'after',
  });

  expect(result).toBeUndefined();
  expect(schema).toEqual(original);
});
```

## 7. 常见问题

- **命令一直不退出**：`npm test` 默认进入监听模式，自动化场景使用 `npm run test:ci`。
- **提示 No tests found**：确认在项目根目录执行，路径位于 `src/tests` 且文件名符合 `.test.ts` / `.test.tsx`；用 `--listTests` 检查发现结果。
- **迁移后模块或 mock 找不到**：检查导入和 `jest.mock` 是否仍使用旧目录下的相对路径。
- **缺少 flowform 或远程加载器依赖**：检查本地 `vendor` 包是否准备完整，并重新安装依赖。测试 mock 不能代替其他模块所需的真实依赖包。
- **出现 defaultProps、fill-rule 等警告**：当前第三方组件在 React 18 下已有这些警告，以最终 `Test Suites` / `Tests` 汇总和退出码判断是否通过；新增警告仍应检查来源。
- **React act 或计时器相关失败**：检查异步更新是否已等待、是否在卸载组件后恢复真实计时器，以及测试替换的全局对象是否恢复。

# 单测介绍

本目录集中维护项目的自动化测试，覆盖低代码表单的基础逻辑、组件行为和页面流程。测试使用 Create React App（`react-scripts`）内置的 Jest、jsdom，以及 React DOM 测试工具，无需额外配置 Jest。

运行命令、环境准备和新增用例规范见[单测使用文档](USAGE.md)。项目入口见[根目录 README](../../README.md)。

## 目录结构

```text
src/tests/
├── README.md                             # 测试介绍、分类与覆盖范围
├── USAGE.md                              # 环境准备、执行与维护方法
├── unit/                                 # 基础逻辑与 API 封装
│   ├── api.test.ts
│   └── schema-drag.test.ts
├── components/                           # 组件渲染与通信
│   ├── DesignerShell.test.tsx
│   ├── FlowformManageEditor.test.tsx
│   └── MobileRenderer.test.tsx
└── pages/                                # 页面交互与业务流程
    ├── LowCodeFormBuilderPage.test.tsx
    ├── LowCodeFormBuilderPage.drag.test.tsx
    ├── LowCodeManageEditorPage.test.tsx
    ├── LowCodeManagerPage.test.tsx
    └── LowCodeTemplateWizardPage.test.tsx
```

测试保留在 `src` 内，以兼容 Create React App 默认的测试发现范围。业务实现仍位于 `src/lowcode` 和 `src/pages`；测试通过相对路径引用实现，新增用例统一归入本目录。

## 分类与覆盖范围

### unit：基础逻辑

- `api.test.ts`：活跃组件接口地址、版本与显示信息映射，以及 HTTP 成功时的业务错误处理。通过 mock `fetch` 验证请求。
- `schema-drag.test.ts`：Schema 节点排序、跨容器移动、整容器移动、原始数据不变，以及非法目标、循环嵌套和同名字段冲突处理。

### components：组件行为

- `DesignerShell.test.tsx`：React 18 下设计器挂载、Shadow DOM 图标更新与根复用，以及 Card/Input Schema 的读写保留。
- `FlowformManageEditor.test.tsx`：iframe 握手初始化、读取和保存、来源与协议校验、超时重试、重新加载和会话切换，以及缺失线上编辑器地址时的提示。
- `MobileRenderer.test.tsx`：远程 Input 在 Card 内写入 Formily 表单值，嵌套节点选择和删除，以及预览时隐藏编辑操作。

### pages：页面流程

- `LowCodeFormBuilderPage.test.tsx`：内嵌组件配置展示和属性绑定更新。
- `LowCodeFormBuilderPage.drag.test.tsx`：模拟拖拽事件，验证排序、容器内外移动、选中状态与配置保留，以及预览时禁用拖拽。
- `LowCodeManageEditorPage.test.tsx`：模板保存时清理 Schema 和组件锁、配置字段绑定检查、重复保存拦截、revision 冲突、发布失败重试，以及新建草稿首次保存与创建失败重试。
- `LowCodeManagerPage.test.tsx`：创建模板时进入本地草稿，组件配置列表使用活跃组件并保留版本标识。
- `LowCodeTemplateWizardPage.test.tsx`：三步向导、本地修改、活跃组件筛选、组件配置应用，以及完成时统一保存和清理草稿。

## 测试边界

这里统一称为单测，其中组件与页面用例也覆盖多个模块协作。它们在 jsdom 中运行，按需 mock API、路由、远程组件和 iframe 消息，不依赖实际后端或编辑器服务。

这些用例不覆盖真实浏览器布局、原生拖拽体验、真实跨域 iframe 联调和服务端持久化。设计器相关用例会加载本地依赖包，因此仍需安装完整项目依赖。

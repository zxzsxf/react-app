# 项目接入

## 安装和配置

先追踪真实应用入口，确认实际路由源；菜单或废弃 router 文件不能代替路由事实。当前脚本需要目标项目已有 `typescript` 和提供 `matchRoutes` 的 `react-router-dom`（v6/v7），通过项目的 package.json 解析依赖，不要求技能源仓库安装依赖。

将整个 `frontend-navigation` 目录复制到目标项目的 `.agents/skills/`。不覆盖已有同名 Skill 的项目知识，先将项目说明迁移到 docs。

在目标项目根目录创建 `route-map.config.json`，路径全部相对项目根目录：

```json
{
  "routeSource": "src/App.tsx",
  "pageDirectories": ["src/pages"],
  "output": "docs/frontend/route-map.json",
  "notes": "docs/frontend/navigation-notes.md",
  "router": "browser"
}
```

`routeSource`、`pageDirectories` 和 `output` 必填；`notes` 可选，存放项目特有定位知识；router 支持 browser（默认）和 hash。pageDirectories 可设置多个目录，其余路由内的本地组件记录为布局或包装。路由仍以源码中相对 import 为准。

## 页面元数据

执行 `npm run routes:generate` 后，直接在映射的 routes 条目内填写 title 和 description（包括重定向入口）。动态参数保留占位符，不为每个业务 ID 建记录。以下为示意条目，其他结构字段由脚本生成：

```json
{
  "path": "/orders/:id",
  "title": "订单详情",
  "description": "按 id 展示订单信息及处理状态。"
}
```

只人工修改 title 和 description，结构字段由源码决定。生成脚本按相同 path 保留已有文案，为新条目创建空字符串，并移除源码中已删除的路由；check/find 拒绝空白文案或过期结构。映射中的 title 不等于 document.title；动态标题的来源写进 description 或 notes。文案准确性需要人工核对，check 不能推断页面职责。

路由改名时，在源码修改后、普通重新生成前执行 `npm run routes:generate -- --rename "/orders/:id" "/purchases/:id"`，显式保留原文案（可重复 --rename 迁移多条）。旧路径必须仅存在于原映射，新路径必须仅存在于源码，避免覆盖或误迁移。若已重新生成而丢失旧条目，从 Git diff/修改前内容恢复文案，或为新条目重新编写。

## 项目命令

保留已有 package scripts，新增：

```json
{
  "routes:generate": "node .agents/skills/frontend-navigation/scripts/route-map.cjs --write",
  "routes:check": "node .agents/skills/frontend-navigation/scripts/route-map.cjs --check",
  "routes:find": "node .agents/skills/frontend-navigation/scripts/route-map.cjs --url"
}
```

在项目根目录运行 `npm run routes:generate`，补齐文案，再运行 `npm run routes:check` 和 `npm run routes:find -- "/真实路径"`，核对命中页面。脚本默认以工作目录为项目根，支持 `--project <项目目录>` 和 `--config <相对项目根的配置路径>`，也可以直接运行技能源中的脚本。

在项目 README 中记录：generate 更新结构并保留文案；check 检查结构一致性和文案完整性，失败返回非零状态；find 加引号传入路径或完整 URL，只输出命中条目并先校验映射。还应说明新增路由补文案、删除路由移除条目、改名使用 --rename，以及普通样式修改无需生成。开发者不应必须阅读 Skill 接入文档才能找到项目命令。

首次接入检查静态页面、动态参数、通配符、重定向以及无匹配情况；仅测试项目实际使用的结构。脚本不运行应用源码。更换框架或路由形式前调整适配器。

## 项目约束

将以下简短规则合并到目标项目 AGENTS.md，保留原有内容：

```markdown
## 页面映射

- 根据 URL 定位页面时，使用 .agents/skills/frontend-navigation/SKILL.md 的查询流程。
- route-map.config.json 指定路由源、映射位置和可选特殊说明；title 和 description 直接在映射中维护。
- 路由或页面入口变化时执行 npm run routes:generate，补齐新条目的文案；脚本按 path 保留已有文案。路由改名先使用 generate -- --rename 旧路径 新路径 迁移文案。页面职责或特殊定位规则变化时，同步修改文案及说明。
- 完成相关修改前执行 npm run routes:check，将生成结果与源码一起提交；普通样式和无关业务逻辑修改无需重新生成。
```

如项目已有 CI，可按用户授权接入 routes:check；本 Skill 不自动创建提交钩子或 CI。技能源是通用 Skill 的维护位置，项目内副本是可移植安装结果，二者不通过跨仓库路径依赖连接。

已有项目从独立元数据方案升级时，先确认当前映射已包含全部 title/description，再移除 metadata 配置和独立元数据文件，更新脚本并重新生成校验；不能先删掉尚未迁入映射的文案。

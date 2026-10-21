---
name: frontend-navigation
description: 根据前端页面 URL 查询路由与工程文件映射，维护页面标题、说明、入口、布局和重定向。用于定位页面实现、变更路由或页面职责，以及为 React Router JSX 项目建立映射时。
---

# 前端页面定位与映射维护

本 Skill 提供可配置的 React Router JSX 映射脚本。项目知识保存在目标项目中，通用逻辑保存在本 Skill 中。

## 定位页面

1. 在目标项目根目录读取 `route-map.config.json`，确定路由源、映射和可选的特殊说明文件。首次接入或调整脚本时阅读 [references/setup.md](references/setup.md)。
2. 执行 `npm run routes:find -- "/目标路径"`，或 `node <本Skill目录>/scripts/route-map.cjs --project <项目根目录> --url "/目标路径"`。完整 URL 加引号。只读取命中条目，不默认读取完整映射。
3. 通过 `title` 和 `description` 确认页面用途，读取 `page`，再按需追踪 `layouts`、`wrappers`、`pageProps`。有 `redirect` 时查看 `redirectTarget`，更长的跳转链继续查询。
4. 涉及 query/hash、页面默认导出转发、远程组件或动态表单时，按需读取配置的 `notes` 文件并追踪源码。元数据标签不能替代源码证据。

脚本支持动态参数、通配符、尾随斜杠及 browser/hash URL。域名不参与匹配。query 不参与路由匹配，但可能改变页面行为；hash 模式的页面路径取自 URL 的 hash。

## 维护映射

- 实际路由源码是结构事实来源。路由入口、路径、布局、包装、页面 import 或静态字符串 props 变化后，执行 `npm run routes:generate`。
- `title` 和 `description` 直接在映射的 routes 条目中人工维护；结构字段由脚本刷新，按相同 path 保留原文案。首次生成和新增路由的文案留空，读取源码后补齐，再执行校验。删除路由会移除对应条目，不维护第二份元数据。
- 路由改名后、普通重新生成前，执行 `npm run routes:generate -- --rename "/旧路径" "/新路径"` 显式迁移文案，可重复指定 --rename。不按组件名猜测迁移，避免共用页面误配。迁移后核对文案；若已生成导致旧条目被移除，从 Git diff/修改前内容恢复文案或重新编写。
- title 是稳定的页面用途标签，不设置浏览器标题；description 简述用途和影响定位的参数。页面职责变化时直接编辑这两个字段并校验，无需重新生成。动态表单标题保留为运行时数据，说明中注明来源。
- 更新特殊页面的转发、query/hash 或动态渲染机制时，同步修改项目的 `notes`。普通样式和无关业务逻辑修改无需重新生成。
- 完成相关变更前执行 `npm run routes:check`，检查映射 diff。缺少标题/说明、重复路径、缺失组件文件或过期结构都会失败；允许手改文案，不手改生成的结构字段。文案的语义准确性需结合源码核对。

## 复用与边界

首次接入按 [references/setup.md](references/setup.md) 创建项目配置和简短的 AGENTS.md 维护规则，生成映射并补齐文案，在项目 README 中记录三个命令的作用和用法。复制整个 Skill 目录到项目 `.agents/skills/frontend-navigation/`，npm 命令引用其中的脚本；不依赖相邻技能源目录的绝对路径。

更新技能源时同步受影响项目的 Skill 副本并重新校验。项目特有配置和说明放项目 docs 中，不写回通用 Skill。未经请求不批量改动其他项目。

脚本面向单个路由文件中的静态 JSX Route、相对默认/命名 import、React.lazy/lazy 静态 import、绝对路径重定向以及静态字符串页面 props；pageDirectories 指定哪些组件属于页面。其他框架、文件路由、路由对象、路径别名、条件/循环生成路由、同路径的嵌套页面、相对重定向或 basename 等结构需要先扩展适配器，不能宣称已覆盖。路由入口变更时同步配置。

命令只读取本地源码、配置和已有映射，`--write` 更新映射；无法解析已有 JSON 或发现重复路径时会失败，不覆盖损坏文件。不启动页面、不访问服务端。结构一致性校验不能证明文案正确或页面运行正常。

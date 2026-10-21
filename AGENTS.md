# 页面定位与路由映射

- 本项目的页面映射位于 `docs/frontend/route-map.json`，实际路由源为 `src/App.tsx`；位置配置在 `route-map.config.json`。
- 根据 URL 定位页面时，使用 `.agents/skills/frontend-navigation/SKILL.md` 的查询流程，只读取命中条目和相关源码。
- 新增、删除、修改路由，移动或重命名页面入口，调整路由布局、包装组件或页面 props 后，执行 `npm run routes:generate` 并将映射与源码一起提交。脚本只更新结构，按路由 path 保留已有 title 和 description。
- 新路由生成后，直接在 `route-map.json` 对应条目补齐 title 和 description；页面职责变化时也只修改这两个字段。路由改名使用 `npm run routes:generate -- --rename "/旧路径" "/新路径"` 迁移文案，随后检查是否仍准确。具体命令用法见 README.md 的“页面路由映射”。
- 修改影响页面定位的 query、hash、页面转发或动态渲染规则时，同步更新 `docs/frontend/navigation-notes.md`；普通样式和无关业务逻辑修改无需更新映射。
- 涉及上述变更时，完成前执行 `npm run routes:check`。结构与源码冲突时，以源码为准重新生成；允许人工维护 title 和 description，不手改其他生成字段。
- 通用 Skill 和脚本的技能源为相邻工作区 `zxz-agent-skills/frontend-navigation/`；本项目 `.agents/skills/frontend-navigation/` 是安装副本，修改通用能力时同步两处并校验。运行命令只依赖本项目副本，不依赖相邻目录存在。

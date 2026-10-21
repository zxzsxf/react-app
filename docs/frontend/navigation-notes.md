# React App 特殊页面定位

- 应用入口链为 `src/index.tsx` → `src/App.tsx`。`src/router/index.tsx` 不在此入口链中；`src/router/TestPage.tsx` 是菜单配置。
- `/ai-chat` 的 `src/pages/AIChatPage/index.tsx` 默认导出同目录的 `RemoteAIChatPage.tsx`，实际页面应继续查看后者。`sessionId` query 选择远程会话，不切换路由入口；`LocalAIChatPage` 不是当前默认页面。
- `/forms/*` 按 pathname 匹配服务端记录的 `placement: route` 和 `path`。渲染查看 `src/components/StoredFormView.tsx`，数据访问查看 `src/flowforms/api.ts`；每个表单 URL 没有独立 TSX 页面。
- `/m/forms/:formCode` 使用 `src/lowcode/MobileRenderer.tsx` 渲染发布快照；`formCode` 选择数据，不改变入口文件。
- 鉴权和未登录重定向查看 `src/lowcode/Auth.tsx`。

`route-map.json` 的 title 是页面用途的稳定标签，不设置浏览器 document.title，也不保证与运行时动态标题一致。description 简述页面用途和影响定位的参数。这两个字段直接在映射中人工维护，生成脚本按路由 path 保留原值。页面职责、导出转发、query/hash 或动态渲染机制变化时，同步文案及本文件。

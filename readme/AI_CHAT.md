# AI 表单：NestJS / LangGraph 接入

默认 `/ai-chat` 已接入独立的 `C:\z_project\zxz-ai-form-server`。新服务使用 PostgreSQL 保存会话、消息、候选版本及 LangGraph 检查点；现有 Express/MySQL 继续管理登录、组件、模板和业务表单保存。

先按新服务 README 初始化数据库并启动 `1002`，再重启前端，让新增的 `src/setupProxy.js` 生效。`/api/lowcode/ai/*` 转发到 1002，其余请求仍走原来的 1001。

默认使用真实模型模式。服务端缺少模型配置时页面明确提示，不会回退模拟。仅开发环境显式设置 `LLM_PROVIDER=mock` 才显示“服务端模拟”。

页面支持新建/选择/删除会话，URL 中的 sessionId 用于刷新恢复；连接断开或重启后的任务可手动恢复。完整候选仅在 done 后应用；停止会取消上游任务。标题修改在下次生成或保存前同步服务端。

新增 `remote-generator.ts`、`stream.ts` 和 `api.ts`；旧的浏览器本地模拟组件以 `LocalAIChatPage` 命名导出，保留给本地单元测试，正式路由使用 `RemoteAIChatPage`。

验证命令：

```powershell
npm run test:ci -- --runTestsByPath src/tests/unit/ai-chat.test.ts src/tests/unit/ai-stream.test.ts src/tests/components/AIChatState.test.tsx src/tests/components/AIFormPreview.test.tsx src/tests/pages/AIChatPage.test.tsx src/tests/pages/RemoteAIChatPage.test.tsx
npm run build
```

真实供应商联调需要本地模型配置；受保护页面的浏览器联调需要已有 B 角色登录和已发布组件配置/模板。下面保留旧版本地模拟实现说明和历史验收记录。

## 历史：浏览器本地模拟版本

访问 `/ai-chat`，使用现有低代码平台的 B 角色账号。菜单“AI 表单”及业务表单管理页“AI 创建”均可进入。

## 当前能力

- 聊天由固定规则在浏览器中模拟，不请求模型，不需要模型 Key。
- 组件、配置、模板、表单保存使用现有 Express 服务及登录/CSRF 校验。
- 会话只保存在内存中，刷新或离开页面后清空。首次保存创建新草稿，成功后进入现有搭建器继续编辑、发布。
- 不包含图片、任意自然语言理解、字段联动、已有业务表单修改和历史会话持久化。

## 准备数据

启动 Express 和 react-app（CRA 默认代理到 `localhost:1001`），并登录 B 账号。

空白起步需要已发布、已启用、支持 mobile 的 Input 组件，并为其发布配置表单。前端按组件名与精确版本取活跃目录、已发布组件的交集，再读取其已发布配置。缺少配置的组件会显示原因，不进入可用目录。首期支持 Input、Card、Button。

模板起步选择已发布模板，复制其发布快照及组件锁。内置配置随快照保留，不替换成最新活跃版本；新增字段仅使用该模板已包含的组件。

## 模拟指令

输入框上方可直接点击以下示例，填入后发送：

- `生成姓名、手机号组成的登记表`（也支持 `生成登记表`）
- `添加备注字段`
- `添加邮箱字段`
- `将姓名设为必填`
- `取消姓名必填`
- `删除备注字段`
- `将表单标题改为：活动报名`

必填和删除指令同样支持姓名、手机号、邮箱、备注。遇到同名字段时提示在搭建器精确修改；未识别的指令仅返回能力说明，不修改表单。登记表指令添加缺少的字段，保留已有字段和 key。

Enter 发送，Shift+Enter 换行，中文输入法选词不触发发送。运行时可停止，失败或停止都保留上一份完整候选结果。切换模板、起步方式或新建会话会提示清空当前内容。

## 预览与保存

预览复用 `LowCodeRenderer`，不提交业务数据。“校验并查看表单值”仅显示本地结果；候选版本变化或点击“重置填写值”会重置填写值。远程组件加载器自带加载失败重试，页面错误边界处理渲染异常。

“保存并继续编辑”调用既有 `POST /api/lowcode/forms`，提交实际生成的 Schema、使用的组件锁和空 bindings；不发送 templateId，避免后端重新复制模板覆盖生成结果。模板起步目前作为配置副本保存，不持久化模板来源关系。

保存请求结果不明确时会锁定当前候选，点击“重试保存”先按相同 ID 查询。已创建则直接进入搭建器；确认 404 才重新提交，防止响应丢失后重复创建。查询失败会保留该次保存信息，不发起新建。

## 模块和后续接入

页面在 `src/pages/AIChatPage`，类型、组件目录、草稿处理、模拟适配器、会话 Hook、保存逻辑在 `src/ai-chat`。后续模型接口适配器只需实现 `Generator`：接收 GenerateInput 和 AbortSignal，返回 status、text_delta、draft、done 事件。仅收到 done 后才应用本轮候选；未完成或取消的结果不会覆盖之前的表单。

## 验证

```text
npm run test:ci -- --runTestsByPath src/tests/unit/ai-chat.test.ts src/tests/components/AIChatState.test.tsx src/tests/components/AIFormPreview.test.tsx src/tests/pages/AIChatPage.test.tsx
npx tsc --noEmit
npm run build
```

浏览器验收：

1. 空白起步，生成登记表，添加备注，将姓名设为必填，验证预览与校验，保存后在搭建器检查字段。
2. 选择已发布模板，修改其中姓名字段，确认组件版本保留，保存新表单并确认原模板未变。
3. 生成中停止、向上阅读聊天不跟随滚动、窄屏切换聊天/预览，以及重置会话取消确认。

真实组件、登录账号或已发布模板不足时，页面显示具体原因；不会自动创建测试物料。

### 2026-10-21 本地浏览器验收

- B 角色登录和页面访问通过；390px 手机视口自动收起侧栏、切换聊天/预览页签，1280px 桌面视口使用双栏。
- 模拟标题修改、候选版本更新、停止后保留旧候选、清空确认通过。向上滚动后新增回复，聊天区域 scrollTop 仍保持为 0，未强制跳到底部。
- 创建了一个未发布的 `AI 前端验收（空白草稿）`，编号 `f965f365f27d541909abe8c74`，真实保存并跳转现有搭建器通过。
- 当前环境没有 Input/Card 的已发布独立配置，也没有已发布模板；带真实字段的预览及模板完整闭环仍需准备这些物料后验收。未自动创建组件或模板。
- 真实 Formily 预览的填写值保留、候选切换/手动重置、校验和错误边界恢复已通过组件测试。

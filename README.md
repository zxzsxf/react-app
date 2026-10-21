# node 18.17.0

# Getting Started with Create React App

## AI 表单（前端首期）

登录 B 角色账号后打开 `/ai-chat`，可从空白或已发布模板开始，体验模拟对话生成、真实组件预览及保存新草稿。当前不调用模型，详细准备步骤、模拟指令和验收流程见 [AI 表单说明](readme/AI_CHAT.md)。

## PC 低代码表单本地联调

在三个终端中分别启动以下服务（均使用 Node 18.17.1）：

1. 在 `formflow` 运行 `yarn workspace flowform-cli build` 和 `yarn workspace flowform-pc build`；PC 包有变更时在 `react-app` 运行 `npm run sync:flowform-pc` 并执行 `npm install`。
2. 在 `react-app` 运行 `node ../formflow/packages/cli/dist/index.cjs.js start`。CLI 必须从业务项目目录启动，才会将表单写入该项目。默认监听 `127.0.0.1:7066`。
3. 在 `flowform-editor` 运行 `npm run dev`（6575）；在 `react-app` 设置 `PORT=3001` 后运行 `npm start`。只有从 `http://localhost:3001/form-builder` 打开编辑器才会使用 Express。

打开 `/test`，在“业务页表单区域”创建表单；打开 `/form-builder`，填写名称和 `/forms/` 下的地址来创建独立表单页。Editor 的地址可用 `REACT_APP_FLOWFORM_EDITOR_URL` 覆盖，默认是 `http://127.0.0.1:6575/editor`。若修改 editor 的本地端口，启动 CLI 时也需设置对应的 `FLOWFORM_EDITOR_ORIGIN`。

`public/flowforms` 与 `src/types/ff-types` 是本地 CLI 调试生成的业务项目文件。`/form-builder` 列表及 `/forms/*` 渲染页面始终从 `zxz-express-server` 读取；业务页内嵌表单沿用原有环境读取逻辑。Express 从空数据库开始，不自动导入本地文件；静态服务器应将 `/forms/*` 等前端路由回退到 `index.html`。

## 线上表单部署

构建 `react-app` 前设置 `REACT_APP_EXPRESS_API_URL` 为浏览器可访问的 Express 根地址，设置 `REACT_APP_FLOWFORM_EDITOR_URL` 为单独部署的编辑器 `/editor` 地址。编辑器构建前设置 `EXPRESS_API_URL` 为同一 Express 根地址，并设置 `FLOWFORM_RETURN_ORIGIN` 为业务应用的 origin（如 `https://app.example.com`），以启用“返回业务页面”。跨域部署时需允许业务应用和编辑器访问 Express；也可以用同源网关转发 `/api/forms`。修改这些构建变量后需重新构建。

`/form-builder` 的“创建表单”按钮及本地 `/test` 的入口只在业务工程的 development 环境显示。编辑器仅在来源为 `http://localhost:3001/form-builder` 时使用 Express；其他来源均使用 CLI。Express 的表单保存接口当前无身份鉴权，页面入口限制不限制直接调用接口。

本地 CLI 提供 `GET /api/forms`、`GET /api/forms/:formCode` 和 `POST /api/forms`。保存请求包含 `formCode`、`title`、`placement`（`inline` 或 `route`）、原始 Formily `schema`；独立页面还需提供 `/forms/` 下的 `path`。保存前会检查路由冲突并生成表单值类型。原有 `/saveAll` 接口仍可使用。

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.
You will also see any lint errors in the console.

### `npm test`

启动交互式测试监听。所有测试统一存放在 `src/tests`，按基础逻辑（`unit`）、组件（`components`）和页面（`pages`）分类。

运行全部测试并退出：`npm run test:ci`。按类别执行：`npm run test:unit`、`npm run test:components`、`npm run test:pages`。

详见[单测介绍](src/tests/README.md)和[单测使用文档](src/tests/USAGE.md)。

### `npm run build`

Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

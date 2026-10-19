# node 18.17.0

# Getting Started with Create React App

## PC 低代码表单本地联调

在三个终端中分别启动以下服务（均使用 Node 18.17.1）：

1. 在 `formflow` 运行 `yarn workspace flowform-cli build` 和 `yarn workspace flowform-pc build`；PC 包有变更时在 `react-app` 运行 `npm run sync:flowform-pc` 并执行 `npm install`。
2. 在 `react-app` 运行 `node ../formflow/packages/cli/dist/index.cjs.js start`。CLI 必须从业务项目目录启动，才会将表单写入该项目。默认监听 `127.0.0.1:7066`。
3. 在 `flowform-editor` 运行 `npm run dev`（6575）；在 `react-app` 运行 `npm start`（3000）。

打开 `/test`，在“业务页表单区域”创建表单；打开 `/form-builder`，填写名称和 `/forms/` 下的地址来创建独立表单页。Editor 的地址可用 `REACT_APP_FLOWFORM_EDITOR_URL` 覆盖，默认是 `http://127.0.0.1:6575/editor`。若修改 editor 的本地端口，启动 CLI 时也需设置对应的 `FLOWFORM_EDITOR_ORIGIN`。

`public/flowforms` 与 `src/types/ff-types` 是业务项目文件，需要提交。生产部署会从静态文件读取表单，不需要 CLI；静态服务器应将 `/forms/*` 等前端路由回退到 `index.html`。

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

Launches the test runner in the interactive watch mode.
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

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

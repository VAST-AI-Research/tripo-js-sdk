# tripo3d-sdk-js

[English](./README.md) · **简体中文**

Tripo 官方轻量 **JavaScript / TypeScript SDK**，用于访问 [Tripo3D v3 API](https://developers.tripo3d.com/zh/docs/introduction) —— 覆盖 AI 3D 生成的完整能力：文生 3D、图生 3D、多视角生 3D、重贴图、网格编辑、自动绑骨与动画重定向。

- **零运行时依赖**，直接使用平台内置 `fetch`。
- 支持 Node.js ≥ 18、Bun、Deno 以及现代浏览器 / edge runtime。
- ESM 优先，内置完整 TypeScript 类型声明（`types/`）。
- 对瞬态网络错误 / 5xx 自动重试。
- 一等的错误层级（`TripoAPIError`、`TripoTaskError`……）。
- 内置 `waitForTask()` 轮询器，支持进度回调与超时取消。
- 与 [`tripo3d-sdk-rust`](../tripo3d-sdk-rust)、[`tripo3d-sdk-go`](../tripo3d-sdk-go) 是同源姊妹 SDK —— API 能力一致，各自遵循语言惯例。

> 国内 Base URL：`https://openapi.tripo3d.com/v3`  
> 海外 Base URL：`https://openapi.tripo3d.ai/v3`  
> 本 SDK 面向 **v3** REST 接口，**不是**旧的 `/v2/openapi/task` 接口。  
> 可通过 `baseUrl` 选择区域（见[客户端参数](#客户端参数)）。

---

## 安装

```bash
npm install tripo3d-sdk-js
# 或
pnpm add tripo3d-sdk-js
# 或
yarn add tripo3d-sdk-js
```

先在 [Tripo 控制台](https://platform.tripo3d.com/) 创建 API Key，并作为环境变量导出（海外请使用 [platform.tripo3d.ai](https://platform.tripo3d.ai/)）：

```bash
export TRIPO_API_KEY="tsk_..."
```

> **安全提示**：请务必把 API Key 放在环境变量或密钥管理器中，**不要**硬编码到源码或提交到代码仓库。

## 快速开始

```js
import { TripoClient, ModelVersion } from 'tripo3d-sdk-js';

const client = new TripoClient(); // 默认读取 process.env.TRIPO_API_KEY

const taskId = await client.textToModel({
  prompt: '一只可爱的红熊猫，抱着一根竹子',
  model: ModelVersion.H3_1,
  texture: true,
  pbr: true,
  texture_quality: 'detailed',
});

const task = await client.waitForTask(taskId, {
  pollingIntervalMs: 2000,
  onProgress: (t) => console.log(`${t.status} — ${t.progress ?? 0}%`),
});

console.log('模型下载地址：', task.output.model_url);
console.log('预览渲染图：',   task.output.rendered_image_url);
```

> ⚠️ 模型 URL 会在任务成功约 **5 分钟后过期**，请及时下载。可以直接用 `client.downloadModel(task)` 把主模型抓取到 `ArrayBuffer`。

---

## 客户端参数

```ts
new TripoClient({
  apiKey?: string,                          // 默认读取 TRIPO_API_KEY 环境变量
  baseUrl?: string,                         // 国内：https://openapi.tripo3d.com/v3 · 海外：https://openapi.tripo3d.ai/v3
  fetch?: typeof globalThis.fetch,          // 可注入自定义 fetch（如 undici）
  timeoutMs?: number,                       // 单次请求超时，默认 60 秒
  retries?: number,                         // 5xx / 网络错误的额外重试次数，默认 2
  userAgent?: string,
  defaultHeaders?: Record<string, string>,
});
```

---

## API 一览

所有生成类方法都返回一个 `task_id`（`string`），随后可以用 `waitForTask()`（或 `client.run(fn, params)`）等待任务终态结果。

### 3D 生成

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `textToModel(params)` | `POST /generation/text-to-model` | 文本 → 3D 模型 |
| `imageToModel(params)` | `POST /generation/image-to-model` | 单图 → 3D 模型 |
| `multiviewToModel(params)` | `POST /generation/multiview-to-model` | 4 视角 [front, left, back, right] → 3D 模型 |
| `textToImage(params)` | `POST /generation/text-to-image` | 文生概念图 |
| `imageToImage(params)` | `POST /generation/image-to-image` | 图片风格转换 / 编辑 |
| `imageToMultiview(params)` | `POST /generation/image-to-multiview` | 单图 → 4 视角图集 |
| `editMultiview(params)` | `POST /generation/edit-multiview` | 编辑已生成的多视角图集 |

### 模型后处理

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `textureModel(params)` | `POST /models/texture` | 为已有模型重新贴图 |
| `convertModel(params)` | `POST /models/convert` | 转换为 GLTF / FBX / OBJ / STL / USDZ / 3MF |
| `segmentMesh(params)` | `POST /mesh/segment` | 语义分割 |
| `completeMesh(params)` | `POST /mesh/complete` | 网格补全 / 修复 |
| `decimateMesh(params)` | `POST /mesh/decimate` | 减面 / 重拓扑 |

### 动画

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `rigCheck(params)` | `POST /animations/rig-check` | 检查模型是否可绑骨、推荐骨骼类型 |
| `rigModel(params)` | `POST /animations/rig` | 自动绑骨 |
| `retargetAnimation(params)` | `POST /animations/retarget` | 应用预设动画 |

### 工具

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `getTask(taskId)` | `GET /tasks/{task_id}` | 查询单个任务 |
| `listTasks(taskIds)` | `POST /tasks/list` | 批量查询任务 |
| `waitForTask(taskId, opts?)` | — | 轮询直到任务进入终态 |
| `run(fn, params, waitOpts?)` | — | `waitForTask(fn(params))` 组合调用 |
| `uploadFile(blob, opts?)` | `POST /files` | 上传文件，返回 `file_token` |
| `getBalance()` | `GET /account/balance` | 查询账户余额 |
| `downloadModel(task)` | — | 把任务的主模型 URL 抓取为 `ArrayBuffer` |

---

## 传入图片 / 文件

任何接受图片的字段（`file`、`image_prompt`、`style_image` …）都支持以下形式，SDK 会自动归一化：

```js
'https://example.com/hero.png'          // 绝对 URL
'8f2a4c...'                             // 已上传的 file_token
{ file_token: '8f2a4c...' }             // 显式描述符
{ url: 'https://example.com/a.png' }
{ object: { bucket: 'tripo-data', key: 'uploads/abc.png' } }
```

上传本地文件 → 拿到 `file_token`：

```js
import { readFile } from 'node:fs/promises';

const buffer = await readFile('./hero.png');
const { file_token } = await client.uploadFile(buffer, {
  filename: 'hero.png',
  contentType: 'image/png',
});

const taskId = await client.imageToModel({
  file: file_token,
  model: 'v3.1-20260211',
});
```

---

## 端到端流水线：游戏就绪角色

`image-to-model → rig-check → rig → retarget`：

```js
import {
  TripoClient, Animation, ModelVersion, RigSpec, TaskStatus,
} from 'tripo3d-sdk-js';

const client = new TripoClient();

// 1. 图生 3D（P1 系列有干净的低面拓扑，移动端 / 游戏友好）
const modelId = await client.imageToModel({
  file: 'https://example.com/hero.png',
  model: ModelVersion.P1,
  face_limit: 5000,
  texture: true,
});
await client.waitForTask(modelId);

// 2. 检查是否可绑骨
const checkId = await client.rigCheck({ input: modelId });
const check   = await client.waitForTask(checkId);
if (!check.output.riggable) throw new Error('该模型不可绑骨');

// 3. 自动绑骨（Mixamo 命名 → 可直接导入 Unity / Unreal）
const rigId = await client.rigModel({
  input: modelId,
  rig_type: check.output.rig_type,
  spec: RigSpec.MIXAMO,
});
await client.waitForTask(rigId);

// 4. 烘焙预设动画
const animId = await client.retargetAnimation({
  input: rigId,
  animations: [Animation.IDLE, Animation.WALK, Animation.RUN],
  out_format: 'glb',
});
const anim = await client.waitForTask(animId);

console.log('带动画的 GLB URLs：', anim.output.model_urls);
```

**开发者小贴士：**
- 绑骨前**务必**先调 `rigCheck`，可以拿到推荐的 `rig_type` 并避免直接调 `rig` 失败。
- 轮询频率建议 **2s** 一次，**不要超过 1 次/秒**，否则可能被限流。
- Unity / Unreal 使用 `spec: 'mixamo'`；自建流水线用 `spec: 'tripo'`。
- 一次 `retarget` 最多传 **5 个** 预设动画。

---

## 错误处理

```js
import {
  TripoAPIError, TripoTaskError, TripoTimeoutError, TripoRequestError,
} from 'tripo3d-sdk-js';

try {
  const id   = await client.textToModel({ prompt: '一把椅子' });
  const task = await client.waitForTask(id, { timeoutMs: 5 * 60_000 });
  // task.output.model_url ...
} catch (err) {
  if (err instanceof TripoAPIError) {
    // 业务层错误：code、message、suggestion 与后端一致
    console.error(`API 错误 ${err.code}：${err.message} — ${err.suggestion}`);
  } else if (err instanceof TripoTaskError) {
    // 任务进入 failed / cancelled / banned 等终态
    console.error(`任务 ${err.task.task_id} 失败：`, err.errorMessage);
  } else if (err instanceof TripoTimeoutError) {
    console.error(`任务 ${err.taskId} 在 ${err.timeoutMs}ms 内未完成`);
  } else if (err instanceof TripoRequestError) {
    // 网络 / 传输层错误（重试后仍失败）
    console.error(`传输错误 HTTP ${err.status}`, err.body);
  } else {
    throw err;
  }
}
```

用 `AbortController` 取消轮询：

```js
const ac = new AbortController();
setTimeout(() => ac.abort(), 30_000);
await client.waitForTask(id, { signal: ac.signal });
```

### 常见错误码

| code | 含义 | 建议 |
| --- | --- | --- |
| `0` | 成功 | — |
| `1xxx` | 参数 / 认证错误 | 检查 `apiKey` 与请求 payload |
| `2010` | 积分不足 | 前往控制台充值 |
| `429` | 请求过于频繁 | 降低并发或延长轮询间隔 |
| `5xx` | 服务端错误 | SDK 会自动重试，仍失败请稍后再试 |

---

## 常量枚举

```js
import {
  TaskStatus, Animation, RigType, RigSpec,
  ModelVersion, OutputFormat, TextureFormat,
} from 'tripo3d-sdk-js';

TaskStatus.SUCCESS         // 'success'
Animation.WALK             // 'preset:walk'
RigType.BIPED              // 'biped'
RigSpec.MIXAMO             // 'mixamo'
ModelVersion.H3_1          // 'v3.1-20260211'
ModelVersion.P1            // 'P1-20260311'
OutputFormat.FBX           // 'FBX'
```

所有常量都是普通字符串 —— 也可以直接传原始字面量，SDK 不会强制校验。

### 任务状态

| 状态 | 说明 |
| --- | --- |
| `queued` | 排队中 |
| `running` | 运行中 |
| `success` | 成功 |
| `failed` | 失败 |
| `cancelled` | 已取消 |
| `banned` | 已封禁 |
| `expired` | 已过期 |

### 内置预设动画

`preset:idle`、`preset:walk`、`preset:run`、`preset:jump`、`preset:dive`、`preset:climb`、`preset:slash`、`preset:shoot`、`preset:hurt`、`preset:fall`、`preset:turn`、`preset:quadruped:walk`、`preset:hexapod:walk`、`preset:octopod:walk`、`preset:serpentine:march`、`preset:aquatic:march`。

### 模型系列（`model` 参数）

| 常量 | 值 | 适用场景 |
| --- | --- | --- |
| `ModelVersion.H3_1` | `v3.1-20260211` | 最高保真几何 + 完整高级参数（推荐） |
| `ModelVersion.H3_0` | `v3.0-20250812` | H3 上一版本 |
| `ModelVersion.P1`   | `P1-20260311`   | 干净低面拓扑，游戏 / 移动端友好 |
| `ModelVersion.H2_5` | `v2.5-20250123` | H2 稳定线 |
| `ModelVersion.TURBO_V1` | `Turbo-v1.0-20250506` | 极速生成 |

---

## 运行示例

```bash
export TRIPO_API_KEY="tsk_..."

# 文生 3D
node examples/text-to-model.js "一个木质藏宝箱"

# 图生 3D（本地文件 或 URL 都可）
node examples/image-to-model.js ./hero.png
node examples/image-to-model.js https://example.com/hero.jpg

# 端到端角色：图生 3D → 绑骨 → 动画重定向
node examples/rig-and-animate.js https://example.com/hero.png
```

每个示例都会把结果 GLB 保存到当前目录。

---

## 开发

```bash
npm test           # 使用 node --test，完全 hermetic（mock fetch，无需真实 API Key）
```

源码结构：

```
src/
  index.js         # 公共导出
  client.js        # TripoClient —— 所有 API 方法
  http.js          # fetch 封装（重试 + envelope 解析）
  errors.js        # 错误层级
  constants.js     # 枚举（TaskStatus、Animation……）
  utils.js         # 工具函数（文件描述符归一化、sleep、compact）
types/
  index.d.ts       # 公共 TypeScript 声明
examples/          # 端到端示例
test/              # node --test 用例集
```

---

## 相关链接

- API 文档：https://developers.tripo3d.com/zh/docs/introduction
- API 端点（国内）：`https://openapi.tripo3d.com/v3`
- API 端点（海外）：`https://openapi.tripo3d.ai/v3`

---

## FAQ

**Q：SDK 支持浏览器 / edge runtime 吗？**
支持。SDK 使用平台内置 `fetch`，在 Node ≥ 18、Bun、Deno、Cloudflare Workers、Vercel Edge 等环境都可以直接 `import` 使用。浏览器中请注意跨域问题 —— 推荐通过自建后端代理调用，避免把 API Key 暴露给前端。

**Q：SDK 会自动帮我做限流吗？**
不会。SDK 只在网络 / 5xx / 429（含 `Retry-After`）时做**指数退避重试**。如果你要发起大量并发请求，请自行加并发控制（如 `p-limit`）。

**Q：接口新增了参数怎么办？**
所有方法的 `params` 类型都是 `[key: string]: any`，未定义的字段会**直接透传**给 API，不需要等 SDK 升级。

**Q：可以只做 CommonJS 项目吗？**
本 SDK 是 ESM-only。CommonJS 项目可以用动态 `import()`：
```js
const { TripoClient } = await import('tripo3d-sdk-js');
```

---

## 许可协议

MIT —— 见 `LICENSE`。

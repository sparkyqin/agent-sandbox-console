# 基于 OpenSandbox 落地 agentsandbox 控制台 — 实施方案

> 目标：把 `agentsandbox`（单文件 mock 原型）落地为一个真实可跑的 Agent 沙箱管理控制台，后端基于 `OpenSandbox`（沙箱运行时平台），运行时面向 **Kubernetes**，前端与后端之间加一层 **BFF 代理**。

---

## 1. 现状判断（为什么可行）

| | agentsandbox | OpenSandbox |
|---|---|---|
| 定位 | 管理控制台 UI（前端 + mock） | 沙箱运行时平台（后端 + SDK + OpenAPI） |
| 关系 | 消费者 | 提供者 |

两者天然上下游。原型 8 模块的能力几乎都能在 OpenSandbox 公开 API 找到对应实现，匹配度高。官方提供 **JS/TS SDK**（`@alibaba-group/opensandbox`，含 `browser` 字段，浏览器可用），其中：

- `SandboxManager`（管理面）：`list / get / pause / resume / kill / renew / createSnapshot / listSnapshots / deleteSnapshot / patchMetadata` — 正对应「实例列表 + 生命周期操作 + 快照」。
- `Sandbox`（执行面，`connect` 后）：`commands`（execd 命令/bash 会话，SSE）、`metrics`（CPU/内存，含 `watch` SSE）、`health.ping`、`egress`（getPolicy/patchRules/deleteRules）、`credentialVault` — 正对应「详情页 日志/终端/监控/网络」。

### 1.1 能力映射表（逐模块）

| 原型模块 | OpenSandbox 能力 | 覆盖 |
|---|---|---|
| 实例列表 | `listSandboxInfos`（分页 + state/metadata 过滤） | ✅ |
| 详情·概览 | `getSandboxInfo`（status / image / metadata / expiresAt / entrypoint） + `getEndpoint(port)` | ✅ |
| 详情·日志 | execd `commands.run`（SSE）/ `getLogs`（后台命令轮询） | ✅ |
| 详情·终端 | execd `commands.createSession` + `runInSession`（SSE） | ✅ |
| 详情·监控 | execd `metrics.getMetrics` + `watch`（SSE，CPU/内存） | ✅ |
| 详情·事件 | `status.reason/message/lastTransitionAt` 状态转换时间线 | ⚠ 聚合 |
| 详情·快照/Fork | `createSnapshot` + `listSnapshots(sandboxId)` + `POST /sandboxes{snapshotId}` 恢复 | ✅ |
| 创建实例 | `Sandbox.create`（image/resourceLimits/env/metadata/networkPolicy/timeout/volumes） | ✅ |
| 网络域名/egress | lifecycle `networkPolicy` + egress sidecar `/policy` + ingress gateway | ✅ |
| 端口→公开 URL | `getEndpoint(port)` / `getSignedEndpoint(port, expires)` | ✅ |
| 密钥注入 | Credential Vault（`/credential-vault`，加密、写不可读） | ✅ |

### 1.2 三处必须正视的差距（决定方案形态）

1. **成本配额/计费 — OpenSandbox 完全没有**。搜遍 `server/configuration.md` 与源码，无 budget/quota/billing/cost/pricing。这是运行时平台，成本治理是控制面职责（正是原型 P0 + `INSIGHTS.md` 洞察 10）。**→ 由 BFF 承载**：基于 metadata 的 `project`/`owner` 做成本归因，配额在 BFF 创建链路拦截，数据存 BFF 本地（SQLite 起步）。
2. **Warm/Cold 快照二分 — OpenSandbox 当前是单一快照模型**。snapshot API 统一为 `Creating/Ready/Failed`，恢复走 `snapshotId`。是否保内存取决于底层 runtime 实现（K8s provider 可能支持检查点，Docker 不支持）。**→ UI 透传运行时能力**：先按 OpenSandbox 统一快照语义实现「快照 + 恢复 + Fork 血缘」；warm/cold 在 UI 上标注「取决于运行时」，K8s 下若 provider 支持检查点则自动获得 warm 语义。
3. **idle 两窗口 / auto-stop — 部分有**。OpenSandbox 有 `timeout`（销毁）+ `renew-expiration`（OSEP-0009 renew-on-access，即 auto-start 语义）。但**无基于资源活动的 idle 判定 + 两窗口**（洞察 3 核心）。**→ auto-stop 由 BFF 实现**：BFF 订阅 metrics/watch，按两窗口判定后调 `pause`；auto-start 透传 renew-on-access。

---

## 2. 目标架构

```
┌──────────────────────────────────────────────────────────────┐
│  浏览器（React + Vite + Tailwind，沿用原型技术栈）              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ UI 层         │  │ 数据层        │  │ 实时层             │   │
│  │ 8 模块组件    │←→│ SWR + 轮询    │←→│ SSE/EventSource   │   │
│  │ (拆分自单文件)│  │ api client    │  │ (日志/终端/监控)   │   │
│  └──────────────┘  └──────┬───────┘  └─────────┬─────────┘   │
└──────────────────────────────┼─────────────────────┼──────────┘
                               │ /api/* (同源)        │ /stream/* (SSE)
┌──────────────────────────────┼─────────────────────┼──────────┐
│  BFF 代理层（Node + Hono，新增）                                │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐   │
│  │ 透传层          │  │ 控制面自有能力  │  │ SSE 桥接         │   │
│  │ → OpenSandbox  │  │ 成本/配额/事件  │  │ execd SSE →     │   │
│  │   SDK 调用     │  │ idle 治理       │  │ 客户端           │   │
│  │   注入 apiKey  │  │ (SQLite)        │  │                 │   │
│  └────────────────┘  └────────────────┘  └─────────────────┘   │
└──────────────────────────────┬───────────────────────────────┘
                               │ Lifecycle API (/v1) + execd + egress
┌──────────────────────────────┼───────────────────────────────┐
│  OpenSandbox（现成，不改）                                       │
│  server (FastAPI) + execd + egress sidecar + ingress gateway    │
│  Kubernetes 运行时（CRD/operator/pool/task-executor）            │
└────────────────────────────────────────────────────────────────┘
```

### 2.1 为什么必须 BFF（已确认采用）

1. **CORS**：浏览器直连 OpenSandbox server（lifecycle）+ execd（沙箱内）+ egress（沙箱内）三个域，全跨域。BFF 同源代理。
2. **API key 保护**：`OPEN-SANDBOX-API-KEY` 不能进浏览器包。BFF 注入。
3. **控制面自有能力无处安放**：成本/配额/事件聚合/idle 治理是原型 P0，OpenSandbox 不提供，必须有自己的后端。
4. **SSE 桥接**：execd 的 SSE 流经 BFF 转发，统一鉴权与连接管理。

### 2.2 BFF 技术选型

- **Hono**（轻量、Web 标准、跑在 Node/Bun/edge）。Vite dev 期用 middleware 同进程，生产独立进程。
- **SDK**：BFF 内用 `@alibaba-group/opensandbox` 的 `SandboxManager` / `Sandbox.connect`，不手写 fetch。
- **存储**：SQLite（better-sqlite3）存成本记录、配额、事件、模板。原型无后端，这是新增最小依赖。

---

## 3. 目录结构（落地后）

```
agentsandbox/
├── apps/
│   ├── web/                          # 前端（从单文件拆出）
│   │   ├── src/
│   │   │   ├── main.tsx              # 从根目录移入
│   │   │   ├── App.tsx               # = 现 SandboxManager（拆分）
│   │   │   ├── api/                  # 数据层
│   │   │   │   ├── client.ts         # BFF 调用封装（fetch + SWR key 约定）
│   │   │   │   ├── sandboxes.ts      # 实例 CRUD/生命周期
│   │   │   │   ├── snapshots.ts
│   │   │   │   ├── execd.ts          # 终端/日志/监控 SSE 消费
│   │   │   │   ├── egress.ts
│   │   │   │   └── control.ts        # 成本/配额/事件/模板（BFF 自有）
│   │   │   ├── components/           # 通用（StatusBadge/Card/ProgressBar...）
│   │   │   ├── modules/              # 8 模块，每模块一目录
│   │   │   │   ├── instances/        # InstanceList + InstanceDetail(+6 子tab)
│   │   │   │   ├── create/
│   │   │   │   ├── cost/
│   │   │   │   ├── images/
│   │   │   │   ├── envsnap/          # 环境快照 = OpenSandbox snapshot 复用
│   │   │   │   ├── tools/
│   │   │   │   ├── templates/
│   │   │   │   ├── network/
│   │   │   │   └── settings/
│   │   │   ├── hooks/                # useSandboxes/useSandbox/useMetricsStream...
│   │   │   └── lib/                  # 状态映射/格式化
│   │   ├── index.html
│   │   ├── vite.config.ts            # dev proxy → BFF
│   │   └── package.json
│   └── bff/                          # BFF 代理（新增）
│       ├── src/
│       │   ├── index.ts              # Hono app
│       │   ├── proxy/                # 透传到 OpenSandbox（lifecycle/execd/egress）
│       │   │   ├── lifecycle.ts
│       │   │   ├── execd.ts          # SSE 桥接
│       │   │   └── egress.ts
│       │   ├── control/              # 控制面自有
│       │   │   ├── cost.ts           # 成本记录/预算/归因
│       │   │   ├── quota.ts          # 配额校验（创建链路拦截）
│       │   │   ├── events.ts         # 事件聚合（轮询状态转换）
│       │   │   ├── templates.ts
│       │   │   └── idle.ts           # 两窗口 idle → pause
│       │   ├── db/                   # SQLite schema + 访问层
│       │   └── config.ts             # OSB 连接配置 + apiKey
│       └── package.json
├── DESIGN.md / INSIGHTS.md / README.md   # 保留并更新
└── PLAN.md                              # 本文件
```

> 原型根目录的 `agent.tsx` / `main.tsx` / `index.html` / 配置文件迁入 `apps/web/`，旧文件删除。保留 `DESIGN.md`/`INSIGHTS.md`，`README.md` 更新为落地版。

---

## 4. 字段映射（mock → 真实 API）

### 4.1 实例（INSTANCES mock → `SandboxInfo`）

| 原型字段 | OpenSandbox 来源 | 说明 |
|---|---|---|
| `id` | `SandboxInfo.id` | 直取 |
| `name` | `metadata.name` | metadata 约定 key |
| `status` | `status.state` 映射 | 见 4.2 状态映射 |
| `image` | `image.uri` / 叠加层 | 底座+叠加在 K8s 下用 template/pool 表达 |
| `cpu/mem`（实时%） | execd `metrics.getMetrics` | 列表页轻量轮询或留空 |
| `cpuReq/memReq/gpu` | 创建时 `resourceLimits` | `getSandboxInfo` 不回传 limits，BFF 在创建时落库并关联 |
| `restarts` | — | OpenSandbox 无；BFF 事件聚合（可选 P1） |
| `ready` | `status.state==='Running'` | 简化为 1/1 或 0/1 |
| `uptime` | `createdAt` 计算 | now - createdAt |
| `region` | `metadata.region` 或 K8s 节点 | metadata 约定 |
| `owner/project` | `metadata.owner` / `metadata.project` | 直取 |
| `cost` | BFF 计算 | 按规格单价 × (now-createdAt)，存 BFF |
| `tags` | `metadata`（其余 key） | 列表过滤用 `?metadata=k=v` |
| `ports/url` | `getEndpoint(port)` | 概览页展示 + 打开预览 |
| `forks` | `listSnapshots(sandboxId)` + 恢复链 | 见 4.4 |
| `hint/hintKind` | BFF 推导 | 基于 state + 成本 + idle |

### 4.2 状态映射（`SandboxState` → 原型 STATUS_META）

| OpenSandbox state | 原型 status |
|---|---|
| `Pending` | `creating` |
| `Running` | `running` |
| `Pausing` / `Paused` | `paused` |
| `Resuming` | `creating`（过渡） |
| `Stopping` / `Terminated` | `terminated` |
| `Failed` | `error` |
| （BFF idle 下沉后 Paused） | `hibernating`（用 paused + metadata 标记区分，或 BFF 衍生态） |

> 原型的 `hibernating` 与 `stopped` 在 OpenSandbox 里都落到 `Paused`。BFF 用 metadata 或本地状态区分「主动暂停」vs「idle 下沉」，UI 映射时还原。

### 4.3 创建表单（CreateSandbox → `Sandbox.create`）

| 表单字段 | 映射 |
|---|---|
| 沙箱名称 | `metadata.name` |
| 项目 / 区域 / owner / tags | `metadata.project/region/owner` + 其余 tag |
| 资源规格档位 | `resourceLimits`（cpu/memory/gpu），档位→量纲表见下 |
| 镜像结构（底座+叠加） | `image.uri`（K8s 下叠加层通过 pool/template 表达，MVP 先单层 image） |
| 挂载工具 | K8s 下由 image 内置或 initContainer；MVP 先 metadata 记录 + 提示 |
| 环境变量（含 secret 标记） | 明文 → `env`；secret → `credentialVault`（写不可读） |
| 端口映射 | 创建后 `getEndpoint(port)` 自动得公开 URL |
| egress 出口（三档） | `networkPolicy`：deny-all+allowlist / allow-all+denylist / 完全开放=不传或 defaultAction:allow |
| 消息间挂起 / idle 下沉 | BFF idle 治理参数（存 BFF，BFF 据此调 pause） |
| 预热池 | K8s `pool`（extensions.poolRef）— P1，MVP 先不接 |
| 最大存活 | `timeout`（秒）= maxLifetime×3600 |
| 持久卷 | `volumes[].pvc`（K8s） |
| 健康探针 | OpenSandbox 无显式探针字段；execd `health.ping` 代理 readiness |

资源档位 → `resourceLimits`：
- Small → `{cpu:"1000m",memory:"2Gi"}`
- Medium → `{cpu:"2000m",memory:"4Gi"}`
- Large → `{cpu:"4000m",memory:"8Gi"}`
- XLarge → `{cpu:"8000m",memory:"16Gi",gpu:"1"}`

### 4.4 快照与 Fork 血缘

- **打快照**：`manager.createSnapshot(sandboxId, {name})`
- **列表**：`manager.listSnapshots({sandboxId})`
- **恢复（=Fork 一个新实例）**：`Sandbox.create({snapshotId, resourceLimits, ...})`
- **血缘树**：BFF 维护 `snapshot.sandboxId`（源）→ 恢复出的新 sandbox 的映射（创建恢复实例时记录），构建树。OpenSandbox 不回传「由哪个 snapshot 恢复」以外的血缘，需 BFF 落库补全。
- **warm/cold**：UI 标注「语义取决于运行时是否支持检查点」；K8s provider 支持则自动 warm。

### 4.5 终端 / 日志 / 监控（execd，经 BFF SSE 桥接）

- **终端**：BFF 持有 execd session（`commands.createSession`），前端 ↔ BFF WebSocket/SSE 双向；`runInSession` 的 SSE 流转发。MVP 可先做「单条命令 + 流式输出」，完整交互式 xterm 可后置。
- **日志**：前端起一条后台命令 `tail -f /var/log/...` 或读取应用日志，SSE 转发；级别/关键字过滤在前端。
- **监控**：`metrics.watch` SSE → 前端 sparkline；历史曲线 BFF 采样存 SQLite（可选 P1）。

---

## 5. 分阶段路线图

### 阶段 0：脚手架（地基）
- 建 `apps/web` + `apps/bff` 双包结构，pnpm workspace。
- BFF：Hono 起服务，`/api/lifecycle/*` 透传到 OpenSandbox（注入 apiKey），health check。
- web：把 `agent.tsx` 机械拆分到 `modules/` + `components/`，**先保持 mock 数据**，确保拆分无回归（UI 一致）。
- vite dev proxy → BFF。
- **验收**：`pnpm dev` 起前端 + BFF，BFF 能 `listSandboxes` 返回真实 OpenSandbox 数据（需本地/远端 K8s OSB 实例）。

### 阶段 1：实例列表 + 详情概览（垂直切片，接通真实 API）
- 数据层 `api/sandboxes.ts`：`listSandboxes` / `getSandbox` / `pause/resume/kill`。
- 列表页接真实数据 + SWR 轮询（running 态 5s）。
- 详情概览接 `getSandboxInfo` + `getEndpoint`。
- 状态映射 `lib/stateMap.ts`。
- **验收**：列表显示真实 sandbox，点进详情看到真实 status/端口/标签；pause/resume/kill 真实生效。

### 阶段 2：创建实例
- 创建表单 → BFF → `Sandbox.create`。
- BFF 创建链路落库（成本记录起算、配额校验、resourceLimits 关联）。
- egress 三档映射 networkPolicy；secret 走 credentialVault。
- **验收**：表单创建出真实 sandbox，egress 生效（可验证出站被拦），公开 URL 可打开。

### 阶段 3：详情实时能力（日志/终端/监控）
- BFF SSE 桥接 execd。
- 监控 `metrics.watch` → sparkline 实时。
- 日志 SSE 流 + 过滤。
- 终端 MVP（单命令流式，或 xterm 接 BFF WebSocket）。
- **验收**：监控曲线实时滚动；终端能 `ls` 看到真实输出；日志实时流。

### 阶段 4：快照 + Fork 血缘
- `createSnapshot` / `listSnapshots` / `snapshotId` 恢复。
- BFF 血缘落库 + 树渲染。
- 环境快照页（envsnap）复用 snapshot 列表（按 metadata 区分 cold 环境快照）。
- **验收**：打快照 → 从快照恢复出新实例 → 血缘树正确展示。

### 阶段 5：控制面自有能力（成本/配额/事件/idle）
- 成本：按规格单价表 × 运行时长，预算告警（50/80/100%），项目归因。
- 配额：创建链路拦截（实例数/CPU/内存/GPU/存储）。
- 事件：BFF 轮询状态转换，聚合时间线（补 DetailEvents）。
- idle：BFF 订阅 metrics，两窗口判定 → pause（实现 auto-stop）；renew-on-access 透传（auto-start）。
- 网络域名页：ingress 路由总览 + egress policy 编辑（egress sidecar API）。
- **验收**：预算超限拦截新建；idle 后自动 pause；事件时间线展示状态转换。

### 阶段 6：镜像库/工具箱/模板库/系统设置
- 镜像库：本地/远端镜像列表（K8s 下可对接 registry）+ metadata 记录。
- 工具箱：metadata 驱动（K8s 下工具靠 image/initContainer，控制台做编排记录）。
- 模板库：BFF 存模板（image+resource+tools+tags），一键创建。
- 系统设置：OSB 连接配置、单价表、配额默认值。
- **验收**：模板一键创建出实例；单价/配额可配。

---

## 6. 关键技术决策

1. **BFF 用 SDK 不用裸 fetch**：`SandboxManager` / `Sandbox.connect` 已封装 endpoint 解析、缓存、错误处理，省去手写。
2. **前端不直接依赖 SDK**：所有调用走 BFF `/api/*`，前端只用 fetch + SWR。SDK 仅在 BFF 内。这样前端包小、key 不泄露、CORS 自然解决。
3. **SSE 经 BFF 桥接**：浏览器 EventSource 连 BFF `/stream/*`，BFF 持有到 execd 的 SSE，双向转发。避免浏览器直连 execd 的 CORS + token 问题。
4. **状态映射集中在 `lib/stateMap.ts`**：OpenSandbox 的 8 态 → 原型 7 态，单一映射点，便于后续 OpenSandbox 加状态时维护。
5. **控制面数据存 SQLite**：成本/配额/事件/模板/idle 配置。轻量、零运维、可后续换 PG。BFF 是唯一写入者。
6. **warm/cold 不硬造**：透传运行时能力，UI 标注。避免在 OpenSandbox 不支持时假装支持。
7. **拆分先于接 API**：阶段 0 先机械拆 `agent.tsx` 保持 mock 跑通，再逐模块换真实数据。降低风险、可回退。

---

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| K8s OpenSandbox 实例不易起 | 阶段 0 先用 docker-compose OSB 验证链路（接受 warm 快照不可用），K8s 留作能力完整验证 |
| execd SSE 跨域 + token | 统一经 BFF 桥接，前端只见 BFF 同源 SSE |
| OpenSandbox 不回传 resourceLimits | BFF 创建时落库关联 sandboxId，详情页用 BFF 数据补 |
| warm 快照在目标 runtime 不可用 | UI 透传，不假装；文档标注 |
| idle 治理误杀（洞察 3） | BFF 严格按资源活动 + 两窗口，不照搬 Colab；可配阈值 |
| 单文件拆分引入回归 | 阶段 0 先拆后验，保持 mock 数据不变，UI 逐项比对 |

---

## 8. 落地后与原型的差异说明（写进 README）

- **成本/配额/idle 治理**：由 BFF 提供，非 OpenSandbox 原生。
- **warm/cold 快照**：语义取决于 K8s runtime 是否支持检查点；统一快照 API。
- **事件时间线**：BFF 聚合状态转换，非 OpenSandbox 原生事件流。
- **预热池**：K8s pool（P1），MVP 不接。
- **探针**：用 execd health 代理 readiness，无显式 liveness/startup 字段。

---

## 9. 本方案不动 OpenSandbox 仓库

全部新增/改动在 `agentsandbox/` 内（拆分 + BFF + 对接）。OpenSandbox 作为外部依赖（SDK + 运行时），只读引用。

# Agent 沙箱控制台

一个面向 AI Agent 的沙箱（Sandbox）管理控制台。基于业界主流 Agent 沙箱平台与底层编排实践调研设计，**后端基于 [OpenSandbox](https://github.com/opensandbox-group/OpenSandbox) 运行时**落地。

## 文档

| 文档 | 内容 |
|---|---|
| [PLAN.md](./PLAN.md) | 落地方案 — 基于 OpenSandbox 的架构、字段映射、分阶段路线图 |
| [DESIGN.md](./DESIGN.md) | 设计规格 — 模块清单、字段设计、状态机、安全模型、路线图 |
| [INSIGHTS.md](./INSIGHTS.md) | 调研洞察 — 10 条关键洞察与避坑点（常见误区 → 业界实践 → 为什么） |

## 架构

控制台是 OpenSandbox 的**管理控制面 UI**，OpenSandbox 是**沙箱运行时后端**，两者天然上下游。浏览器不直连 OpenSandbox（会撞 CORS 且暴露 API key），而是经一层 **BFF 代理**：

```
浏览器 (apps/web)  ──同源 /api──▶  BFF (apps/bff)  ──SDK──▶  OpenSandbox
  React+Vite+Tailwind              Hono                 lifecycle / execd / egress
                                   · 注入 API key
                                   · 控制面自有能力(成本/配额/idle)
```

- **`apps/web`**：前端，React 18 + Vite 5 + Tailwind 3 + lucide-react + SWR。8 模块从原单文件 `agent.tsx` 拆分为模块化结构。
- **`apps/bff`**：BFF 代理，Hono + OpenSandbox JS SDK。透传 lifecycle API、注入 API key、解决 CORS；后续承载控制台自有的成本/配额/事件/idle 治理（OpenSandbox 不提供这层）。

### 模块与 OpenSandbox 能力映射

| 模块 | OpenSandbox 能力 | 状态 |
|---|---|---|
| 实例列表 / 详情 | Lifecycle API（list/get/pause/resume/kill） | ✅ |
| 详情·日志/终端/监控 | execd（command SSE / metrics） | ✅ |
| 详情·快照/Fork 血缘 | snapshots API + snapshotId 恢复 | ✅ |
| 创建实例 | Sandbox.create（resourceLimits/env/networkPolicy/timeout/volumes） | ✅ |
| 网络域名/egress | networkPolicy + egress sidecar | ✅ |
| 成本配额/事件/idle | **BFF 自有**（OpenSandbox 无） | ✅ |
| 镜像库/工具箱/模板库/系统设置 | **BFF 自有**（目录 + 配置） | ✅ |

详见 [PLAN.md](./PLAN.md)。

## 功能模块

- **实例列表** — 运行态可见，状态/资源/就绪/花费，批量启停销毁
- **实例详情** — 概览 / 会话 / 日志 / 终端 / 监控 / 事件 / 快照(Fork 血缘)
- **创建实例** — 资源规格 / 镜像分层 / 工具挂载 / 密钥 / 网络出口 / 生命周期治理 / 健康探针
- **成本配额** — 预算告警 / 资源配额 / 单价 / 项目花费（BFF 自有）
- **镜像库** — 版本 / 来源 / 安全扫描 / 引用
- **工具箱** — 版本 / 安装方式 / 默认启用
- **模板库** — 封装配置一键创建
- **网络域名** — Ingress 总览 / egress 策略 / TLS 证书

## 运行与对接

依赖：Node ≥20、pnpm。

### 两种模式

控制台由 `.env` 的 `BFF_MOCK` 开关切换两种模式，**前端代码两种模式零差异**——区别只在 BFF 连不连真实 OpenSandbox。

| | mock 模式 (`BFF_MOCK=1`) | 真实模式 |
|---|---|---|
| 实例数据 | 6 个内存假实例 | 你 OSB 里的真实沙箱 |
| 生命周期/快照/终端/监控 | BFF 模拟 + 自造回显 | 真实 OSB API + execd SSE |
| 成本/配额/事件/idle/目录 | 真实工作（SQLite） | 真实工作（SQLite） |

mock 模式唯一不真实的是"沙箱内部"（metrics 波动、命令回显是假的），但**控制台全部链路**（创建→列表→详情→操作→成本→配额→idle）都是真的，能完整验证控制台质量。

### 步骤 1：mock 模式跑起来（不需 OpenSandbox）

```bash
pnpm install              # 首次安装依赖
cp .env.example .env      # 已含 BFF_MOCK=1
pnpm dev                  # 同时起 BFF(8787) + 前端(5173)
# 或分别起：pnpm dev:web / pnpm dev:bff
```

打开 `http://localhost:5173`，6 个假实例，8 模块全功能可交互。

### 步骤 2：对接真实 OpenSandbox

**为什么需要 BFF**：浏览器不能直连 OSB——API key 会暴露在浏览器包里，且 OSB server + 沙箱内 execd 都跨域。架构是 `浏览器 → BFF（注入 key、解决 CORS）→ OSB`。

**A. 准备一个 OpenSandbox 实例**（任选其一）：

```bash
# 方式 1：本地 Docker（最快，但无 warm 快照/scale-to-zero）
uvx opensandbox-server init-config ~/.sandbox.toml --example docker
uvx opensandbox-server          # 默认 localhost:8080

# 方式 2：Kubernetes（能力最全，控制台的目标运行时）
# 按 OpenSandbox/kubernetes/ 的 Helm chart 部署
```

**B. 配置 `.env`**（改三项 + 删 BFF_MOCK）：

```bash
OSB_DOMAIN=<你的 OSB 地址>      # localhost:8080 或 k8s-ingress.example.com
OSB_PROTOCOL=http               # 或 https
OSB_API_KEY=<你的真实 API key>
# BFF_MOCK=1                    # 注释掉或删掉这行 → 切真实模式
```

**C. 启动 + 验证对接**：

```bash
pnpm dev
```

验证信号：
- BFF 启动日志显示 `OpenSandbox → http://<你的地址>`（不再是 `MOCK 模式`）
- 实例列表显示你真实 OSB 里的沙箱（不是 6 个假实例）
- 调链路探测端点：

```bash
curl --noproxy '*' http://localhost:8787/health/osb
# {"ok":true,"count":N,...}  → 对接成功
# {"ok":false,"error":"fetch failed"}  → OSB 地址/端口/key 不对
```

> 本机若用 HTTP 代理，curl 访问 localhost 需加 `--noproxy '*'`，否则被代理拦截。

### 步骤 3：生产部署

dev 模式仅用于开发。生产部署：

- **BFF**：`pnpm --filter @agentsandbox/bff build` → `node apps/bff/dist/index.js`，用 pm2/systemd/k8s 跑，环境变量用生产 OSB 地址 + key。
- **前端**：`pnpm --filter @agentsandbox/web build` → 静态产物 `apps/web/dist/`，用 nginx/CDN 托管，反代 `/api`、`/stream` 到 BFF。
- **SQLite**：换持久卷挂载，或换 PostgreSQL（阶段 5 留了迁移点）。

### 常用命令

```bash
pnpm install              # 安装依赖
pnpm dev                  # 同时起前端 (5173) + BFF (8787)
pnpm dev:web              # 仅前端
pnpm dev:bff              # 仅 BFF
pnpm build                # 构建全部
pnpm typecheck            # 类型检查全部
```

## 项目结构

```
apps/
  web/                     # 前端控制台
    src/
      api/                 # 数据层（BFF 调用 + SWR）
      components/          # 通用 UI（Card/StatusBadge/TopNav...）
      modules/             # 8 模块，每模块一目录
        instances/         # 列表 + 详情(6 子tab)
        create/ cost/ images/ envsnap/ tools/ templates/ network/ settings/
      lib/                 # 类型 / mock / 状态映射
      App.tsx              # 主组件
  bff/                     # BFF 代理
    src/
      proxy/               # 透传层：lifecycle / execd(SSE) / egress + resourceStore + lineageStore
      control/             # 控制面自有：cost / quota / events / idle / catalog / settings
      db.ts                # SQLite（成本/事件/配额/目录/设置）
      config.ts            # OSB 连接配置
      index.ts             # Hono 入口
DESIGN.md / INSIGHTS.md / PLAN.md
```

## 设计要点

1. **供给 ≠ 管理** — 实例列表与详情页是一等公民，而非仅一个创建向导
2. **快照 warm/cold 二分** — 语义取决于运行时是否支持检查点；OpenSandbox 统一快照 API，UI 透传运行时能力
3. **idle 判定基于资源活动** — 避免误杀无人值守长跑 agent（BFF 实现两窗口模型，不照搬 Colab）
4. **安全治理内建** — egress 白名单防数据外泄、Secret 加密分离、max_lifetime 强制销毁
5. **成本治理是控制面职责** — OpenSandbox 不提供，由 BFF 承载（预算/配额/归因）

详见 [PLAN.md](./PLAN.md)、[DESIGN.md](./DESIGN.md) 与 [INSIGHTS.md](./INSIGHTS.md)。

## 落地状态

- ✅ 阶段 0：workspace 双包结构 + BFF 骨架 + 原型拆分（mock 驱动，UI 无回归）+ BFF→OSB 透传链路验证
- ✅ 阶段 1：实例列表 / 详情概览接通真实 API（经 BFF → OpenSandbox），pause/resume/kill 真实操作 + SWR 轮询反映异步状态转换
- ✅ 阶段 2：创建实例接通 `Sandbox.create`（资源档位→resourceLimits、egress→networkPolicy、env、timeout、metadata），BFF 落库 resourceLimits 供详情页回填，创建后 Creating→Running 异步转换
- ✅ 阶段 3：详情页实时能力接通 execd——监控（SSE 实时 CPU/内存曲线）、日志（SSE 实时流 + 级别/关键字过滤）、终端（单命令执行 + 流式输出）。BFF 桥接 execd SSE，浏览器不直连沙箱
- ✅ 阶段 4：快照 + Fork 血缘——打快照（Creating→Ready）、从快照 Fork 新实例、血缘树（BFF lineageStore 维护逆向关系）、环境快照页（全量快照库）。列表 Fork 角标接 forkCount
- ✅ 阶段 5：控制面自有能力（OpenSandbox 不提供，纯 BFF）——成本（按规格×时长计费 + 预算 + 项目归因，SQLite 持久化）、配额（创建链路拦截，实例/CPU/内存/GPU）、事件聚合（生命周期时间线）、idle auto-stop（两窗口模型，对标 Knative，不照搬 Colab）
- ✅ 阶段 6：镜像库/工具箱/模板库/系统设置接通真实——镜像创建时自动入库、工具启用切换、模板 CRUD + 一键创建、系统设置读写（生命周期/安全/快照默认）

---

*技术栈：React 18 + Vite 5 + Tailwind CSS 3 + lucide-react + SWR（前端）；Hono + OpenSandbox JS SDK（BFF）*

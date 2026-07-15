# Agent 沙箱控制台 · 设计文档

> 一个面向 AI Agent 的沙箱（Sandbox）管理控制台设计。本文档基于对业界主流 Agent 沙箱平台与底层编排实践的调研，给出系统、全面、成熟的设计方案，并附原型实现 `agent.tsx`。
>
> **配套文档**：[INSIGHTS.md](./INSIGHTS.md) 是调研洞察报告，提炼 10 条关键洞察与避坑点（"常见误区 → 业界实践 → 为什么"），与本文的设计规格互补。入门请先看 [README.md](./README.md)。

---

## 1. 背景与目标

AI Agent 需要一个**隔离的运行环境**来执行代码、访问网络、操作文件、调用工具。这个环境必须满足三组相互制约的需求：

| 需求 | 含义 | 制约 |
|---|---|---|
| **隔离** | Agent 执行不可信代码、发起不可控网络请求，必须防逃逸、防数据外泄、防资源耗尽 | 隔离越强，开销越大、启动越慢 |
| **可控** | 管理员要能创建/启停/观测/回收，要有限额、审计、成本治理 | 控制粒度越细，配置越复杂 |
| **可复用** | Agent 反复试错，需要快照、Fork、模板、休眠唤醒以降低成本与延迟 | 状态保留越完整，存储成本越高 |

本控制台的目标是**提供一套覆盖沙箱完整生命周期的管理界面**，让上述三组需求在产品层面被显式表达与配置，而非依赖底层运维。

### 1.1 设计原则

1. **供给 ≠ 管理**：控制台的核心价值是管理运行中的实例，而非仅一个创建向导。实例列表与详情页是一等公民。
2. **资源与安全必须显式限定**：沙箱是资源型产品，不限制资源 = 一个 agent 跑飞拖垮宿主机；agent 执行不可信代码，安全治理是刚需而非可选。
3. **成本治理内建**：idle 超时、最大存活时长、配额、预算告警是控制面职责，不能指望用户手动回收。
4. **状态可分叉**：快照与 Fork 是 Agent 试错场景的差异化能力，需区分内存级与磁盘级两种语义。
5. **配置可复用**：模板化常用配置，降低重复配置成本。

### 1.2 调研基础

本设计调研了以下平台与实践（详见 [§11 调研来源](#11-调研来源)）：

- **Agent 沙箱即服务平台**：E2B、Daytona、Modal、Runloop、CodeSandbox SDK、Morph、Fly Machines
- **底层隔离**：Firecracker microVM、gVisor、Kata Containers、nsjail
- **编排与治理**：Kubernetes（Pod 生命周期、Probe、Resource、NetworkPolicy、Ingress、RBAC、CSI VolumeSnapshot、CRIU 检查点）、KEDA、Knative autoscaling
- **参考控制台**：Portainer、Rancher、k9s、Lens、GitHub Codespaces、Replit、Google Colab

> **可信度说明**：调研环境联网受限，部分结论基于截至 2026-01 的训练知识 + 本地缓存的一手资料。各平台的**概念性能力**把握度高；**精确字段名/枚举值/最新定价**建议在可联网环境按 [§11](#11-调研来源) 的 URL 复核。

---

## 2. 总体架构与模块清单

控制台由 **8 个主模块**组成，按优先级分层（P0 必须 / P1 重要 / P2 进阶）：

```
┌─────────────────────────────────────────────────────────┐
│                      顶部导航栏                          │
│  实例列表 │ 创建实例 │ 成本配额 │ 镜像库 │ 工具箱 │ 模板库 │ 网络域名 │
└─────────────────────────────────────────────────────────┘
        │
   ┌────┴─────────────────────────────────────┐
   │  实例列表 (P0)                            │
   │  └─> 实例详情 (P0)                        │
   │       ├ 概览  ├ 日志  ├ 终端  ├ 监控       │
   │       ├ 事件  ├ 快照(Fork血缘)            │
   ├─────────────────────────────────────────┤
   │  创建实例 (P0)  —— 资源/探针/治理/密钥/卷/模板/标签  │
   │  成本配额 (P0)  —— 预算/配额/单价/项目花费          │
   │  镜像库 (P1)    —— 版本/来源/扫描/引用             │
   │  工具箱 (P1)    —— 版本/安装方式/默认启用           │
   │  模板库 (P1)    —— 封装配置一键创建                │
   │  网络域名 (P1)  —— Ingress总览/egress模板/TLS      │
   ├─────────────────────────────────────────┤
   │  审计日志 (P2) │ 团队权限RBAC (P2) │ 系统设置 (P2)  │
   └─────────────────────────────────────────┘
```

### 模块优先级矩阵

| 模块 | 优先级 | 核心价值 |
|---|---|---|
| 实例列表 | P0 | 运行态可见，沙箱控制台的核心 |
| 实例详情 | P0 | 观测与操作单一实例的入口 |
| 创建页（补全） | P0 | 资源/安全/治理的显式配置入口 |
| 成本配额 | P0 | 防失控成本，多租户治理 |
| 镜像库 | P1 | 可复现、可校验的运行环境供给 |
| 工具箱 | P1 | 标准化工具挂载，权限分级 |
| 模板库 | P1 | 配置复用，降低创建成本 |
| 网络域名 | P1 | 集中治理对外暴露与出口策略 |
| 审计日志 | P2 | 合规与追溯 |
| 团队权限 RBAC | P2 | 多人协作与最小权限 |
| 系统设置 | P2 | 全局默认与集成 |

---

## 3. 实例列表页（P0）

### 3.1 列表字段

| 字段 | 说明 |
|---|---|
| 名称 / ID | 可点击进入详情；ID 用等宽字体 |
| 状态 | 状态机徽标（带动画脉冲） |
| 镜像 | 叠加层名称 + GPU 信息 |
| CPU% / 内存% | 实时占用进度条（>85% 变红） |
| 就绪 / 重启 | 探针就绪 `1/1`，重启次数 `↻N` |
| 区域 / 节点 | 部署位置 |
| 运行时长 | uptime |
| 累计花费 | 实例生命周期内计费 |
| Owner / 项目 | 归属 |
| 标签 | 用于检索与批量操作 |

### 3.2 行内操作

`暂停 / 启动` · `重启` · `休眠` · `销毁` · `终端` · `日志` · `快照` · `Fork`

### 3.3 表头能力
批量选择 + 批量启停/休眠/销毁/打标签；按状态过滤；关键字搜索；分页。

---

## 4. 实例详情页（P0）

6 个子 Tab：

### 4.1 概览
- 资源占用（CPU/内存实时 + 限额线）
- 镜像分层结构（底座 + 叠加）
- 网络与端口（含公开预览 URL）
- 实例信息（ID/状态/项目/Owner/区域/GPU/运行时长/重启/花费）
- 标签
- 探针状态（Liveness / Readiness / Startup）

### 4.2 日志
- 实时流（WebSocket/SSE），级别过滤，关键字过滤
- "仅前次容器"开关（排查崩溃）
- 导出

### 4.3 终端（exec）
- 基于 xterm.js 的交互式终端
- 选择容器 / user / shell（`/bin/bash`、`/bin/sh`）
- 作为**可独立授权的 subresource**（见 [§10 RBAC](#10-团队与权限-rbacp2)）

### 4.4 监控
- CPU/内存/网络/磁盘 sparkline
- 历史曲线 + 资源限额虚线（超过即 throttling）

### 4.5 事件时间线
生命周期事件流：`Provisioned → Scheduled → Created → Pulled → Started`，含 Warning（如构建失败重试）。

### 4.6 快照（含 Fork 血缘树）
详见 [§7 快照与 Fork](#7-快照与-fork业界差异化能力)。

---

## 5. 创建实例页（P0，补全设计）

### 5.1 配置区块

| 区块 | 字段 | 业界依据 |
|---|---|---|
| 基础信息 | 名称、所属项目、部署区域、标签 | 几乎所有平台支持 `metadata` 业务标签 |
| **资源规格** | 档位选择 Small/Medium/Large/XLarge（CPU/内存/GPU），显示单价 | Modal 精确到 GPU 型号按秒计费；Daytona 暴露 cpu/memory/gpu/disk |
| 镜像分层 | 第1层底座（固定）+ 第2层叠加（可选） | E2B template 体系；分层叠加降低冷启动 |
| 工具挂载 | 多选工具（含版本/安装方式） | E2B/Daytona 工具挂载 |
| **环境变量与密钥** | env 变量 + **Secret 加密标记** | secrets 与明文 env 分离（Daytona/Modal） |
| **网络与服务路由** | 端口映射（自动生成公开 URL）+ **egress 出口策略** | E2B/CodeSandbox 端口→公开 URL；egress 白名单防数据外泄 |
| **生命周期与成本治理** | idle 超时、最大存活时长、auto-restart、持久卷 | Daytona autoStop/autoStart；Fly auto_stop；Knative 两窗口 |
| **健康探针** | Liveness/Readiness/Startup（方式/端口/间隔/阈值） | K8s 三探针 |

### 5.2 资源规格档位

| 档位 | CPU | 内存 | GPU | 单价 |
|---|---|---|---|---|
| Small | 1 vCPU | 2 GiB | 无 | ¥0.12/时 |
| Medium | 2 vCPU | 4 GiB | 无 | ¥0.31/时 |
| Large | 4 vCPU | 8 GiB | 无 | ¥0.78/时 |
| XLarge | 8 vCPU | 16 GiB | A100 | ¥3.20/时 |

### 5.3 出口（egress）策略三档

| 策略 | 说明 |
|---|---|
| 完全禁止 | 最安全，离线执行 |
| **域名白名单（推荐）** | 仅允许白名单域名出站，防数据外泄 |
| 完全开放 | ⚠ 不安全，仅限受信场景 |

### 5.4 右侧实时清单
汇总所有配置 + 预估花费 + 「立即创建」+ 「另存为模板」。

---

## 6. 成本与配额治理（P0）

### 6.1 预算
- 月预算 + 已花费 + 百分比
- 阈值告警：50% / 80% / 100%
- 超限动作：邮件告警 / 暂停新建 / 强制休眠非 prod

### 6.2 配额维度
实例数、CPU（核）、内存（MiB）、GPU（张）、存储（GB）、并发创建中。

### 6.3 idle 判定的关键修正

> **⚠ 业界反面教材**：Google Colab 用"浏览器 tab 交互"判定 idle，所有档位共享 ~90min 超时，Pro 不延长，且 GPU 跑满也不算活动。这对**无人值守长跑 Agent 是致命的**——会误杀正在计算的 agent。

本设计要求：
- idle 判定基于**真实资源活动**（CPU 利用率、网络流量、并发请求），而非 UI 交互
- 采用**两窗口模型**（对标 Knative）：`grace period`（缩到 0 后保留时长）+ `stable window`（判定稳定空闲的窗口），而非单一 timeout

### 6.4 计费
按秒计费，精确到 GPU 型号；不足 1 分钟按 1 分钟计。

---

## 7. 快照与 Fork（业界差异化能力）

这是多数自研控制台漏掉、但 Agent 试错场景最具差异化的能力。

### 7.1 快照的二分模型

| 类型 | 捕获内容 | 恢复速度 | 机制 | 用途 |
|---|---|---|---|---|
| **Warm 快照** | 进程树 + 全部内存页 + FD + 打开文件 + socket 状态 | 秒级（~1.5s） | CRIU / microVM 内存快照 | 保留运行态，1-to-many Fork |
| **Cold 快照** | 仅磁盘卷 | ~6s（冷启） | CSI VolumeSnapshot | 持久化文件系统状态 |

> 业界验证：E2B（snapshot→create，warm 默认 / `keepMemory:false` 冷）、Daytona（fork 树）、Morph（`branch --count N` 一对多）、CodeSandbox（suspend 保内存 ~1.5s 恢复）、Runloop（snapshot+fork）均采用此模型。

### 7.2 Fork 统一为二选一

| 操作 | 语义 | 场景 |
|---|---|---|
| **Warm Fork** | 从内存快照派生新实例，秒级恢复，可并行 N 份 | Agent 分支化试错，失败丢弃、成功保留 |
| **Cold Clone** | 从磁盘卷克隆，冷启 | 复制环境做长期独立任务 |

### 7.3 Fork 血缘树
实例详情页展示从该实例派生的分支树，标注"采纳"的分支——支持 Agent 并行探索多个方案后选定最优。

---

## 8. 安全模型

### 8.1 隔离层级（底层可选，控制台透传）
- **容器**（默认，轻量）：Docker/OCI + user namespace + seccomp + capabilities 裁剪
- **gVisor**（增强）：用户态内核拦截 syscall
- **microVM**（最强）：Firecracker/Kata，独立内核

### 8.2 控制台必须可配的安全项

| 维度 | 配置 | 优先级 |
|---|---|---|
| 资源限制 | CPU/memory/PID/磁盘 limits | P0 |
| 出口网络 | egress 白名单（防数据外泄） | P0 |
| 密钥注入 | Secret 加密存储 → 注入为 env/文件 | P0 |
| 强制销毁 | max_lifetime 硬上限（防失控成本/逃逸） | P0 |
| 能力裁剪 | Linux capabilities 白/黑名单 | P1 |
| 文件系统 | 只读根 + tmpfs | P1 |
| 镜像校验 | 来源 + 漏洞扫描 + 白名单 | P1 |
| syscalls | seccomp profile | P2 |

### 8.3 高风险项警示
- **DooD/DinD**（挂载宿主 Docker）：`docker-cli` 工具需标注"高权限"，默认不启用
- **明文 env 存密钥**：必须改为 Secret 加密存储

---

## 9. 可观测性

| 能力 | 说明 |
|---|---|
| 实例列表 | 状态、资源占用、就绪、重启 |
| 日志 | 实时流 + 级别/关键字过滤 + 前次容器 + 导出 |
| 终端 | exec 交互式 shell |
| 监控 | CPU/内存/网络/磁盘 实时 + 历史 + 限额线 |
| 事件 | 生命周期时间线（Normal/Warning） |
| 快照 | 列表 + 血缘树 |
| 审计 | who/when/what/on/result（P2） |

---

## 10. 团队与权限 RBAC（P2）

### 10.1 六层角色模型

| 角色 | 权限 | 备注 |
|---|---|---|
| Owner | 全部 + 删租户/转移/SSO/计费 | 单一、不可清空 |
| Admin | 全部 CRUD + 团队设置 | 无租户删除/转移 |
| Editor | 创建修改，无成员/计费管理 | **邀请默认角色** |
| Viewer | 只读 | 常按档位限制 |
| Billing | 财务隔离角色 | 仅成本/预算 |
| Custom | resource × verb 矩阵 | 对标 K8s Role rules |

### 10.2 两层作用域
- 粗：团队/组织角色
- 细：项目/资源角色

### 10.3 subresource 级授权
`exec`（终端）、`logs`（日志）作为可独立授权的 subresource——对标 K8s `pods/exec`、`pods/log`。

### 10.4 API Token
scoped token（对标 Fly macaroon），按 app/org/resource 维度签发。

---

## 11. 调研来源

### Agent 沙箱平台
- E2B — https://e2b.dev/docs
- Daytona — https://www.daytona.io/docs
- Modal — https://modal.com/docs/guide/sandbox
- CodeSandbox SDK — https://codesandbox.io/docs/sdk
- Runloop — https://docs.runloop.ai
- Morph — https://docs.morph.sh
- Fly Machines — https://fly.io/docs/machines/

### 底层隔离
- Firecracker 快照 — https://firecracker-microvm.github.io/firecracker/main/docs/snapshotting/snapshot-support/
- gVisor — https://gvisor.dev/docs/
- Kata Containers — https://katacontainers.io/

### 编排与治理
- Kubernetes Pod 生命周期 — https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/
- K8s RBAC — https://kubernetes.io/docs/reference/access-authn-authz/rbac/
- K8s VolumeSnapshot — https://kubernetes.io/docs/concepts/storage/volume-snapshots/
- KEDA — https://keda.sh/docs/2.16/concepts/
- Knative autoscaling — https://knative.dev/docs/serving/autoscaling/

### 参考控制台
- Portainer — https://docs.portainer.io/
- Rancher — https://ranchermanager.docs.rancherdesktop.io/
- k9s — https://k9s.io/
- Lens — https://k8slens.dev/

---

## 12. 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P0** | 实例列表 / 详情(概览·日志·终端·监控·事件·快照) / 创建页补全 / 成本配额 | ✅ 原型完成 |
| **P1** | 镜像库 / 工具箱 / 模板库 / 网络域名 | ✅ 原型完成 |
| **P2** | 审计日志 / RBAC / 系统设置 | ⏳ 待实现 |
| **后续** | 接入真实后端 API、WebSocket 日志流、xterm 终端、metrics 后端 | ⏳ 待实现 |

---

## 13. 原型说明

`agent.tsx` 是本设计的交互原型，技术栈 React + Tailwind CSS + lucide-react，mock 数据驱动，可直接预览。

预览方式见仓库根目录 `README.md`。

---

*文档版本：v1.0 · 2026-07-15 · 基于业界调研与原型实现*

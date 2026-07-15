# Agent 沙箱控制台

一个面向 AI Agent 的沙箱（Sandbox）管理控制台。基于业界主流 Agent 沙箱平台与底层编排实践调研设计，含完整交互原型。

## 文档

| 文档 | 内容 |
|---|---|
| [DESIGN.md](./DESIGN.md) | 设计规格 — 模块清单、字段设计、状态机、安全模型、路线图 |
| [INSIGHTS.md](./INSIGHTS.md) | 调研洞察 — 10 条关键洞察与避坑点（常见误区 → 业界实践 → 为什么） |
| [agent.tsx](./agent.tsx) | 交互原型 — 8 模块完整界面，mock 数据驱动 |

## 功能模块

- **实例列表** — 运行态可见，状态/资源/就绪/花费，批量启停销毁
- **实例详情** — 概览 / 日志 / 终端 / 监控 / 事件 / 快照(Fork 血缘)
- **创建实例** — 资源规格 / 镜像分层 / 工具挂载 / 密钥 / 网络出口 / 生命周期治理 / 健康探针
- **成本配额** — 预算告警 / 资源配额 / 单价 / 项目花费
- **镜像库** — 版本 / 来源 / 安全扫描 / 引用
- **工具箱** — 版本 / 安装方式 / 默认启用
- **模板库** — 封装配置一键创建
- **网络域名** — Ingress 总览 / egress 策略 / TLS 证书

## 预览

技术栈：React 18 + Vite 5 + Tailwind CSS 3 + lucide-react。

线上部署：https://agentsandbox.vercel.app（Vercel，push main 自动部署）

```bash
npm install      # 安装依赖
npm run dev      # 开发模式，打开 http://localhost:5173
npm run build    # 生产构建
npm run preview  # 预览构建产物 http://localhost:4173
```

## 项目结构

```
agent.tsx          # 控制台原型（单文件，8 模块）
main.tsx           # React 挂载入口
index.html         # HTML 入口
index.css          # Tailwind 指令
vite.config.ts     # Vite 配置
tailwind.config.js # Tailwind 配置
postcss.config.js  # PostCSS 配置
tsconfig.json      # TypeScript 配置
package.json       # 依赖与脚本
DESIGN.md          # 设计规格
INSIGHTS.md        # 调研洞察报告
```

## 设计要点

1. **供给 ≠ 管理** — 实例列表与详情页是一等公民，而非仅一个创建向导
2. **快照 warm/cold 二分** — Warm(内存/CRIU) 秒级恢复可 1-to-many Fork；Cold(磁盘/CSI) 仅文件系统
3. **idle 判定基于资源活动** — 避免误杀无人值守长跑 agent（不采用 Colab 式浏览器交互判 idle）
4. **安全治理内建** — egress 白名单防数据外泄、Secret 加密分离、max_lifetime 强制销毁

详见 [DESIGN.md](./DESIGN.md) 与 [INSIGHTS.md](./INSIGHTS.md)。

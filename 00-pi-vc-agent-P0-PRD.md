# pi-vc-core P0 PRD 母文档

版本：v0.2  
定位：P0 基础能力底座  
产品形态：GitHub 托管、可安装的 Pi package  
核心原则：轻量、本地优先、低侵入、Markdown-first、可解释、可迁移

---

## 1. 产品定位

`pi-vc-core` P0 不是完整 VC 投资 Agent，也不是内置 BP 分析、投委 memo、法务审阅的一体化工作流产品。

P0 的定位是：

```text
VC 私有项目工作台 + 个人投资记忆底座
```

它优先解决三件事：

1. 项目材料在本地被安全读取、解析、修改，不覆盖原件；
2. Word、PPT、PDF、扫描件等材料可以被结构化处理；
3. 用户自己的判断、修正、选择和项目经验可以沉淀为 Markdown memory。

P0 允许 Agent 根据用户 prompt 和已解析材料回答问题，不对投资判断做硬围栏；但 P0 不内置完整 VC workflow skill，也不声称完成事实校验、尽调或投资建议。

---

## 2. 交付形态

P0 的正式交付物是一个可安装的 Pi package，而不是普通项目模板。

目标安装体验：

```bash
pi install git:github.com/<user>/pi-vc-core@v0.1.0
cd D:\VCProjects\某项目
pi
```

P0 代码保存在 GitHub，并通过版本号持续更新。

未来可以发布到 npm，但 P0 优先使用 GitHub 安装和本地开发安装：

```bash
pi install git:github.com/<user>/pi-vc-core@v0.1.0
pi install ./path/to/pi-vc-core
```

---

## 3. Package 结构

P0 使用单一 package，默认包含三个 extension，并允许未来继续增加 extension。

```text
pi-vc-core/
├─ package.json
├─ README.md
├─ AGENTS.md
├─ extensions/
│  ├─ vc-project-workspace/
│  │  ├─ index.ts
│  │  ├─ public.ts
│  │  ├─ schema.ts
│  │  └─ internal/
│  ├─ vc-office-core/
│  │  ├─ index.ts
│  │  ├─ public.ts
│  │  ├─ schema.ts
│  │  └─ internal/
│  └─ vc-memory/
│     ├─ index.ts
│     ├─ public.ts
│     ├─ schema.ts
│     └─ internal/
├─ skills/
│  ├─ skill-creator/
│  └─ vc-material-reader/
├─ prompts/
│  └─ dream.md
├─ references/
│  ├─ project-workspace-rules.md
│  ├─ office-editing-rules.md
│  ├─ memory-capture-rules.md
│  └─ skill-creation-rules.md
└─ docs/
   ├─ install.md
   ├─ architecture.md
   ├─ qmd-install.md
   ├─ ocr-paddleocr.md
   └─ changelog.md
```

`package.json` 应声明 Pi package 能力：

```json
{
  "name": "pi-vc-core",
  "version": "0.1.0",
  "keywords": ["pi-package", "vc", "agent", "office", "memory"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  }
}
```

---

## 4. Extension 边界

每个 extension 固定三层：

```text
index.ts     Pi extension 注册入口，暴露 tools / commands
public.ts    package 内其他 extension 可调用的轻量 API
schema.ts    输入输出类型和共享契约
internal/    私有实现，不允许其他 extension 依赖
```

P0 不设计复杂插件总线、服务注册、跨包协议或第三方 extension 兼容层。

兼容性边界：

1. `pi-vc-core@0.1.x` 内部 extension 必须互相兼容；
2. P0 不承诺第三方 extension 长期依赖 `public.ts` 的稳定性；
3. 未来新增 extension 优先放入同一个 package；
4. 只有出现独立用户、独立发布节奏或独立依赖负担时，才考虑拆包。

---

## 5. P0 核心范围

P0 包含：

1. `vc-project-workspace`：项目身份、路径安全、低侵入工作区、artifact registry；
2. `vc-office-core`：Office/PDF/OCR 读取、转换、文本级 patch、diff、render；
3. `vc-memory`：Markdown memory、自动捕获强用户信号、recall、Dream；
4. `vc-material-reader` smoke-test skill：验证 workspace → office → parsed → recall → memory optional 的最小闭环；
5. 少量 slash commands：`/vc-doctor`、`/vc-init`、`/vc-read`、`/vc-overview`、`/dream`。

P0 支持使用 Pi 原生 `@file` 作为推荐文件选择入口，`/vc-read <path>` 作为备用显式入口。

---

## 6. P0 不做什么

P0 暂不实现：

1. `vc-search` extension；
2. `vc-search` skill；
3. 正式 `vc-bp-analysis` skill；
4. `vc-legal-review` skill；
5. `vc-investment-memo` skill；
6. Evidence 数据库；
7. 完整事实校验系统；
8. PDF 本体编辑；
9. PPT 自动美化；
10. 多用户账号、团队权限、云同步；
11. 内置 memory 加密和密钥管理；
12. 系统后台常驻定时任务；
13. Claude Code / OpenCode / Codex 深度适配。

P0 代码结构按可安装 package 设计，但默认配置按个人本地使用设计。不要为未来多人使用牺牲当前代码简洁性。

---

## 7. 用户与场景

### 目标用户

VC 投资人个人使用，重点面向：

1. 项目材料阅读；
2. BP / PPT / Word / PDF 分析；
3. 投委材料、法务文件、访谈纪要的辅助修改；
4. 项目判断、投资审美、赛道认知的长期沉淀。

### 典型场景

```text
场景一：用户通过 @file 选择 BP、PDF、Word、PPT 并读取
场景二：修改 PPT / Word 中的若干文本内容，并生成 diff
场景三：记录用户对某个项目的判断、修正或采纳
场景四：Pi 启动时发现 Dream 到期，提醒用户是否整理短期记忆
场景五：通过 QMD 或 basic text search 召回历史项目经验和长期认知
```

---

## 8. 产品设计原则

### 8.1 本地优先

项目文件、解析结果、输出文件和记忆文件默认保存在本地。

### 8.2 低侵入 workspace

项目根目录默认只创建隐藏目录 `.pi-vc/`。不默认创建 `input/`、`output/`、`parsed/`、`diff/`、`cache/`、`logs/` 等可见目录。

项目内原始文件允许原地读取，但禁止原地覆盖。

### 8.3 不覆盖原件

所有修改结果默认进入 `<project>/.pi-vc/output/`，diff 进入 `<project>/.pi-vc/diff/`，解析结果进入 `<project>/.pi-vc/parsed/`。

项目外文件必须先复制到 `<project>/.pi-vc/input/`，并显式通知用户。

### 8.4 Workspace 是强制入口

所有涉及项目文件读写的 extension 必须先通过 `vc-project-workspace` 做路径解析、输出路径生成和 artifact 注册。

### 8.5 Office 文件专用链路

Word / PPT / PDF / 扫描件不得直接使用通用 read/edit/write 处理，必须通过 `vc-office-core`。

### 8.6 Markdown-first memory

Memory 第一阶段不使用数据库作为主存储，采用 Markdown 作为 source of truth。

### 8.7 Memory 只沉淀用户信号

普通 Agent 输出、搜索结果、文件内容、OCR 原文不直接进入长期记忆。只有用户明确判断、修正、选择、项目决策、复盘或 Dream commit 确认后，才进入 memory。

### 8.8 外部依赖可选降级

QMD、PaddleOCR、LibreOffice、Microsoft Office COM 都应作为外部 provider/dependency 管理。web-search 和 MCP 通过第三方 Pi companion packages 作为 bundled dependency 集成，但仍保持第三方版权、许可和运行边界。缺失时返回清晰 warning，并尽量降级，不阻断主流程。

### 8.9 日志最小化

默认日志不记录文档正文、OCR 原文、prompt、完整模型回复或用户完整判断。artifact registry 记录来源关系，logs 只记录安全的 warning/error。

---

## 9. 运行环境

P0 是 Windows-first local package。

正式支持环境：

```text
Windows 10/11
Pi Agent installed
Node runtime as required by Pi
PowerShell 7 recommended
Microsoft Office desktop recommended
Python optional
PaddleOCR optional
QMD optional
LibreOffice optional fallback
```

跨平台边界：

```text
macOS / Linux:
- workspace 和 memory 理论上可用；
- MS Office COM convert/render 不可用；
- LibreOffice provider 可选；
- OCR provider 可选；
- 不作为 P0 验收平台。
```

---

## 10. 与 Pi 通用能力的关系

P0 不自研 web-search 和 MCP，但默认随 `pi-vc-core` 声明并加载第三方 Pi companion packages。

### Web Search

P0 通过 bundled `pi-web-access` package 使用联网能力。

P0 不做 VC 搜索策略，不做来源分级，不做证据链。

### MCP

P0 可通过 bundled `pi-mcp-adapter` package 接入浏览器、数据库、GitHub、Context7、filesystem 或其他外部工具。

MCP 不替代 Workspace、Office、Memory 三个核心模块，尤其不得用通用 MCP filesystem 工具绕过 workspace 规则直接覆盖原始项目文件。

### QMD

QMD 是显式外部依赖，不打包进 `pi-vc-core`。P0 提供安装指南和可用性检测。QMD 不可用时，recall 降级为 basic text search 或返回 clear warning。

---

## 11. 命令入口

P0 提供少量用户入口命令：

```text
/vc-doctor      检查运行环境和 provider 可用性
/vc-init        显式初始化 workspace，可选
/vc-read        解析单文件或受控批量目录
/vc-overview    运行 vc-material-reader smoke-test skill
/dream          生成 Dream proposal，经用户确认后 commit
```

推荐主入口：

```text
读一下 @BP.pptx
总结 @访谈纪要.docx
解析 @materials/
```

`@file` 只是文件选择入口。Office/PDF 文件仍必须走 `office_read` / `document_parse`，不得绕过 `vc-office-core`。

---

## 12. 最小可用闭环

### 闭环一：项目资料读取

```text
用户通过 @file 或 /vc-read 选择文件
→ implicit init workspace
→ workspace 判断路径是否项目内
→ 项目外文件复制到 .pi-vc/input/ 并通知用户
→ office_read / document_parse
→ .pi-vc/parsed/ 生成 DocumentObject JSON 和 Markdown projection
→ artifact registry 记录 source → parsed
→ Agent 基于解析结果回答问题
```

### 闭环二：Office 安全编辑

```text
office_read / office_inspect
→ 生成 PatchObject
→ office_patch
→ .pi-vc/output/ 生成新文件
→ office_diff
→ .pi-vc/diff/ 生成修改说明
→ 尝试 office_render
→ render 成功则生成 preview 和 mechanical validation
```

### 闭环三：记忆沉淀

```text
用户表达判断 / 修正 / 选择 / 项目决策
→ memory_capture 默认自动写入 short-term candidate
→ sensitive guard 过滤明显敏感内容
→ QMD 或 basic search 可召回
→ /dream 生成 proposal
→ 用户确认后 dream_commit
→ 更新 project memory 或 long-term memory
```

### 闭环四：启动提醒

```text
Pi 启动 / package 激活 / workspace 初始化
→ 检查 last_dream_at
→ 达到 interval_days 阈值
→ 提醒用户是否运行 /dream
→ 只提醒，不自动写 memory
```

---

## 13. Smoke-test Skill

P0 内置一个极轻 smoke-test skill：`vc-material-reader`。

职责：

1. 检查 workspace 状态；
2. 列出已登记 source / parsed artifacts；
3. 召回 project memory，如果存在；
4. 召回 parsed document index，如果存在；
5. 输出材料概览、解析覆盖、缺失信息、下一步阅读建议、warnings。

不做：

1. 不作为正式 BP 分析 skill；
2. 不生成投委 memo；
3. 不自动写 long-term memory；
4. 不替代用户 prompt 或后续专业 VC workflow skill。

---

## 14. P0 验收标准

P0 完成后，应至少满足：

1. 能通过 GitHub 安装为 Pi package；
2. 能通过 `/vc-doctor` 输出环境 readiness report；
3. 能在任意目录通过 implicit init 或 `/vc-init` 创建低侵入 `.pi-vc/workspace.json`；
4. 能读取项目内文件但不覆盖原件；
5. 能将项目外文件复制到 `.pi-vc/input/`，并显式通知用户；
6. 能维护轻量 `artifacts.jsonl` registry；
7. 能读取 `.docx`、`.pptx`、文本型 PDF；
8. 能通过 provider 机制转换 `.doc`、`.ppt`，Windows 默认优先 MS Office COM，失败时降级；
9. 能识别扫描 PDF，PaddleOCR 可用时生成 OCR block，不可用时返回 warning；
10. 能输出 DocumentObject JSON 和 Markdown projection；
11. 能对 Word / PPT 执行文本块级 patch；
12. 能生成修改后文件和 diff；
13. 能尝试 render 并执行 mechanical validation；
14. 能将强用户信号默认自动写入 short-term Markdown；
15. 能区分 memory recall 和 document recall；
16. QMD 可用时使用 QMD，不可用时降级 basic text search；
17. 能执行 `/dream` 的 proposal + approval + commit 流程；
18. 能在 Pi 启动时按阈值提醒 Dream，但不自动 commit；
19. 能运行 `vc-material-reader` smoke-test skill；
20. 不实现正式 VC workflow skills，但保留 `skill-creator` 作为后续自举能力。

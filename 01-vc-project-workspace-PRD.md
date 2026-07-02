# vc-project-workspace PRD

版本：v0.2  
模块：`vc-project-workspace`  
定位：项目文件纪律层和低侵入 workspace

---

## 1. 模块目标

`vc-project-workspace` 负责管理当前 VC 项目的本地工作区，保证项目文件可以被安全读取、解析、修改和追踪，避免原始材料被覆盖。

该模块不理解文件内容，不做 OCR，不修改 Office 文件，只负责：

1. 项目身份识别；
2. 路径解析与安全校验；
3. 外部文件导入；
4. 输出路径生成；
5. artifact registry；
6. 最小化日志；
7. 为其他 extension 提供强制文件入口。

Workspace 是 `pi-vc-core` 的文件纪律根模块。所有涉及项目文件读写的 extension 必须通过 workspace API。

---

## 2. 默认目录结构

P0 默认使用 `compact` layout，不在项目根目录创建多个可见文件夹。

最小初始化结果：

```text
D:\VCProjects\某项目\
├─ 原有项目文件
└─ .pi-vc\
   └─ workspace.json
```

其他目录懒创建：

```text
D:\VCProjects\某项目\
└─ .pi-vc\
   ├─ workspace.json
   ├─ config.json          # 可选，只有显式项目级配置时创建
   ├─ artifacts.jsonl      # 首次有 artifact 时创建
   ├─ input\               # 首次导入项目外文件时创建
   ├─ output\              # 首次生成修改后文件时创建
   ├─ parsed\              # 首次解析文件时创建
   ├─ diff\                # 首次生成 diff 时创建
   ├─ cache\               # 首次需要缓存、转换、渲染时创建
   ├─ logs\                # 首次 warning/error 需要落盘时创建
   └─ memory\              # 首次创建 project memory 时创建
```

P0 不默认创建根目录 `AGENTS.md`。如需项目级规则，可创建：

```text
<project>\.pi-vc\AGENTS.md
```

根目录 `AGENTS.md` 仅在用户显式要求时创建，避免影响 OpenCode、Claude Code、Codex 等其他 agent。

---

## 3. 全局配置和项目配置

默认读取全局配置：

```text
~\.pi-vc\config.json
```

项目级配置可选：

```text
<project>\.pi-vc\config.json
```

默认不修改项目级配置，除非用户显式要求。

配置优先级：

```text
built-in defaults
→ ~/.pi-vc/config.json
→ <project>/.pi-vc/config.json
→ command arguments
```

`workspace.json` 只记录项目身份和 workspace schema，不记录文件清单：

```json
{
  "schema_version": 1,
  "project_id": "proj_20260703_abc123",
  "project_name": "某项目",
  "created_at": "2026-07-03T10:00:00+08:00",
  "layout": "compact"
}
```

---

## 4. Root 识别规则

P0 不使用 Git root detection。VC 项目文件夹不假设是代码仓库。

Root 识别规则：

1. 从当前目录向上查找最近的 `.pi-vc/workspace.json`；
2. 找到则使用该目录作为 project root；
3. 找不到则把当前目录作为 project root；
4. implicit init 时创建当前目录下的 `.pi-vc/workspace.json`；
5. 用户可以显式指定 project root。

`/vc-init` 是可选命令。任何需要 workspace 的命令都可以 implicit init，并显式通知用户。

---

## 5. 核心能力

### 5.1 初始化项目工作区

工具：`workspace_init`

功能：

1. 按 root 识别规则确定 project root；
2. 如不存在 workspace，则创建 `.pi-vc/workspace.json`；
3. 如已存在 workspace，则检查 schema 和完整性；
4. 不默认创建 `input/output/parsed/diff/cache/logs/memory`；
5. 不默认创建项目级 `config.json`；
6. 不默认创建根目录 `AGENTS.md`；
7. 可触发 memory Dream startup check，但只提醒，不执行 commit。

---

### 5.2 路径解析与安全校验

工具：`workspace_resolve_path`

功能：

1. 将用户输入、相对路径、绝对路径或 Pi `@file` 解析为 source path；
2. 判断路径是否位于 project root 内；
3. 阻止路径逃逸；
4. 阻止覆盖原始 source file；
5. 检查输出路径是否合法。

规则：

```text
项目内文件:
- 允许原地读取和解析；
- 禁止原地覆盖；
- 原始文件可以散落在项目根目录和子目录。

项目外文件:
- 不允许直接处理；
- 必须先复制到 .pi-vc/input/；
- 必须显式通知用户。
```

路径逃逸示例：

```text
..\..\secret.docx
```

应被拒绝。

---

### 5.3 导入外部文件

工具：`workspace_import_file`

功能：

1. 将 project root 外的文件复制到 `.pi-vc/input/`；
2. 保留原始文件名；
3. 如文件名冲突，默认自动增加后缀；
4. 生成 `external_imported` artifact 记录；
5. 显式通知用户复制行为。

示例：

```text
C:\Users\Lei\Downloads\BP.pptx
→ D:\VCProjects\某项目\.pi-vc\input\BP.pptx
```

通知内容至少包括：

```text
Imported external file:
source: C:\Users\Lei\Downloads\BP.pptx
copied_to: <project>\.pi-vc\input\BP.pptx
reason: pi-vc-core does not process external files in-place
```

默认只通知，不二次确认。

需要二次确认的例外：

1. 文件超过配置阈值，默认 200 MB；
2. 文件名冲突且会产生多个副本；
3. 外部路径看起来是敏感目录；
4. 复制失败后需要用户选择替代路径。

---

### 5.4 创建输出路径

工具：`workspace_create_output_path`

功能：

1. 为修改后文件生成 `.pi-vc/output/` 路径；
2. 为 diff 生成 `.pi-vc/diff/` 路径；
3. 为 parsed 生成 `.pi-vc/parsed/` 路径；
4. 为 cache/rendered/converted 生成 `.pi-vc/cache/` 路径；
5. 避免覆盖已有输出。

示例：

```text
BP.pptx
→ .pi-vc/output/BP_edited_20260703.pptx
→ .pi-vc/diff/BP_diff_20260703.md
→ .pi-vc/parsed/BP_20260703.document.json
```

输出文件不自动复制回原文件所在目录。

如未来提供导出命令：

```text
/vc-export <artifact_id> <target_path>
```

P0 默认不支持覆盖原件，最多支持另存为到指定路径。

---

### 5.5 注册产物

工具：`workspace_register_artifact`

P0 使用轻量 `artifacts.jsonl` registry，而不是数据库，也不是完整 event log。

只记录关键来源关系：

```text
source_seen
external_imported
parsed_created
output_created
```

示例：

```jsonl
{"id":"art_001","type":"source_seen","source_path":"BP.pptx","sha256":"...","created_at":"2026-07-03T10:00:00+08:00"}
{"id":"art_002","type":"parsed_created","source_artifact_id":"art_001","artifact_path":".pi-vc/parsed/BP.document.json","markdown_path":".pi-vc/parsed/BP.document.md","created_at":"2026-07-03T10:02:00+08:00"}
{"id":"art_003","type":"output_created","source_artifact_id":"art_001","artifact_path":".pi-vc/output/BP_edited.pptx","diff_path":".pi-vc/diff/BP_diff.md","created_at":"2026-07-03T10:20:00+08:00"}
```

`artifacts.jsonl` 在首次注册 artifact 时懒创建。

---

### 5.6 查看产物

工具：`workspace_list_artifacts`

功能：

1. 查看当前项目已登记 source、parsed、output；
2. 按类型筛选；
3. 返回 artifact id、路径、生成时间和来源关系；
4. 为 `/vc-overview`、`document_recall_qmd`、后续 VC workflow skill 提供基础。

---

### 5.7 最小化日志

工具：`workspace_log_event`

默认 logs 只写安全运行信息：

```text
timestamp
tool
status
artifact_id
warning/error code
safe message
```

默认 logs 不写：

```text
文档正文
OCR 原文
用户完整判断
prompt
model response
API key 或环境变量
```

artifact registry 负责记录来源关系，logs 只用于 warning/error/debug。

---

## 6. 文件操作规则

### 6.1 禁止覆盖原件

任何工具不得覆盖项目内原始 source file，也不得覆盖 `.pi-vc/input/` 中导入的原始副本。

### 6.2 原始文件不强制搬迁

项目内原始文件可以保留在原位置。P0 不要求所有文件进入 `input/`。

### 6.3 生成物进入 `.pi-vc/`

```text
parsed  → .pi-vc/parsed/
output  → .pi-vc/output/
diff    → .pi-vc/diff/
cache   → .pi-vc/cache/
logs    → .pi-vc/logs/
```

### 6.4 外部文件必须导入

project root 外的文件必须复制到 `.pi-vc/input/` 后再处理，并通知用户。

### 6.5 Workspace 是强制入口

未来任何 extension：

1. 不直接拼接项目输出路径；
2. 不直接写原始 source file；
3. 写 `.pi-vc/output|parsed|diff|cache` 前必须调用 workspace API；
4. 生成关键文件后必须 register artifact。

---

## 7. 与其他模块关系

### 与 Office 模块

Office 模块依赖 Workspace 的路径和 artifact 管理：

```text
workspace_resolve_path
→ office_read / office_patch / office_render
→ workspace_create_output_path
→ workspace_register_artifact
```

Office 模块不得绕过 workspace 直接写 output、parsed 或 diff。

### 与 Memory 模块

Workspace 向 Memory 提供 project root、project id、artifact metadata。

Memory 可以使用：

```text
<project>/.pi-vc/memory/
```

但 Workspace 不直接写语义 memory。

### 与 MCP

MCP 工具可以访问外部系统，但不得绕过 Workspace 规则直接修改项目原始文件。

---

## 8. Slash Command 关系

Workspace 支撑以下用户入口：

```text
/vc-init     显式初始化 workspace
/vc-read     解析单文件或受控目录
/vc-overview 列出材料和解析覆盖
/vc-doctor   检查当前目录可写性和 workspace 状态
```

`@file` 是推荐文件选择方式。Workspace 负责把 `@file` 映射为 source path，并判断是否需要导入。

---

## 9. 验收标准

1. 能在当前目录或显式指定目录创建 `.pi-vc/workspace.json`；
2. 支持 implicit init；
3. 不使用 Git root detection；
4. 默认不创建多个可见目录；
5. 默认不创建项目级 `config.json`；
6. 默认不创建根目录 `AGENTS.md`；
7. 能原地只读处理项目内文件；
8. 能阻止覆盖项目内原始文件；
9. 能将项目外文件复制到 `.pi-vc/input/` 并显式通知；
10. 能阻止路径逃逸；
11. 能为 parsed、output、diff、cache 生成安全路径；
12. 能维护轻量 `artifacts.jsonl` registry；
13. 能列出 source、parsed、output artifacts；
14. logs 默认最小化，不记录正文、prompt 或完整用户判断；
15. 能为其他 extension 提供 `public.ts` API 和 `schema.ts` 契约。

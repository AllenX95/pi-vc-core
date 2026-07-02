# vc-office-core PRD

版本：v0.2  
模块：`vc-office-core`  
定位：Office/PDF/OCR 结构化读取与安全编辑模块

---

## 1. 模块目标

`vc-office-core` 负责处理 VC 工作中常见的本地文档材料，包括 Word、PPT、PDF、扫描件和旧格式 Office 文件。

核心目标：

1. 读取 `.docx`、`.pptx`、文本型 PDF；
2. 通过 provider 机制转换并读取 `.doc`、`.ppt`；
3. 识别扫描 PDF，并在 PaddleOCR 可用时解析；
4. 输出统一结构化 `DocumentObject`；
5. 同时输出 Markdown projection 供阅读和检索；
6. 基于 `PatchObject` 安全修改 Word / PPT；
7. 生成修改 diff；
8. 尝试渲染预览并执行机械校验；
9. 当结构化 patch 风险过高时，使用 Markdown 输出作为内容兜底。

Office 模块必须通过 `vc-project-workspace` 处理路径、输出和 artifact 注册，不得直接覆盖项目原始文件。

---

## 2. 支持文件类型

### P0 支持读取

```text
.docx
.pptx
.pdf
.doc  → provider 转换为 .docx
.ppt  → provider 转换为 .pptx
扫描 PDF → OCR provider 可用时 document_parse
```

### P0 支持编辑

```text
.docx
.pptx
.doc 转换后的 .docx
.ppt 转换后的 .pptx
```

### P0 不支持

```text
PDF 本体编辑
Word 修订模式
复杂批注处理
run 级局部样式编辑
PPT 母版编辑
PPT 动画编辑
复杂图表编辑
旧 .doc / .ppt 原格式回写
加密文件稳定处理
损坏文件稳定处理
服务器或 CI 环境下的 Office COM 稳定运行
```

---

## 3. 核心工具

```text
office_read
office_inspect
office_convert
document_parse
office_patch
office_diff
office_render
office_validate_layout
office_extract_markdown
```

---

## 4. 技术栈和 helper 通信

Extension 主体使用 TypeScript / Node。

Windows helper 策略：

```text
MS Office COM helper: PowerShell 7 优先
PDF/OCR helper: Python 可选
LibreOffice helper: 命令行 provider 可选
```

PowerShell 规则：

1. 优先检测 `pwsh.exe`；
2. 找不到时 fallback 到 `powershell.exe`；
3. helper 脚本使用 UTF-8；
4. helper 与 TypeScript 之间只传递 UTF-8 JSON；
5. 主程序不得解析 PowerShell 自然语言输出；
6. 中文提示由 TypeScript 层生成。

PowerShell helper 建议设置：

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
```

---

## 5. office_read

### 功能

读取 Word、PPT、PDF，并输出统一 `DocumentObject`。

### Word 读取对象

```text
标题
段落
表格
页眉页脚，后续可选
```

### PPT 读取对象

```text
slide
shape
text frame
paragraph
table
image placeholder
```

### PDF 读取对象

```text
page
text block
native text
OCR text
```

### 输出文件

每次 parse 生成双格式：

```text
.pi-vc/parsed/BP_20260703.document.json
.pi-vc/parsed/BP_20260703.document.md
```

规则：

1. JSON 是 source of truth；
2. Markdown projection 只用于阅读、检索和人工审阅；
3. `office_patch` 必须基于 JSON 中的 `block_id`；
4. 不得基于 Markdown projection 直接 patch Office 文件。

### DocumentObject 示例

```json
{
  "doc_type": "pptx",
  "source_path": "BP.pptx",
  "source_artifact_id": "art_001",
  "blocks": [
    {
      "block_id": "pptx_slide005_shape003_para001_a1b2c3",
      "type": "text",
      "text": "公司专注于国产算力 Kernel Agent...",
      "location": {
        "slide": 5,
        "shape_id": 3,
        "paragraph": 1
      },
      "editable": true,
      "source_type": "native_text",
      "content_hash": "a1b2c3"
    }
  ],
  "markdown_path": ".pi-vc/parsed/BP_20260703.document.md",
  "warnings": []
}
```

---

## 6. block_id 策略

P0 使用 stable-best-effort `block_id`。

规则：

1. 基于文档结构路径生成；
2. 可附加短 content hash；
3. 同一文件未变化时应尽量稳定；
4. 文档结构或内容变化后不保证旧 `block_id` 仍可用；
5. `office_patch` 发现 `block_id` 不存在或 hash 不匹配时，必须拒绝或要求重新 `office_read`；
6. P0 不做复杂 anchor recovery。

示例：

```text
pptx_slide005_shape003_para001_a1b2c3
docx_body_p012_para001_d4e5f6
pdf_page007_block004_91ab2c
```

---

## 7. office_inspect

### 功能

查看文档结构，帮助 Agent 定位内容。

典型问题：

```text
PPT 有多少页？
第 5 页有哪些文本框？
Word 有哪些标题？
PDF 哪几页是扫描件？
```

### 输出

```text
文档类型
页数 / slide 数
block 数
table 数
image 数
可编辑 block 数
疑似扫描页
warnings
```

---

## 8. office_convert

### 功能

通过 provider 机制处理旧格式：

```text
.doc → .docx
.ppt → .pptx
```

### Provider 策略

```text
provider = auto
Windows + MS Office 可用 → ms-office-com
COM 失败或不可用 → libreoffice-headless
两者都不可用 → conversion_unavailable warning
```

MS Office COM 是 Windows-first P0 的默认推荐 provider。LibreOffice 是可选 fallback，不打包进 package。

### 规则

1. 转换文件进入 `.pi-vc/cache/converted/`；
2. 不覆盖原始 `.doc` / `.ppt`；
3. 后续编辑只针对转换后的 `.docx` / `.pptx`；
4. 生成 conversion report；
5. 提示可能存在排版变化；
6. 转换 provider 缺失不影响 `.docx`、`.pptx`、文本型 PDF 主流程。

### MS Office COM 边界

MS Office COM 自动化只声明支持本地个人 Windows 桌面场景，不声明支持服务器、CI、后台无人值守稳定运行。

---

## 9. document_parse

### 功能

处理扫描 PDF、图片型 PDF、复杂中文文档。

### 默认技术路线

```text
可复制文本 PDF：优先原生文本提取
扫描 PDF：检测为 needs_ocr
PaddleOCR 可用：生成 OCR blocks
PaddleOCR 不可用：返回 warning 和安装指引
```

P0 保留 PaddleOCR-compatible provider 接口。默认 provider 名称为 `paddleocr`，但 package 不强制打包 PaddleOCR 模型和 Python 环境。

### 输出字段

```text
page
block_id
text
bbox
confidence
source_type = ocr_text
editable = false
```

OCR 结果不可直接用于本体编辑，只能用于阅读、分析和引用线索。

---

## 10. office_patch

### 功能

基于 `PatchObject` 对 Word / PPT 进行安全文本级编辑。

### P0 支持粒度

```text
Word paragraph replace
Word table cell update
PPT text paragraph replace
PPT table cell update
insert_after / delete_block 谨慎支持
```

P0 不承诺：

```text
run 级局部样式
复杂批注
修订模式
图表内文字
PPT 母版/动画
PDF 本体编辑
```

`preserve_formatting: true` 表示尽量保留原 block 的基本样式，不保证复杂混排。

### PatchObject 示例

```json
{
  "target": "pptx_slide005_shape003_para001_a1b2c3",
  "operation": "replace_text",
  "value": "修改后的文字",
  "preserve_formatting": true,
  "expected_content_hash": "a1b2c3"
}
```

### 规则

1. 必须先执行 `office_read` 或 `office_inspect`；
2. 必须基于 `block_id` 修改；
3. block hash 不匹配时必须拒绝或要求重新读取；
4. 不允许自由修改原始文件；
5. 输出新文件到 `.pi-vc/output/`；
6. 修改后必须生成 diff；
7. 修改后默认尝试 render，但 render 失败不阻塞 patch。

---

## 11. Markdown 兜底

当结构化 patch 不适合或风险过高时，Office 模块应输出 Markdown 作为内容兜底。

典型场景：

```text
用户要求大幅重写 BP 十页内容
→ 不直接改 PPT
→ 生成 Markdown 改写稿，按 slide 分段
→ 用户确认后再选择是否 patch 到 PPT
```

输出示例：

```text
.pi-vc/output/BP_rewrite_20260703.md
.pi-vc/diff/BP_rewrite_notes_20260703.md
```

---

## 12. office_diff

### 功能

生成修改前后差异。

### 输出内容

```text
修改文件
来源文件
source artifact id
修改 block
before
after
warnings
是否可能影响排版
render / validation 结果
```

### 输出位置

```text
.pi-vc/diff/xxx_diff.md
```

---

## 13. office_render 和 office_validate_layout

### 功能

将 Word / PPT 渲染为 PDF 或图片预览，并执行机械校验。

### Provider 策略

```text
Windows + MS Office 可用 → ms-office-com
COM 失败或不可用 → libreoffice-headless
两者都不可用 → render_unavailable warning
```

### 规则

1. `office_patch` 后默认尝试 render；
2. render 失败不阻塞 patch；
3. render 成功后生成 preview 路径；
4. 无多模态模型时只做 mechanical validation；
5. 多模态 visual QA 是可选增强，不作为 P0 硬依赖。

### Mechanical checks

```text
渲染是否成功
输出页数 / slide 数是否变化
文件是否能打开 / 导出
文本是否成功替换
替换后文本长度变化
PPT 文本框可能溢出风险
目标 block 是否仍存在
```

不能可靠检查：

```text
PPT 是否美观
文本是否实际遮挡
图文排版是否错位
字体替换是否异常
中文换行是否自然
```

Diff 报告中应提示：

```text
Visual QA: not available, preview requires human review
```

---

## 14. Office 文件处理强规则

必须写入 `office-editing-rules.md` 和 package `AGENTS.md`：

```text
1. Word / PPT / PDF 不使用通用 read/edit/write 直接处理。
2. Office 文件读取必须走 office_read / office_inspect。
3. 扫描件必须走 document_parse。
4. 修改 Word/PPT 必须走 office_patch。
5. 修改前必须有 block_id。
6. office_patch 必须基于 DocumentObject JSON，不得基于 Markdown projection。
7. 修改后必须生成 output 文件和 diff 文件。
8. 不得覆盖项目内原始文件或 .pi-vc/input/ 原始副本。
9. OCR 文本不可作为可编辑原文。
10. provider 缺失时返回 warning，不得导致无关主流程失败。
```

---

## 15. 与 Workspace 的关系

Office 模块不得自行决定输出位置。

必须调用：

```text
workspace_resolve_path
workspace_create_output_path
workspace_register_artifact
workspace_log_event
```

Artifact 关系：

```text
source_seen / external_imported
→ parsed_created
→ output_created
```

---

## 16. 验收标准

1. 能读取 `.docx` 并输出结构化 block；
2. 能读取 `.pptx` 并输出 slide/shape/text block；
3. 能读取文本型 PDF；
4. 能输出 DocumentObject JSON 作为 source of truth；
5. 能输出 Markdown projection；
6. 能生成 stable-best-effort `block_id`；
7. 能通过 provider 机制转换 `.doc`、`.ppt`；
8. Windows 下默认优先 MS Office COM；
9. LibreOffice 可作为 fallback，但不是硬依赖；
10. 能识别扫描 PDF；
11. PaddleOCR 可用时能输出 OCR block；
12. PaddleOCR 不可用时返回 clear warning 和安装指引；
13. 能基于 block_id 修改 Word 段落或表格单元格；
14. 能基于 block_id 修改 PPT 文本段落或表格单元格；
15. hash 不匹配时拒绝 patch 或要求重新读取；
16. 能生成修改后文件到 `.pi-vc/output/`；
17. 能生成 diff 到 `.pi-vc/diff/`；
18. 能尝试 render 并输出 preview 或 warning；
19. 能执行 mechanical validation；
20. 能在无法安全 patch 时生成 Markdown 兜底输出；
21. 不覆盖任何原始 source file；
22. helper 与 TypeScript 之间使用 UTF-8 JSON 通信；
23. 能返回清晰 warnings。

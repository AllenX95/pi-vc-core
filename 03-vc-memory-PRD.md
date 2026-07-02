# vc-memory PRD

版本：v0.2  
模块：`vc-memory`  
定位：Markdown-first 个人 VC 记忆系统

---

## 1. 模块目标

`vc-memory` 负责沉淀用户的项目记忆、短期记忆和长期记忆。

P0 采用轻量方案：

```text
Markdown 作为记忆源文件
QMD 作为可选 recall provider
basic text search 作为 fallback
Dream 作为定期 proposal + approval + commit 机制
```

P0 不使用 SQLite 作为主存储，不建设 Evidence 数据库，不做内置加密，不做云同步。

Memory 是增强能力，不是运行前置条件。没有 memory 文档时，workspace 和 office-core 必须正常运行。

---

## 2. 设计原则

### 2.1 Markdown-first

所有 memory 以 Markdown 文件为 source of truth，并允许用户直接打开、阅读和修改。

### 2.2 分层 + 分类

记忆按层级和类别组织，保证可解释、可编辑、可复用。

### 2.3 用户信号驱动

Memory 不沉淀普通 Agent 输出，只沉淀用户明确判断、修正、选择、项目决策、复盘或 Dream commit 确认后的内容。

### 2.4 默认自动捕获强用户信号

P0 默认自动捕获强用户信号，写入 short-term candidate。通过 prompt 和 capture 规则降低写入频率，而不是每次打断用户确认。

### 2.5 Recall 可降级

QMD 是显式外部依赖，不打包进 package。QMD 可用时使用 QMD；不可用时降级为 basic text search 或返回 clear warning。

### 2.6 Dream 必须审批提交

Dream 可以被启动提醒触发，但不得自动写入 long-term 或 project memory。所有更新必须经过用户确认后 commit。

---

## 3. 存储位置

Memory 不存放在 package 安装目录。

### 全局 memory

跨项目的短期和长期记忆放在：

```text
~/.pi-vc/memory/
├─ short-term/
│  ├─ inbox/
│  ├─ review-queue.md
│  └─ archive/
├─ long-term/
│  ├─ taste/
│  ├─ judgments/
│  ├─ thesis/
│  ├─ people/
│  └─ experiences/
└─ dream/
   ├─ pending/
   ├─ reports/
   ├─ archive/
   ├─ config.json
   └─ last-dream.md
```

### 项目 memory

单个项目状态放在：

```text
<project>/.pi-vc/memory/
├─ PROJECT.md
├─ current-view.md
├─ decisions.md
├─ open-questions.md
├─ meeting-notes.md
└─ timeline.md
```

目录懒创建：

1. `memory_capture` 首次写入时创建；
2. `/dream` 首次运行时创建 dream 目录；
3. 没有 memory 目录时，recall 返回空结果和 warning，不报错；
4. Agent 不得假装有历史记忆。

---

## 4. 全局配置

默认读取：

```text
~/.pi-vc/config.json
```

项目级覆盖可选：

```text
<project>/.pi-vc/config.json
```

项目配置只有用户显式要求时创建或修改。

示例：

```json
{
  "schema_version": 1,
  "memory": {
    "enabled": true,
    "capture_mode": "selective_auto",
    "notify_after_capture": true,
    "max_auto_captures_per_session": 10
  },
  "dream": {
    "enabled": true,
    "interval_days": 7,
    "remind_on_startup": true
  },
  "recall": {
    "provider": "auto",
    "preferred": "qmd",
    "fallback": "text_search"
  }
}
```

---

## 5. 三层记忆

### 5.1 Short-term Memory

短期记忆记录近期用户信号和候选认知。

内容包括：

```text
用户最近表达的判断
用户对 Agent 输出的修正
用户采纳或否定的表达
近期项目待验证问题
可能值得沉淀的观察
阶段性复盘
```

示例文件：

```text
~/.pi-vc/memory/short-term/inbox/2026-07-03-kernel-agent-candidate.md
```

Short-term 是候选层，不作为稳定判断依据。

### 5.2 Project Memory

项目记忆记录单个项目的状态。

每个项目至少包含：

```text
PROJECT.md
current-view.md
decisions.md
open-questions.md
timeline.md
```

其中 `PROJECT.md` 是项目主文件，记录项目当前状态和核心判断。

### 5.3 Long-term Memory

长期记忆记录稳定、可复用的个人认知。

分类包括：

```text
taste        写作审美、材料偏好
judgments    投资判断框架
thesis       赛道认知
people       人物、机构、公司记忆
experiences  项目经验和复盘
```

---

## 6. Markdown 格式

所有 memory 文件使用 YAML frontmatter。

标准模板：

```markdown
---
id: mem_20260703_0001
type: short_term
category: judgment
status: candidate
project: infini-kernel-agent
tags: [AI Infra, Kernel Agent, 国产算力]
entities: [茵菲奈, 国产GPGPU]
trigger: user_correction
created_at: 2026-07-03
updated_at: 2026-07-03
source_note: conversation
promotion_candidate: true
---

# Kernel Agent 判断修正

用户强调：Kernel Agent 项目不能只看 CUDA benchmark，核心要看是否能迁移到国产算力平台，并进入客户真实生产环境。

## 为什么可能值得沉淀

该判断可能适用于后续自动算子生成、国产算力软件生态、AI Infra 自进化项目。
```

---

## 7. Memory Capture

### 功能

将用户信号写入 short-term candidate 或 project memory。

### 默认模式

```text
capture_mode = selective_auto
capture_threshold = strong_user_signal
```

默认自动捕获，但只捕获强用户信号，不捕获普通上下文。

### 可自动捕获的用户信号

```text
1. 用户明确说“记住”“以后都这样”“这是我的判断”；
2. 用户明确表达投资判断；
3. 用户修正 Agent 输出；
4. 用户选择某种表达；
5. 用户否定某种表述；
6. 用户做出项目推进、暂缓、放弃、立项、继续 DD 等决策；
7. 用户做阶段性复盘；
8. 用户确认或采纳 Agent 的某个判断。
```

### 不应自动写入 memory 的内容

```text
用户只是提问
用户只是上传或引用文件
用户只是要求总结、分析、修改
Agent 单方面生成的判断
Agent 对 BP 的分析结论
搜索结果
原始文件内容
OCR 原文
未经用户确认的推断
一次性任务过程
工具执行过程
```

### 写入规则

```text
用户显式“记住” → 可直接写入 long-term 或 project memory
用户修正 / 选择 / 判断 → 写入 short-term candidate
项目状态变化 → 写入 project memory
普通任务输出 → 不写 memory
Agent 单方面判断 → 不写 memory，除非用户确认、修正或采纳
```

自动写入后给轻提示：

```text
已记录为 short-term candidate: kernel-agent-production-validation.md
```

---

## 8. Sensitive Guard

P0 加轻量 sensitive guard，不做完整 DLP。

`memory_capture` 自动捕获前检查：

```text
API keys / tokens / passwords
身份证件号、银行卡号
个人联系方式
大段合同原文
大段项目原始材料
明显机密条款全文
```

命中时：

1. 不自动写入；
2. 提示用户确认；
3. 默认只保存摘要或引用线索；
4. 用户明确要求时才保存原文。

---

## 9. Recall

### 9.1 Memory recall 和 document recall 分开

P0 必须区分：

```text
memory_recall_qmd
document_recall_qmd
```

原因：

```text
memory = 用户判断资产
parsed documents = 项目材料来源
```

`parsed/` 中的内容不得作为 memory source of truth。parsed 内容只能作为项目材料证据或引用线索。

### 9.2 Memory recall 索引范围

```text
~/.pi-vc/memory/
<project>/.pi-vc/memory/
<project>/.pi-vc/AGENTS.md，若存在
```

### 9.3 Document recall 索引范围

```text
<project>/.pi-vc/parsed/
```

### 9.4 不建议索引

```text
.pi-vc/output/
.pi-vc/cache/
.pi-vc/logs/
大型原始文件
```

### 9.5 Recall provider

```text
QMD available:
→ semantic / keyword recall over Markdown

QMD unavailable:
→ fallback to basic text search
→ 或返回 qmd_unavailable warning
```

QMD 是外部依赖，不打包进 package。P0 提供：

```text
docs/qmd-install.md
/vc-doctor QMD 检测
缺失时安装提示
```

---

## 10. Dream 机制

### 功能

`/dream` 用于将 short-term candidates 整理为 project memory 或 long-term memory，并清理低价值 short-term。

Dream 是两阶段机制：

```text
dream_prepare
只读取、分析、生成 proposal，不改写 memory。

dream_commit
必须带用户确认信号，才真正写入 memory。
```

### 触发方式

```text
手动触发：/dream
启动提醒：Pi 启动 / package 激活 / workspace 初始化时检查
```

P0 不做系统后台常驻，不做 OS scheduler。只有 Pi 运行时才检查。

### Startup reminder

```text
Pi 启动 / package 激活 / workspace 初始化
→ 检查 last_dream_at
→ 如果距离现在 >= interval_days，默认 7 天
→ 检查 last_checked_at，避免同一天反复提醒
→ 提醒用户是否运行 /dream
→ 用户同意后执行 dream_prepare
→ 用户确认 proposal 后执行 dream_commit
```

### 状态文件

```text
~/.pi-vc/memory/dream/config.json
~/.pi-vc/memory/dream/last-dream.md
~/.pi-vc/memory/dream/pending/
~/.pi-vc/memory/dream/reports/
~/.pi-vc/memory/dream/archive/
```

`config.json` 示例：

```json
{
  "enabled": true,
  "interval_days": 7,
  "last_checked_at": "2026-07-03T09:00:00+08:00",
  "last_dream_at": null,
  "remind_on_startup": true
}
```

### last_dream_at 更新规则

```text
dream_prepare 不更新 last_dream_at
用户拒绝 proposal 不更新 last_dream_at
没有 short-term candidate 不更新 last_dream_at
dream_commit 成功后更新 last_dream_at
dream_commit 部分失败时不更新，或记录 partial failure
```

---

## 11. Dream 流程

```text
1. 读取 short-term/inbox 最近候选记忆；
2. 读取相关 project memory；
3. 召回 long-term 中相似记忆；
4. 判断每条短期记忆去向；
5. 合并重复内容；
6. 提炼长期可复用判断；
7. 生成 proposal；
8. 用户确认；
9. 更新 project memory；
10. 更新 long-term memory；
11. 归档已处理 short-term；
12. 生成 dream report；
13. 更新 last_dream_at。
```

短期记忆去向：

```text
promote_to_long_term
merge_into_existing
update_project_memory
keep_short_term
archive_low_value
delete_candidate，仅用户显式确认
```

默认 archive，不默认 delete。

---

## 12. Dream 清理规则

定期清理与 Dream 合并，不单独做复杂机制。

清理只处理 short-term memory。

Project memory 和 long-term memory 可以在 Dream proposal 中提出修改、合并建议，但不自动 prune。

`archive_low_value` 标准：

```text
超过 30 天仍未被引用
明显是一次性任务过程
与已沉淀 long-term/project memory 重复
用户表达已过时
缺少 project/entity/tag，且没有可复用判断
```

`delete_candidate` 标准：

```text
明显误捕获
空内容或格式损坏
包含敏感内容且用户确认删除
```

删除只能通过用户显式确认动作触发。

---

## 13. Dream 判断标准

短期记忆进入长期记忆，至少满足一个条件：

```text
1. 用户明确确认过；
2. 用户多次重复表达；
3. 适用于多个项目；
4. 能改变未来项目判断；
5. 能改变未来材料写作；
6. 是项目推进/放弃的明确经验；
7. 是某个赛道的稳定 thesis。
```

不得进入长期记忆：

```text
1. Agent 单方面生成的判断；
2. 原始文件事实；
3. 未确认的公司自述；
4. 一次性任务过程；
5. OCR 原文；
6. 临时搜索结果；
7. parsed/ 中的项目材料正文。
```

---

## 14. Dream Report

每次成功 `dream_commit` 生成报告：

```text
~/.pi-vc/memory/dream/reports/2026-07-09-dream-report.md
```

报告格式：

```markdown
# Dream Report 2026-07-09

## Promoted to Long-term

1. Kernel Agent 项目的判断标准
   - 来源：3 条 short-term candidate
   - 去向：long-term/judgments/kernel-agent.md

## Merged

1. 投资材料表达偏好
   - 合并到：long-term/taste/writing-style.md

## Updated Project Memory

1. 茵菲奈 Kernel Agent
   - 更新 current-view.md
   - 更新 open-questions.md

## Archived

1. 过期短期候选 4 条
```

如果没有候选 memory，`/dream` 可生成 no-op 提示或 no-op report，但不更新 `last_dream_at`。

---

## 15. Memory 工具

P0 需要的工具：

```text
memory_capture
memory_recall
document_recall
memory_list_short_term
memory_edit_markdown
memory_dream_prepare
memory_dream_commit
memory_startup_check
```

### memory_capture

根据强用户信号写入 short-term 或 project memory。

### memory_recall

召回 Markdown memory。QMD 可用时使用 QMD，不可用时 fallback 到 basic text search。

### document_recall

召回 `.pi-vc/parsed/` 中的 Markdown projection。不得混入 memory source of truth。

### memory_list_short_term

列出待 review 的 short-term candidates。

### memory_edit_markdown

打开或修改 memory Markdown 文件。

### memory_dream_prepare

生成 Dream proposal，不改写 memory。

### memory_dream_commit

在用户确认后提交 proposal，更新 project memory 或 long-term memory，并生成 report。

### memory_startup_check

在 Pi 启动、package 激活或 workspace 初始化时检查 Dream 是否到期，只提醒，不 commit。

---

## 16. System Prompt / AGENTS 规则

Pi system prompt / package `AGENTS.md` 应加入以下规则：

```text
1. Markdown memory 是记忆源文件。
2. Memory 是增强能力，不是运行前置条件。
3. 普通任务输出不得直接写入长期记忆。
4. Agent 单方面生成的投资判断不得自动写入 memory。
5. 用户确认、修正、采纳、判断、决策、复盘可以触发 memory_capture。
6. 项目任务优先召回当前 project memory。
7. 投资判断任务可召回 long-term/judgments。
8. 写作风格任务可召回 long-term/taste。
9. short-term 只作为近期上下文，不作为稳定判断依据。
10. parsed documents 不得作为 memory source of truth。
11. Dream 更新 long-term 时不得过度泛化。
12. 所有 Dream 更新必须经过用户确认并生成 dream report。
13. 用户可直接编辑 Markdown memory，编辑后应支持重新索引。
14. 明显敏感内容不得自动写入 memory。
```

---

## 17. 安全与隐私边界

P0 不做内置 memory 加密。

文档需说明：

```text
memory 存储在本机明文 Markdown；
用户应避免写入高度敏感原文；
如有需要，可把 ~/.pi-vc/ 放在系统加密磁盘或受保护目录；
P0 不负责密钥管理、加密索引、云同步加密。
```

---

## 18. 验收标准

1. 没有 memory 目录时，workspace 和 office-core 正常工作；
2. 能懒创建 `~/.pi-vc/memory/`；
3. 能懒创建 `<project>/.pi-vc/memory/`；
4. 能将强用户信号默认自动写入 short-term Markdown；
5. 不自动写入 Agent 单方面判断；
6. 不自动写入搜索结果、原始文件内容、OCR 原文；
7. 能对明显敏感内容触发确认或摘要保存；
8. 能创建和更新 project memory；
9. 能创建和更新 long-term memory；
10. 能区分 memory recall 和 document recall；
11. QMD 可用时能通过 QMD 召回相关 memory；
12. QMD 不可用时能降级 basic text search 或返回 clear warning；
13. 能执行 `/dream` 的 prepare + approval + commit；
14. 能在启动时按 `last_dream_at` 和 interval 提醒 Dream；
15. `last_dream_at` 只在 dream_commit 成功后更新；
16. Dream 能将 short-term 分流为长期、项目、合并、保留或归档；
17. Dream 清理只自动处理 short-term，默认 archive 不 delete；
18. 能生成 dream report；
19. 不把 parsed documents 当作 memory source of truth；
20. 所有 memory 文件可人工打开、阅读和修改；
21. P0 不依赖内置加密或云服务。

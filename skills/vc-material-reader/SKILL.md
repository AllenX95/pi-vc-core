---
name: vc-material-reader
description: Smoke-test the pi-vc-core base loop by reviewing registered project materials and memory context without becoming a full VC analysis workflow.
---

Use this skill to verify the base pi-vc-core loop:

1. Check the current workspace with `workspace_init` or `workspace_list_artifacts`.
2. Identify source and parsed artifacts.
3. Use `document_recall` for parsed project material if available.
4. Use `memory_recall` for project or long-term memory if available.
5. Return a concise overview of materials found, parsed coverage, missing information, next reading suggestions, and warnings.

Do not automatically write long-term memory. Do not treat parsed documents as user memory.

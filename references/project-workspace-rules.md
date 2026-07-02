# Project Workspace Rules

1. Do not overwrite project source files.
2. Project-local files may be read in place.
3. Project-external files must be copied into `.pi-vc/input/` before processing.
4. Generated artifacts belong under `.pi-vc/`.
5. Register source, parsed, output, and memory artifacts in `artifacts.jsonl`.
6. Logs must not contain document body text, prompts, model responses, or full user judgments.

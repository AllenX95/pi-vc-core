# pi-vc-core Agent Rules

This package provides a local VC workspace, Office parsing, and Markdown memory base layer.

Core rules:

1. Do not overwrite project source files.
2. Use `vc-project-workspace` APIs before reading or writing project artifacts.
3. Office/PDF files must go through `vc-office-core`.
4. Markdown memory stores user signals, not ordinary agent output.
5. Parsed project documents are source material, not memory source of truth.
6. External providers such as QMD, PaddleOCR, LibreOffice, and MS Office COM are optional and must degrade with clear warnings.
7. Use `vc_dependency_doctor` before installing dependencies. Ask the user before running install commands.

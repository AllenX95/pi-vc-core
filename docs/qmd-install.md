# QMD Install

QMD is an explicit external dependency. It is not bundled into `pi-vc-core`.

Current behavior:

- if `qmd` is available on `PATH`, recall reports provider `qmd`;
- if `qmd` is missing, recall falls back to basic text search and returns a warning.

Check:

```bash
qmd --help
```

Install:

```bash
npm install -g @tobilu/qmd
```

Use `/vc-doctor` to check whether Pi can see the command.

This package intentionally keeps recall provider installation separate because QMD can be heavier than the base package and may have its own release cycle.

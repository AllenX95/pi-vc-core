# Architecture

`pi-vc-core` is one Pi package with three default extensions:

1. `vc-project-workspace`
2. `vc-office-core`
3. `vc-memory`

Each extension uses:

```text
index.ts      Pi tool/command registration
public.ts     package-internal API for other extensions
schema.ts     input/output contracts
internal/     private implementation
```

The workspace extension is the required file discipline layer. Other extensions must use workspace APIs before writing `.pi-vc/` artifacts.

Default project state is compact:

```text
<project>/.pi-vc/workspace.json
```

Generated artifacts are lazy-created under `.pi-vc/parsed`, `.pi-vc/output`, `.pi-vc/diff`, `.pi-vc/cache`, and `.pi-vc/logs`.

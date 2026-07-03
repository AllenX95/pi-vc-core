# Install

Install Pi:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version
```

Install this package from the current checkout:

```bash
pi install .
pi list
```

Future GitHub install:

```bash
pi install git:github.com/<user>/pi-vc-core@v0.1.0
```

Recommended local environment:

- Windows 10/11
- PowerShell 7 (`pwsh`)
- Microsoft Office desktop for `.doc/.ppt` conversion provider
- bundled Pi companion packages: `pi-web-access` and `pi-mcp-adapter`
- Python, PaddleOCR, QMD, and LibreOffice are optional
- `fd` and `ripgrep` are recommended because Pi uses them for fast file discovery and search

Run:

```text
/vc-doctor
```

to see which dependencies are available and which install commands apply.

The same information is available to the Agent through the `vc_dependency_doctor` tool. The tool returns structured checks with:

- `required`, `recommended`, or `optional` importance;
- current availability;
- impact if missing;
- Windows install commands when the dependency is installable from the command line.

## Bundled Pi Companion Packages

`pi-vc-core` declares two Pi packages as runtime and bundled dependencies:

- `pi-web-access` provides web search, URL fetch, GitHub repository fetch, PDF extraction, and related web access tools.
- `pi-mcp-adapter` provides MCP server discovery and MCP tool call access.

When `pi-vc-core` is installed from npm or git, Pi runs npm install for package dependencies. For a local source checkout, run `/vc-doctor` or `vc_dependency_doctor` first; if the companion packages are missing, install dependencies only after explicit user approval.

The companion packages can also be installed directly in Pi:

```powershell
pi install npm:pi-web-access
pi install npm:pi-mcp-adapter
```

Third-party copyright and license information is recorded in [third-party-notices.md](third-party-notices.md).

## Recommended Windows Installs

Pi itself:

```powershell
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

File discovery/search helpers:

```powershell
winget install sharkdp.fd
winget install BurntSushi.ripgrep.MSVC
```

Windows shell and Git:

```powershell
winget install Microsoft.PowerShell
winget install Git.Git
```

Optional Office fallback:

```powershell
winget install TheDocumentFoundation.LibreOffice
```

Optional QMD recall provider:

```powershell
npm install -g @tobilu/qmd
```

Optional PaddleOCR provider:

```powershell
python -m pip install --upgrade pip
python -m pip install paddlepaddle paddleocr
```

Microsoft Word/PowerPoint COM support is provided by the desktop Microsoft Office apps. It cannot be reliably installed by this package; install Microsoft Office desktop apps manually if `.doc/.ppt` conversion through COM is required.

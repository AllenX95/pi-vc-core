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

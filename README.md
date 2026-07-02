# pi-vc-core

Windows-first local VC workspace, Office parsing, and Markdown memory package for Pi.

## Install

Install Pi first:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

Then install this package from a local checkout:

```bash
pi install .
```

Future GitHub install target:

```bash
pi install git:github.com/<user>/pi-vc-core@v0.1.0
```

## First Commands

```text
/vc-doctor
/vc-init
/vc-read BP.pptx
/vc-overview
/dream
```

`/vc-doctor` and the `vc_dependency_doctor` tool report missing required/recommended/optional dependencies, impact, and Windows install commands where safe.

Pi native `@file` selection is the preferred user entry point. Office and PDF files still need to be processed through the `vc-office-core` tools.

## Current P0 Status

This first implementation focuses on the base package shape and a usable local loop:

- compact `.pi-vc/` workspace;
- artifact registry;
- `.docx` and `.pptx` basic OpenXML text extraction;
- text PDF extraction through `pdf-parse`;
- `.md` and `.txt` text extraction;
- `.doc` and `.ppt` conversion provider detection with MS Office COM helper hooks;
- Markdown-first memory capture and basic recall;
- Dream proposal/commit skeleton with approval boundary.

OCR, visual QA, full Office layout fidelity, and deep PDF layout extraction are provider-based enhancements and degrade with clear warnings when unavailable.

## Verify

```bash
npm run check
npm run smoke
```

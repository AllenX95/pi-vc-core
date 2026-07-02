import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DependencyImportance = "required" | "recommended" | "optional";

export interface DependencyCheck {
  id: string;
  label: string;
  importance: DependencyImportance;
  ok: boolean;
  detail?: string;
  impact: string;
  install?: {
    windows?: string[];
    manual?: string;
  };
}

interface CommandSpec {
  id: string;
  label: string;
  command: string;
  args: string[];
  importance: DependencyImportance;
  impact: string;
  install?: DependencyCheck["install"];
}

const COMMAND_CHECKS: CommandSpec[] = [
  {
    id: "pi",
    label: "Pi Agent CLI",
    command: "pi",
    args: ["--version"],
    importance: "required",
    impact: "Required to run this package inside Pi.",
    install: {
      windows: ["npm install -g --ignore-scripts @earendil-works/pi-coding-agent"],
      manual: "Install Pi from https://pi.dev/.",
    },
  },
  {
    id: "node",
    label: "Node.js",
    command: "node",
    args: ["--version"],
    importance: "required",
    impact: "Required by Pi and pi-vc-core package dependencies.",
    install: {
      windows: ["winget install OpenJS.NodeJS"],
      manual: "Install Node.js from https://nodejs.org/.",
    },
  },
  {
    id: "npm",
    label: "npm",
    command: "npm",
    args: ["--version"],
    importance: "required",
    impact: "Required to install Pi, QMD, and package dependencies.",
    install: {
      windows: ["winget install OpenJS.NodeJS"],
      manual: "npm is included with Node.js.",
    },
  },
  {
    id: "git",
    label: "Git for Windows",
    command: "git",
    args: ["--version"],
    importance: "recommended",
    impact: "Recommended for installing GitHub Pi packages and providing bash on Windows.",
    install: {
      windows: ["winget install Git.Git"],
      manual: "Install Git for Windows from https://git-scm.com/download/win.",
    },
  },
  {
    id: "bash",
    label: "bash",
    command: "bash",
    args: ["--version"],
    importance: "recommended",
    impact: "Pi on Windows expects a bash-compatible shell for built-in shell tooling.",
    install: {
      windows: ["winget install Git.Git"],
      manual: "Git for Windows provides bash.exe.",
    },
  },
  {
    id: "fd",
    label: "fd",
    command: "fd",
    args: ["--version"],
    importance: "recommended",
    impact: "Pi uses fd for fast file discovery. Pi can auto-download it, but manual install avoids startup stalls.",
    install: {
      windows: ["winget install sharkdp.fd"],
      manual: "Pi can also auto-download fd into ~/.pi/agent/bin.",
    },
  },
  {
    id: "ripgrep",
    label: "ripgrep",
    command: "rg",
    args: ["--version"],
    importance: "recommended",
    impact: "Pi and agents use ripgrep for fast text search. Pi can auto-download it, but manual install avoids startup stalls.",
    install: {
      windows: ["winget install BurntSushi.ripgrep.MSVC"],
      manual: "Pi can also auto-download ripgrep into ~/.pi/agent/bin.",
    },
  },
  {
    id: "pwsh",
    label: "PowerShell 7",
    command: "pwsh",
    args: ["--version"],
    importance: "recommended",
    impact: "Recommended for Windows helper scripts and UTF-8 behavior.",
    install: {
      windows: ["winget install Microsoft.PowerShell"],
      manual: "Install PowerShell 7 from Microsoft.",
    },
  },
  {
    id: "python",
    label: "Python",
    command: "python",
    args: ["--version"],
    importance: "optional",
    impact: "Needed for OCR/PaddleOCR helpers and future PDF/OCR provider scripts.",
    install: {
      windows: ["winget install Python.Python.3.12"],
      manual: "Install Python from https://www.python.org/downloads/.",
    },
  },
  {
    id: "paddleocr",
    label: "PaddleOCR",
    command: "paddleocr",
    args: ["--help"],
    importance: "optional",
    impact: "Needed only for scanned PDF OCR. Text PDFs and Office parsing work without it.",
    install: {
      windows: [
        "python -m pip install --upgrade pip",
        "python -m pip install paddlepaddle paddleocr",
      ],
      manual: "Install PaddlePaddle/PaddleOCR according to your Python, CUDA, and CPU/GPU environment.",
    },
  },
  {
    id: "qmd",
    label: "QMD",
    command: "qmd",
    args: ["--help"],
    importance: "optional",
    impact: "Improves Markdown memory/document recall. Basic text search works without it.",
    install: {
      windows: ["npm install -g @tobilu/qmd"],
      manual: "QMD is intentionally external and can be installed separately with npm.",
    },
  },
  {
    id: "libreoffice",
    label: "LibreOffice",
    command: "soffice",
    args: ["--version"],
    importance: "optional",
    impact: "Fallback provider for legacy Office conversion and rendering when MS Office COM is unavailable.",
    install: {
      windows: ["winget install TheDocumentFoundation.LibreOffice"],
      manual: "Install LibreOffice from https://www.libreoffice.org/.",
    },
  },
];

export async function runDependencyDoctor(): Promise<DependencyCheck[]> {
  const commandChecks = await Promise.all(COMMAND_CHECKS.map(checkCommand));
  const pwsh = commandChecks.find((check) => check.id === "pwsh")?.ok ? "pwsh" : undefined;
  const powershell = pwsh ?? "powershell";
  const comChecks = await Promise.all([
    checkComProgId(powershell, "Word.Application", "ms-word-com", "Microsoft Word COM", "recommended", "Preferred local provider for .doc conversion and Word rendering."),
    checkComProgId(powershell, "PowerPoint.Application", "ms-powerpoint-com", "Microsoft PowerPoint COM", "recommended", "Preferred local provider for .ppt conversion and PowerPoint rendering."),
  ]);
  return [...commandChecks, ...comChecks];
}

export function formatDependencyDoctor(checks: DependencyCheck[]): string {
  const lines = ["pi-vc dependency doctor", ""];
  for (const importance of ["required", "recommended", "optional"] as const) {
    const group = checks.filter((check) => check.importance === importance);
    if (group.length === 0) continue;
    lines.push(`## ${importance}`);
    for (const check of group) {
      lines.push(`- ${check.label}: ${check.ok ? "ok" : "missing"}${check.detail ? ` (${check.detail})` : ""}`);
      if (!check.ok) {
        lines.push(`  impact: ${check.impact}`);
        const commands = check.install?.windows ?? [];
        if (commands.length > 0) lines.push(`  install: ${commands.join(" && ")}`);
        if (check.install?.manual) lines.push(`  note: ${check.install.manual}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

async function checkCommand(spec: CommandSpec): Promise<DependencyCheck> {
  try {
    const { stdout, stderr } = await runUserCommand(spec.command, spec.args);
    return {
      id: spec.id,
      label: spec.label,
      importance: spec.importance,
      ok: true,
      detail: firstLine(stdout || stderr),
      impact: spec.impact,
      install: spec.install,
    };
  } catch {
    const fallback = findFallbackTool(spec.id);
    return {
      id: spec.id,
      label: spec.label,
      importance: spec.importance,
      ok: false,
      detail: fallback ? `found at ${fallback}, but not available on PATH` : undefined,
      impact: spec.impact,
      install: fallback
        ? {
            ...spec.install,
            manual: `${fallback} exists, but the command is not on PATH. Add its directory to PATH or restart the shell after installation.`,
          }
        : spec.install,
    };
  }
}

async function runUserCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  if (process.platform !== "win32" || command === "pwsh" || command === "powershell") {
    return execFileAsync(command, args, { timeout: 5000 });
  }

  const shell = await rawCommandAvailable("pwsh") ? "pwsh" : "powershell";
  const commandLine = [command, ...args].map(quotePowerShellArg).join(" ");
  return execFileAsync(shell, ["-NoProfile", "-Command", commandLine], { timeout: 5000 });
}

async function checkComProgId(
  shellCommand: string,
  progId: string,
  id: string,
  label: string,
  importance: DependencyImportance,
  impact: string,
): Promise<DependencyCheck> {
  const command = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); if ([type]::GetTypeFromProgID('${progId}')) { '${progId} registered' } else { exit 1 }`;
  try {
    const { stdout, stderr } = await execFileAsync(shellCommand, ["-NoProfile", "-Command", command], { timeout: 8000 });
    return {
      id,
      label,
      importance,
      ok: true,
      detail: firstLine(stdout || stderr),
      impact,
      install: {
        manual: "Install Microsoft Office desktop apps. Microsoft Store/web-only Office is not enough for COM automation.",
      },
    };
  } catch {
    return {
      id,
      label,
      importance,
      ok: false,
      impact,
      install: {
        manual: "Install Microsoft Office desktop apps, or rely on LibreOffice fallback where supported.",
      },
    };
  }
}

async function rawCommandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["--version"], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function quotePowerShellArg(value: string): string {
  if (/^[A-Za-z0-9_.:/\\-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "''")}'`;
}

function findFallbackTool(id: string): string | undefined {
  const candidates: Record<string, string[]> = {
    bash: [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    ],
    fd: [
      path.join(homedir(), ".pi", "agent", "bin", "fd.exe"),
    ],
    ripgrep: [
      path.join(homedir(), ".pi", "agent", "bin", "rg.exe"),
    ],
  };
  return candidates[id]?.find((candidate) => existsSync(candidate));
}

function firstLine(value: string): string | undefined {
  return value.split(/\r?\n/).find(Boolean)?.slice(0, 120);
}

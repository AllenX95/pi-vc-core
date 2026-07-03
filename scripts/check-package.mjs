import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const requiredExtensions = [
  "./extensions/vc-project-workspace/index.ts",
  "./extensions/vc-office-core/index.ts",
  "./extensions/vc-memory/index.ts",
  "./node_modules/pi-web-access/index.ts",
  "./node_modules/pi-mcp-adapter/index.ts",
];

const requiredSkills = [
  "./skills",
  "./node_modules/pi-web-access/skills",
];

const bundledCompanionPackages = [
  "pi-web-access",
  "pi-mcp-adapter",
];

for (const extension of requiredExtensions) {
  if (!pkg.pi?.extensions?.includes(extension)) {
    throw new Error(`Missing Pi extension manifest entry: ${extension}`);
  }
}

for (const skillPath of requiredSkills) {
  if (!pkg.pi?.skills?.includes(skillPath)) {
    throw new Error(`Missing Pi skill manifest entry: ${skillPath}`);
  }
}

for (const packageName of bundledCompanionPackages) {
  if (!pkg.dependencies?.[packageName]) {
    throw new Error(`Missing bundled companion dependency: ${packageName}`);
  }
  if (!pkg.bundledDependencies?.includes(packageName)) {
    throw new Error(`Missing bundledDependencies entry: ${packageName}`);
  }
}

if (!pkg.keywords?.includes("pi-package")) {
  throw new Error("package.json must include the pi-package keyword");
}

console.log("pi-vc-core package manifest looks valid.");

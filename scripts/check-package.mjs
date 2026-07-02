import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const requiredExtensions = [
  "./extensions/vc-project-workspace/index.ts",
  "./extensions/vc-office-core/index.ts",
  "./extensions/vc-memory/index.ts",
];

for (const extension of requiredExtensions) {
  if (!pkg.pi?.extensions?.includes(extension)) {
    throw new Error(`Missing Pi extension manifest entry: ${extension}`);
  }
}

if (!pkg.keywords?.includes("pi-package")) {
  throw new Error("package.json must include the pi-package keyword");
}

console.log("pi-vc-core package manifest looks valid.");

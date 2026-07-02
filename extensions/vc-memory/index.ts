import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  captureMemory,
  documentRecall,
  dreamCommit,
  dreamPrepare,
  listShortTerm,
  memoryRecall,
  startupDreamCheck,
} from "./public.js";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "memory_capture",
    label: "VC Memory Capture",
    description: "Capture a strong user signal into Markdown memory.",
    parameters: Type.Object({
      text: Type.String(),
      category: Type.Optional(Type.String()),
      project: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      entities: Type.Optional(Type.Array(Type.String())),
      trigger: Type.Optional(Type.String()),
      target: Type.Optional(Type.Union([
        Type.Literal("short_term"),
        Type.Literal("project"),
        Type.Literal("long_term"),
      ])),
    }),
    async execute(_toolCallId, params) {
      const result = await captureMemory(params);
      if (result.warning) return textResult(`Memory not captured: ${result.warning}`, result);
      return textResult(`Captured memory: ${result.record?.path}`, result);
    },
  });

  pi.registerTool({
    name: "memory_recall",
    label: "VC Memory Recall",
    description: "Recall Markdown memory. Uses QMD when available and basic text search as fallback.",
    parameters: Type.Object({
      query: Type.String(),
      limit: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      const result = await memoryRecall(params.query, params.limit ?? 5);
      return textResult(formatRecall(result), result);
    },
  });

  pi.registerTool({
    name: "document_recall",
    label: "VC Document Recall",
    description: "Recall parsed project document Markdown views from .pi-vc/parsed.",
    parameters: Type.Object({
      query: Type.String(),
      limit: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      const result = await documentRecall(params.query, params.limit ?? 5);
      return textResult(formatRecall(result), result);
    },
  });

  pi.registerTool({
    name: "memory_list_short_term",
    label: "VC Memory List Short Term",
    description: "List short-term memory candidates waiting for Dream review.",
    parameters: Type.Object({}),
    async execute() {
      const candidates = await listShortTerm();
      return textResult(candidates.length ? candidates.join("\n") : "No short-term memory candidates.", { candidates });
    },
  });

  pi.registerTool({
    name: "memory_dream_prepare",
    label: "VC Dream Prepare",
    description: "Prepare a Dream proposal without changing long-term or project memory.",
    parameters: Type.Object({}),
    async execute() {
      const proposal = await dreamPrepare();
      return textResult(`Dream proposal ${proposal.id} prepared with ${proposal.candidate_count} candidates.`, proposal);
    },
  });

  pi.registerTool({
    name: "memory_dream_commit",
    label: "VC Dream Commit",
    description: "Commit the latest approved Dream proposal.",
    parameters: Type.Object({
      proposalId: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const result = await dreamCommit(params.proposalId);
      return textResult(`Dream committed. Report: ${result.reportPath}`, result);
    },
  });

  pi.registerTool({
    name: "memory_startup_check",
    label: "VC Memory Startup Check",
    description: "Check whether Dream should be suggested based on last_dream_at.",
    parameters: Type.Object({
      intervalDays: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      const result = await startupDreamCheck(params.intervalDays ?? 7);
      return textResult(result.shouldRemind ? "Dream reminder is due." : "Dream reminder is not due.", result);
    },
  });

  pi.registerCommand("dream", {
    description: "Prepare a Dream proposal. Commit requires explicit memory_dream_commit.",
    handler: async (_args, ctx) => {
      const proposal = await dreamPrepare();
      ctx.ui.notify(
        `Dream proposal ${proposal.id} prepared with ${proposal.candidate_count} candidates. Use memory_dream_commit only after approval.`,
        proposal.warnings.length ? "warning" : "info",
      );
    },
  });
}

function textResult(text: string, details: unknown) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function formatRecall(result: Awaited<ReturnType<typeof memoryRecall>>): string {
  const lines = [
    `Provider: ${result.provider}`,
    result.warnings.length ? `Warnings: ${result.warnings.join("; ")}` : "Warnings: none",
    "",
  ];
  if (result.results.length === 0) {
    lines.push("No recall results.");
  } else {
    lines.push(...result.results.map((item) => `${item.path}\n${item.snippet}`));
  }
  return lines.join("\n");
}

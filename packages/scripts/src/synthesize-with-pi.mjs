import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const stdin = await readStdin();
if (!stdin.trim()) {
  throw new Error("No synthesis input received on stdin.");
}

const synthesis = JSON.parse(stdin);
const { file, title, linkId, prompt, entries = [], currentCheckpoint } = synthesis;

const provider = "openai";
const modelName = "gpt-5-mini";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY env var for pi agent.");
}

const systemPrompt = [
  "You are a synthesis engine for Thalo.",
  "Generate clear, well-structured Markdown.",
  "Do not include triple-backtick code fences.",
  "Start the output with a single H1 heading matching the synthesis title.",
  "Update the current synthesis entry in-place based on the existing file content.",
  "Do not replace unrelated content outside the synthesis entry.",
].join(" ");

const entriesBlock = entries.length
  ? entries
      .map((entry) => {
        return [
          `Entry: ${entry.title ?? "(untitled)"}`,
          `Type: ${entry.entity ?? "unknown"}`,
          entry.linkId ? `Link: ^${entry.linkId}` : null,
          entry.tags?.length ? `Tags: ${entry.tags.join(", ")}` : null,
          entry.rawText?.trim() ? `Raw:\n${entry.rawText.trim()}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n---\n\n")
  : "No source entries were provided.";

const absoluteFilePath = path.resolve(process.cwd(), file);
const original = await readFile(absoluteFilePath, "utf-8");

console.log("[synthesize-with-pi] Starting synthesis", {
  file: absoluteFilePath,
  title,
  linkId,
  checkpoint: currentCheckpoint,
  entryCount: entries.length,
});
if (entries.length) {
  console.log(
    "[synthesize-with-pi] Entries considered",
    entries.map((entry) => ({
      title: entry.title ?? "(untitled)",
      entity: entry.entity ?? "unknown",
      linkId: entry.linkId ?? null,
      tags: entry.tags ?? [],
    })),
  );
} else {
  console.log("[synthesize-with-pi] No entries provided.");
}

const userPrompt = [
  `Synthesis Title: ${title}`,
  "",
  "Prompt:",
  prompt?.trim() ?? "(no prompt provided)",
  "",
  "Source Entries:",
  entriesBlock,
  "",
  "Current File Content:",
  original.trim() || "(file is empty)",
].join("\n");

const agent = new Agent({
  initialState: {
    systemPrompt,
    model: getModel(provider, modelName),
  },
});

let output = "";
agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    output += event.assistantMessageEvent.delta;
  }
});

console.log("[synthesize-with-pi] Sending prompt to agent.");
await agent.prompt(userPrompt);
console.log("[synthesize-with-pi] Agent response received.", {
  outputLength: output.length,
});

const trimmedOutput = output.trim();
if (!trimmedOutput) {
  throw new Error("Pi agent returned empty output.");
}

console.log("[synthesize-with-pi] Updating synthesis file.");
const updated = updateSynthesisFile(original, {
  linkId,
  checkpoint: currentCheckpoint,
  markdown: trimmedOutput,
});

await writeFile(absoluteFilePath, updated);
console.log("[synthesize-with-pi] Synthesis file updated.");

function updateSynthesisFile(source, { linkId: targetLinkId, checkpoint, markdown }) {
  const fenceStart = source.indexOf("```thalo");
  if (fenceStart === -1) {
    throw new Error("No ```thalo block found in synthesis file.");
  }

  const fenceEnd = source.indexOf("```", fenceStart + 1);
  if (fenceEnd === -1) {
    throw new Error("Unterminated ```thalo block in synthesis file.");
  }

  if (!targetLinkId) {
    throw new Error("Missing synthesis linkId.");
  }

  if (!checkpoint) {
    throw new Error("Missing current checkpoint for synthesis.");
  }

  const block = source.slice(fenceStart, fenceEnd);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const actualizeEntry = [
    "",
    `${timestamp} actualize-synthesis ^${targetLinkId}`,
    `  checkpoint: "${checkpoint}"`,
    "",
  ].join("\n");

  const blockWithActualize = block + actualizeEntry;
  const before = source.slice(0, fenceStart);
  const closingFence = source.slice(
    fenceEnd,
    source.indexOf("\n", fenceEnd) === -1 ? source.length : source.indexOf("\n", fenceEnd),
  );

  return `${before}${blockWithActualize}${closingFence}\n\n${markdown}\n`;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

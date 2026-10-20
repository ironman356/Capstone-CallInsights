import type { CallCard, CallDetail } from "./types";

export function phraseContext(call: CallDetail, phrase: string, speaker: string) {
  const tokens = phrase.match(/[a-z]+(?:['’][a-z]+)?/gi) ?? [];
  if (!tokens.length) return null;
  const pattern = new RegExp(`\\b${tokens.map((token) => token.replace(/['’]/g, "['’]")).join("[^a-z]+")}\\b`, "i");
  const lines = call.turns.map((turn) => `${turn.speaker}: ${turn.text}`);
  let offset = 0;
  for (const [index, turn] of call.turns.entries()) {
    const match = turn.speaker.toLowerCase() === speaker.toLowerCase() ? pattern.exec(turn.text) : null;
    if (match) {
      const transcript = lines.join("\n");
      const start = offset + turn.speaker.length + 2 + match.index;
      const end = start + match[0].length;
      return {
        before: `${start > 160 ? "…" : ""}${transcript.slice(Math.max(0, start - 160), start)}`,
        match: transcript.slice(start, end),
        after: `${transcript.slice(end, end + 160)}${end + 160 < transcript.length ? "…" : ""}`,
      };
    }
    offset += lines[index].length + 1;
  }
  return null;
}

export function formatValue(value: number | string): string {
  if (typeof value !== "number") {
    return value;
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(3);
}

export function compareCallRecency(left: CallCard, right: CallCard) {
  const leftDate = Date.parse(left.timestamp_start ?? left.timestamp_end ?? "");
  const rightDate = Date.parse(right.timestamp_start ?? right.timestamp_end ?? "");
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) return leftDate - rightDate;
  if (!Number.isNaN(leftDate)) return -1;
  if (!Number.isNaN(rightDate)) return 1;
  const leftSequence = Number(left.call_id.match(/\d+$/)?.[0] ?? 0);
  const rightSequence = Number(right.call_id.match(/\d+$/)?.[0] ?? 0);
  return leftSequence - rightSequence || left.call_id.localeCompare(right.call_id);
}

export function titleCase(value: string): string {
  return value
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

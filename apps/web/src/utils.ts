import type { CallCard } from "./types";

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

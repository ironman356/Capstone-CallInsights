import type { CallCard } from "./types";

const ALIASES: Record<string, string> = {
  "showed empathy": "used empathy",
  "set explicit next steps": "offered next steps",
  "transferred or escalated": "transferred / escalated",
};

export const canonicalApproach = (label: string) => ALIASES[label] ?? label;
export const callApproaches = (call: CallCard) => [...new Set(call.behaviors.map(canonicalApproach))];
export const usesApproach = (call: CallCard, approach: string) => callApproaches(call).includes(canonicalApproach(approach));

export function relativeIssueMix(share: number | null, baseline: number | null, isBaseline: boolean) {
  if (share === null || baseline === null) return { width: null, ratio: null };
  const ratio = baseline > 0 ? share / baseline : null;
  return { width: isBaseline ? 50 : ratio === null ? null : Math.min(100, ratio * 50), ratio };
}

export function compareCohorts(calls: CallCard[], approaches: string[], excludeShared: boolean) {
  const selected = approaches.map(canonicalApproach);
  const matches = calls.map((call) => {
    const labels = callApproaches(call);
    return { call, approaches: selected.filter((approach) => labels.includes(approach)) };
  });
  return {
    shared: matches.filter((item) => item.approaches.length > 1).map((item) => item.call),
    groups: selected.map((approach) => matches.filter((item) => item.approaches.includes(approach)
      && (!excludeShared || item.approaches.length === 1)).map((item) => item.call)),
  };
}

function average(values: Array<number | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return { value: valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null, count: valid.length };
}

export function summarizeApproach(calls: CallCard[]) {
  const count = calls.length;
  const resolved = calls.filter((call) => call.outcome === "resolved").length;
  const proportion = count ? resolved / count : 0;
  // Wilson interval remains meaningful for tiny samples and 0% / 100% outcomes.
  const z2 = 1.96 ** 2;
  const center = count ? (proportion + z2 / (2 * count)) / (1 + z2 / count) : 0;
  const margin = count ? 1.96 * Math.sqrt(proportion * (1 - proportion) / count + z2 / (4 * count ** 2)) / (1 + z2 / count) : 0;
  const outcomes = Object.fromEntries([...new Set(calls.map((call) => call.outcome))]
    .map((outcome) => [outcome, calls.filter((call) => call.outcome === outcome).length]));
  return {
    count, resolved, outcomes,
    resolution: count ? proportion * 100 : null,
    interval: count ? [Math.max(0, center - margin) * 100, Math.min(1, center + margin) * 100] : null,
    sentiment: average(calls.map((call) => call.sentiments.shift)),
    turns: average(calls.map((call) => call.turn_count)),
    friction: count ? calls.filter((call) => callApproaches(call).some((label) => ["placed on hold", "transferred / escalated"].includes(label))).length / count * 100 : null,
    escalation: count ? (outcomes.escalated ?? 0) / count * 100 : null,
  };
}

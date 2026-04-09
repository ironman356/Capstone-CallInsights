export function formatValue(value: number | string): string {
  if (typeof value !== "number") {
    return value;
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(3);
}

export function titleCase(value: string): string {
  return value
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

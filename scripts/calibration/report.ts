/**
 * The harness's output format, kept in one place so every measurement
 * prints the same way.
 *
 * The one requirement the format has to meet is that two runs **diff**.
 * ADR-0024 dropped the CSV export on the grounds that "a reproducible
 * command producing diffable text is a strictly better artefact than a file
 * a human remembered to click for", and a report whose columns shift width
 * with the numbers in them would give that back: every line would change
 * when one number did. So values are formatted to a fixed number of
 * significant figures and labels are padded to a fixed width, and a diff
 * between two sweeps shows the values that moved and nothing else.
 */

/** Wide enough for the longest label the report uses, and fixed rather than
 * measured from the rows, so adding a row never reflows the ones above it. */
const LABEL_WIDTH = 42;

const lines: string[] = [];

export function heading(text: string): void {
  lines.push("", text, "─".repeat(text.length));
}

export function note(text: string): void {
  lines.push(text);
}

export function row(label: string, value: string): void {
  lines.push(`  ${label.padEnd(LABEL_WIDTH, " ")}${value}`);
}

/**
 * A fixed-width table. Column widths come from the headers and the cells
 * together, so a column is exactly as wide as it needs to be and stays that
 * width for every row — the same anti-reflow reason `LABEL_WIDTH` is a
 * constant.
 */
export function table(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): void {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((cells) => cells[column].length)),
  );
  const render = (cells: readonly string[]): string =>
    `  ${cells.map((cell, column) => cell.padStart(widths[column], " ")).join("  ")}`;

  lines.push(render(headers));
  lines.push(`  ${widths.map((width) => "─".repeat(width)).join("  ")}`);
  for (const cells of rows) {
    lines.push(render(cells));
  }
}

/** Everything written so far, as one string. The harness prints once at the
 * end rather than as it goes, so a run that throws half way through prints
 * nothing rather than half a report that looks whole. */
export function rendered(): string {
  return `${lines.join("\n")}\n`;
}

/**
 * Four significant figures, which is more than any of these measurements
 * deserves and few enough that floating-point noise in the last digits
 * never shows up as a diff.
 */
export function num(value: number, digits = 4): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (value !== 0 && (Math.abs(value) < 1e-3 || Math.abs(value) >= 1e6)) {
    return value.toExponential(digits - 1);
  }

  return value.toPrecision(digits);
}

export function percent(fraction: number): string {
  return `${(100 * fraction).toFixed(1)}%`;
}

export function integer(value: number): string {
  return value.toLocaleString("en-US");
}

/** Mean and σ of a sample, the pair every repeated measurement here reports
 * — a single number from five seeds hides whether the seeds agreed. */
export function meanAndSigma(values: readonly number[]): {
  readonly mean: number;
  readonly sigma: number;
} {
  if (values.length === 0) {
    return {mean: Number.NaN, sigma: Number.NaN};
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return {mean, sigma: Math.sqrt(variance)};
}

export function meanSigma(values: readonly number[]): string {
  const {mean, sigma} = meanAndSigma(values);

  return `${num(mean)} ± ${num(sigma, 2)}`;
}

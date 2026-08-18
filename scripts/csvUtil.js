/**
 * Minimal CSV serializer — good enough for writing back the same shape of
 * data we read in with csv-parse. Quotes any field containing a comma,
 * quote, or newline, per standard CSV escaping (doubled quotes inside).
 */
export function toCsv(rows, columns) {
  const escapeCell = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [columns.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCell(row[col])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

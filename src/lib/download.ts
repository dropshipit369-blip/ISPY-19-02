type CsvCell = string | number | boolean | null | undefined;

const escapeCsvCell = (value: CsvCell) => {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const serializeCsv = (rows: CsvCell[][]) =>
  rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");

export async function deliverTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8;",
) {
  const file = new File([content], filename, { type: mimeType });
  const canShareFile =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFile) {
    await navigator.share({ files: [file], title: filename });
    return "shared" as const;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return "downloaded" as const;
}

export async function downloadCsvFile(filename: string, rows: CsvCell[][]) {
  return deliverTextFile(filename, serializeCsv(rows), "text/csv;charset=utf-8;");
}

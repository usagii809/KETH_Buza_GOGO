/** 엑셀에서 한글이 깨지지 않는 CSV 파일로 저장 */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => (typeof v === "number" ? String(v) : `"${String(v).replace(/"/g, '""')}"`);
  const csv = "﻿" + [header.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

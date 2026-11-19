import * as XLSX from "xlsx";
import { TRAY_HEADERS, roundMoney, type TrayLine } from "@/lib/tray";

/**
 * Gera uma planilha .xlsx com o mesmo cabeçalho e a mesma ordem de colunas
 * do modelo Tray (app/csv-template/modelo.xlsx).
 */
export function buildTrayXlsx(lines: TrayLine[]): Buffer {
  const data: (string | number)[][] = [
    [...TRAY_HEADERS],
    ...lines.map((line) => [
      line.codigo,
      line.referencia,
      line.nome,
      "",
      "",
      "",
      roundMoney(line.precoSugerido),
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [
    { wch: 24 },
    { wch: 32 },
    { wch: 58 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];

  for (let row = 1; row <= lines.length; row++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 6 })];
    if (cell) {
      cell.t = "n";
      cell.z = "#,##0.00";
    }
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Worksheet");

  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

import { exportFileName, loadSelection, textError } from "@/lib/tray-export";
import { buildTrayXlsx } from "@/lib/tray-xlsx";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const selection = await loadSelection(req);
  if (!selection.ok) {
    return textError(selection.message, selection.status);
  }

  const file = buildTrayXlsx(selection.lines);
  const body = new Uint8Array(file);

  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFileName("xlsx")}"`,
      "Cache-Control": "no-store",
      "X-Selected": String(selection.rows.length),
      "X-Exported": String(selection.lines.length),
    },
  });
}

import { buildTrayCsv } from "@/lib/tray";
import { exportFileName, loadSelection, textError } from "@/lib/tray-export";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const selection = await loadSelection(req);
  if (!selection.ok) {
    return textError(selection.message, selection.status);
  }

  const csv = buildTrayCsv(selection.lines);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName("csv")}"`,
      "Cache-Control": "no-store",
      "X-Selected": String(selection.rows.length),
      "X-Exported": String(selection.lines.length),
    },
  });
}

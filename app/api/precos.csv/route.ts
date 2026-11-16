import { getPrecos } from "@/lib/merchant";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").toLowerCase();
  const marca = sp.get("marca") ?? "";
  const filtro = sp.get("filtro") ?? "todos";
  const ordem = sp.get("ordem") ?? "menor";

  let rows;
  try {
    rows = await getPrecos();
  } catch (e: any) {
    return new Response(e?.message ?? "erro", { status: 500 });
  }

  rows = rows
    .filter((r) => {
      if (q && !`${r.titulo} ${r.id}`.toLowerCase().includes(q)) return false;
      if (marca && r.marca !== marca) return false;
      if (filtro === "baratos" && !(r.diferencaPct != null && r.diferencaPct < 0)) return false;
      if (filtro === "caros" && !(r.diferencaPct != null && r.diferencaPct > 0)) return false;
      return true;
    })
    .sort((a, b) => {
      const da = a.diferencaPct ?? Infinity * (ordem === "menor" ? 1 : -1);
      const db = b.diferencaPct ?? Infinity * (ordem === "menor" ? 1 : -1);
      return ordem === "menor" ? da - db : db - da;
    });

  const header = ["Id", "Titulo", "Marca", "Pais", "Seu_Preco", "Referencia", "Diferenca_Pct"];
  const lines = rows.map((r) =>
    [r.id, r.titulo, r.marca, r.pais, r.preco ?? "", r.referencia ?? "", r.diferencaPct ?? ""]
      .map(esc)
      .join(";")
  );
  // BOM para o Excel abrir acentos corretamente; separador ; para o Excel em pt-BR.
  const body = "﻿" + [header.map(esc).join(";"), ...lines].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="precos_competitivos.csv"',
    },
  });
}

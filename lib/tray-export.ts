import { getPrecos, type Row } from "@/lib/merchant";
import { buildTrayLines, clampDiscount, type TrayLine } from "@/lib/tray";

type SelectionResult =
  | {
      ok: true;
      rows: Row[];
      lines: TrayLine[];
      descontoPct: number;
      naoAumentar: boolean;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

/**
 * Lê o corpo { ids, descontoPct, naoAumentar } e busca os produtos
 * selecionados no cache do Merchant. O CSV/XLSX é sempre gerado no servidor
 * para não confiar em preços enviados pelo navegador.
 */
export async function loadSelection(req: Request): Promise<SelectionResult> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, status: 400, message: "Corpo da requisição inválido." };
  }

  const data = body as { ids?: unknown; descontoPct?: unknown; naoAumentar?: unknown };
  const ids = Array.isArray(data.ids)
    ? Array.from(new Set(data.ids.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];

  if (ids.length === 0) {
    return { ok: false, status: 400, message: "Selecione ao menos um produto." };
  }
  if (ids.length > 5000) {
    return { ok: false, status: 400, message: "Selecione no máximo 5000 produtos por exportação." };
  }

  const descontoPct = clampDiscount(Number(data.descontoPct ?? 0));
  if (!Number.isFinite(Number(data.descontoPct ?? 0))) {
    return { ok: false, status: 400, message: "Percentual de desconto inválido." };
  }
  const naoAumentar = data.naoAumentar === true;

  let rows: Row[];
  try {
    rows = await getPrecos();
  } catch (error: any) {
    return {
      ok: false,
      status: 500,
      message: error?.response?.data?.error?.message || error?.message || "Falha ao buscar os dados do Merchant.",
    };
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const selected = ids.map((id) => byId.get(id)).filter((row): row is Row => Boolean(row));

  if (selected.length === 0) {
    return {
      ok: false,
      status: 409,
      message: "Os produtos selecionados não estão mais disponíveis. Atualize os dados e tente novamente.",
    };
  }
  if (selected.length !== ids.length) {
    return {
      ok: false,
      status: 409,
      message: "Alguns produtos selecionados não estão mais disponíveis. Atualize os dados e tente novamente.",
    };
  }

  const lines = buildTrayLines(selected, descontoPct, { naoAumentar });
  if (lines.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Não foi possível identificar o código Tray dos produtos selecionados.",
    };
  }

  return { ok: true, rows: selected, lines, descontoPct, naoAumentar };
}

export function exportFileName(extension: "csv" | "xlsx") {
  const date = new Date().toISOString().slice(0, 10);
  return `modelo-tray-${date}.${extension}`;
}

export function textError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

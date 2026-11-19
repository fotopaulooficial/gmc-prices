import type { Row } from "@/lib/merchant";

/**
 * Cabeçalho do modelo de importação da Tray.
 * Fonte: app/csv-template/modelo.xlsx (aba "Worksheet", linha 1).
 */
export const TRAY_HEADERS = [
  "Código do produto (ID)",
  "Referência (código fornecedor)",
  "Nome do produto",
  "Data final promoção",
  "Data inicial promoção",
  "Preço com promoção",
  "Preço de venda em reais",
] as const;

export type TrayLine = {
  /** ID numérico do produto na Tray. */
  codigo: string;
  /** Código do fornecedor. O relatório do Google não traz esse dado. */
  referencia: string;
  nome: string;
  /** Preço atual na loja (para conferência na aprovação). */
  precoAtual: number;
  /** Preço que será gravado na coluna "Preço de venda em reais". */
  precoSugerido: number;
  /** Quantidade de ofertas do Google agrupadas nesta linha. */
  itens: number;
  /** true quando o ID do Google é de uma variação (ex.: pt~BR~667-365). */
  variacao: boolean;
  /** Data inicial da promoção (opcional). */
  dataInicioPromocao: string | null;
  /** Data final da promoção (opcional). */
  dataFimPromocao: string | null;
  /** Preço com promoção (opcional). Quando definido, substitui o preço sugerido na coluna "Preço com promoção". */
  precoPromocao: number | null;
};

export const clampDiscount = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(99, Math.max(0, Math.round(value * 100) / 100));
};

/** Arredonda para centavos, como a Tray espera. */
export const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Preço sugerido = referência menos o desconto informado. */
export const suggestedPrice = (reference: number, discountPct: number) =>
  roundMoney(reference * (1 - clampDiscount(discountPct) / 100));

/**
 * O ID do Google Merchant vem como "pt~BR~101" ou "pt~BR~667-365".
 * A Tray usa apenas o ID numérico do produto (101 / 667).
 */
export const offerIdToTrayId = (offerId: string): string => {
  const last = offerId.split("~").pop()?.trim() ?? "";
  const match = last.match(/^(\d+)(?:-\d+)?$/);
  return match?.[1] ?? "";
};

/** Verifica se o ID é de uma oferta de variação. */
export const isVariationOffer = (offerId: string): boolean => {
  const last = offerId.split("~").pop()?.trim() ?? "";
  return /^\d+-\d+$/.test(last);
};

/** Remove o sufixo de variação para não renomear o produto pai. */
const productTitle = (row: Row) => {
  if (!isVariationOffer(row.id)) return row.titulo;
  const index = row.titulo.lastIndexOf(" - ");
  return index > 0 ? row.titulo.slice(0, index).trim() : row.titulo;
};

/** Maior prefixo comum, usado quando mais de uma variação cai no mesmo produto. */
const commonTitle = (titles: string[]) => {
  if (titles.length === 1) return titles[0];
  let prefix = titles[0] ?? "";
  for (const title of titles.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < title.length && prefix[i] === title[i]) i++;
    prefix = prefix.slice(0, i);
  }
  const trimmed = prefix.replace(/[\s\-–—,;:/|]+$/u, "").trim();
  return trimmed.length >= 3 ? trimmed : titles[0] ?? "";
};

/**
 * Monta as linhas do modelo Tray a partir das ofertas do Merchant.
 * Variações do mesmo produto são agrupadas em uma única linha, usando o
 * menor preço sugerido do grupo (o preço da Tray acompanha a variação mais barata).
 */
export function buildTrayLines(
  rows: Row[],
  discountPct: number,
  options: { naoAumentar?: boolean; dataInicioPromocao?: string; dataFimPromocao?: string; precoPromocao?: number } = {}
): TrayLine[] {
  const pct = clampDiscount(discountPct);
  const groups = new Map<
    string,
    {
      titles: string[];
      precoAtual: number;
      precoSugerido: number;
      itens: number;
      variacao: boolean;
    }
  >();

  for (const row of rows) {
    const codigo = offerIdToTrayId(row.id);
    if (!codigo) continue;

    const precoAtual = row.preco ?? 0;
    const calculado =
      row.referencia != null && row.referencia > 0
        ? suggestedPrice(row.referencia, pct)
        : precoAtual;
    // Proteção opcional: nunca sobe o preço de quem já está abaixo do sugerido.
    const precoSugerido =
      options.naoAumentar && row.preco != null ? Math.min(precoAtual, calculado) : calculado;
    const title = productTitle(row);
    const variacao = isVariationOffer(row.id);
    const current = groups.get(codigo);

    if (current) {
      current.titles.push(title);
      current.precoAtual = Math.min(current.precoAtual, precoAtual);
      current.precoSugerido = Math.min(current.precoSugerido, precoSugerido);
      current.itens += 1;
      current.variacao = true;
    } else {
      groups.set(codigo, {
        titles: [title],
        precoAtual,
        precoSugerido,
        itens: 1,
        variacao,
      });
    }
  }

  const result = Array.from(groups.entries()).map(([codigo, group]) => {
    const precoPromocao = options.precoPromocao ?? null;
    const dataInicio = options.dataInicioPromocao ?? null;
    const dataFim = options.dataFimPromocao ?? null;

    return {
      codigo,
      referencia: "",
      nome: commonTitle(group.titles),
      precoAtual: roundMoney(group.precoAtual),
      precoSugerido: roundMoney(group.precoSugerido),
      itens: group.itens,
      variacao: group.variacao,
      dataInicioPromocao: dataInicio,
      dataFimPromocao: dataFim,
      precoPromocao,
    };
  });

  return result;
};

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Preço no formato do Excel em português: 1234,56 */
export const formatPricePtBr = (value: number) =>
  roundMoney(value).toFixed(2).replace(".", ",");

/**
 * Gera o CSV com exatamente as 7 colunas do modelo Tray.
 * Separador ";" e BOM UTF-8 para o Excel em português abrir os acentos.
 * Quando line.dataInicioPromocao estiver preenchido (exportação com promoção),
 * a coluna "Preço de venda em reais" usa o preço atual (line.precoAtual), mantendo-o
 * intacto. Caso contrário, mantém o comportamento anterior usando precoSugerido.
 */
export function buildTrayCsv(lines: TrayLine[]): string {
  const header = TRAY_HEADERS.map(csvEscape).join(";");
  const body = lines.map((line) => {
    // Quando houver dados de promoção (dataInicioPromocao preenchido), usa o
    // preço atual para manter a coluna "Preço de venda em reais" intacto.
    const isPromocao = line.dataInicioPromocao != null;
    const precoVenda = isPromocao ? formatPricePtBr(line.precoAtual) : formatPricePtBr(line.precoSugerido);
    const precoPromocao = line.precoPromocao != null
      ? formatPricePtBr(line.precoPromocao)
      : formatPricePtBr(line.precoSugerido);
    return [
      line.codigo,
      line.referencia,
      line.nome,
      line.dataFimPromocao ?? "",
      line.dataInicioPromocao ?? "",
      precoPromocao,
      precoVenda,
    ]
      .map(csvEscape)
      .join(";");
  });

  return "\uFEFF" + [header, ...body].join("\r\n") + "\r\n";
}
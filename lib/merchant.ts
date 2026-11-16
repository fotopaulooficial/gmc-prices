import { GoogleAuth } from "google-auth-library";

export type Row = {
  id: string;
  titulo: string;
  marca: string;
  pais: string;
  moeda: string;
  preco: number | null;
  referencia: number | null;
  diferencaPct: number | null;
};

const SCOPE = "https://www.googleapis.com/auth/content";
const QUERY =
  "SELECT id, title, brand, price, report_country_code, benchmark_price FROM price_competitiveness_product_view";

let auth: GoogleAuth | null = null;

function getAuth() {
  if (auth) return auth;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  auth = new GoogleAuth({
    scopes: [SCOPE],
    ...(json ? { credentials: JSON.parse(json) } : {}),
  });
  return auth;
}

const micros = (m?: { amountMicros?: string | number }) =>
  m?.amountMicros != null ? Number(m.amountMicros) / 1e6 : null;

// Cache simples em memória (10 min) para não gastar cota a cada acesso.
let cache: { at: number; rows: Row[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function getPrecos(force = false): Promise<Row[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;

  const merchantId = process.env.MERCHANT_ID;
  if (!merchantId) throw new Error("Defina MERCHANT_ID no .env.local");

  const client = await getAuth().getClient();
  const url = `https://merchantapi.googleapis.com/reports/v1/accounts/${merchantId}/reports:search`;

  const rows: Row[] = [];
  let pageToken: string | undefined;

  do {
    const res = await client.request<{
      results?: { priceCompetitivenessProductView?: any }[];
      nextPageToken?: string;
    }>({
      url,
      method: "POST",
      data: { query: QUERY, pageSize: 1000, ...(pageToken ? { pageToken } : {}) },
    });

    for (const r of res.data.results ?? []) {
      const v = r.priceCompetitivenessProductView;
      if (!v) continue;
      const preco = micros(v.price);
      const referencia = micros(v.benchmarkPrice);
      rows.push({
        id: String(v.id ?? ""),
        titulo: String(v.title ?? ""),
        marca: String(v.brand ?? ""),
        pais: String(v.reportCountryCode ?? ""),
        moeda: String(v.price?.currencyCode ?? "BRL"),
        preco,
        referencia,
        diferencaPct:
          preco != null && referencia
            ? Math.round(((preco - referencia) / referencia) * 1000) / 10
            : null,
      });
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  cache = { at: Date.now(), rows };
  return rows;
}

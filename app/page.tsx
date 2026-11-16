import { getPrecos, type Row } from "@/lib/merchant";

export const dynamic = "force-dynamic";

type SP = { q?: string; marca?: string; ordem?: string; filtro?: string; atualizar?: string };

const brl = (n: number | null, moeda = "BRL") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(n);

const cell = { padding: "10px 12px", borderBottom: "1px solid #e6e8eb" } as const;

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const marca = sp.marca ?? "";
  const ordem = sp.ordem ?? "menor";
  const filtro = sp.filtro ?? "todos";

  let todos: Row[] = [];
  let erro = "";
  try {
    todos = await getPrecos(sp.atualizar === "1");
  } catch (e: any) {
    erro = e?.response?.data?.error?.message || e?.message || String(e);
  }

  const marcas = Array.from(new Set(todos.map((r) => r.marca).filter(Boolean))).sort();

  let rows = todos.filter((r) => {
    if (q && !`${r.titulo} ${r.id}`.toLowerCase().includes(q)) return false;
    if (marca && r.marca !== marca) return false;
    if (filtro === "baratos" && !(r.diferencaPct != null && r.diferencaPct < 0)) return false;
    if (filtro === "caros" && !(r.diferencaPct != null && r.diferencaPct > 0)) return false;
    return true;
  });

  rows = rows.sort((a, b) => {
    const da = a.diferencaPct ?? Infinity * (ordem === "menor" ? 1 : -1);
    const db = b.diferencaPct ?? Infinity * (ordem === "menor" ? 1 : -1);
    return ordem === "menor" ? da - db : db - da;
  });

  const comRef = todos.filter((r) => r.diferencaPct != null);
  const baratos = comRef.filter((r) => (r.diferencaPct as number) < 0).length;
  const caros = comRef.filter((r) => (r.diferencaPct as number) > 0).length;

  const csvParams = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(marca ? { marca } : {}),
    ordem,
    filtro,
  }).toString();

  const input = {
    padding: "8px 10px",
    border: "1px solid #c9cdd2",
    borderRadius: 6,
    fontSize: 14,
    background: "#fff",
  } as const;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 24 }}>Preços x Mercado</h1>
      <p style={{ margin: "0 0 20px", color: "#5b636b" }}>
        Seu preço comparado ao preço de referência do Google Merchant Center. Diferença
        negativa = você está mais barato que a referência.
      </p>

      {erro ? (
        <div
          style={{
            background: "#fdecea",
            border: "1px solid #f5c2c0",
            padding: 16,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          <strong>Não foi possível buscar os dados.</strong>
          {"\n"}
          {erro}
        </div>
      ) : (
        <>
          <section style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {[
              ["Produtos com referência", comRef.length],
              ["Mais baratos que o mercado", baratos],
              ["Mais caros que o mercado", caros],
            ].map(([label, n]) => (
              <div
                key={String(label)}
                style={{
                  background: "#fff",
                  border: "1px solid #e6e8eb",
                  borderRadius: 8,
                  padding: "12px 16px",
                  minWidth: 190,
                }}
              >
                <div style={{ fontSize: 12, color: "#5b636b" }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 600 }}>{n}</div>
              </div>
            ))}
          </section>

          <form
            method="get"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
          >
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Buscar por título ou ID"
              style={{ ...input, minWidth: 240 }}
            />
            <select name="marca" defaultValue={marca} style={input}>
              <option value="">Todas as marcas</option>
              {marcas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select name="filtro" defaultValue={filtro} style={input}>
              <option value="todos">Todos</option>
              <option value="baratos">Só mais baratos que o mercado</option>
              <option value="caros">Só mais caros que o mercado</option>
            </select>
            <select name="ordem" defaultValue={ordem} style={input}>
              <option value="menor">Mais barato primeiro</option>
              <option value="maior">Mais caro primeiro</option>
            </select>
            <button
              type="submit"
              style={{ ...input, background: "#1a73e8", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Filtrar
            </button>
            <a href="/?atualizar=1" style={{ ...input, textDecoration: "none", color: "#1b1f23" }}>
              Atualizar dados
            </a>
            <a
              href={`/api/precos.csv?${csvParams}`}
              style={{ ...input, textDecoration: "none", color: "#1b1f23" }}
            >
              Baixar CSV
            </a>
          </form>

          <div
            style={{
              background: "#fff",
              border: "1px solid #e6e8eb",
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f0f2f4", textAlign: "left" }}>
                  <th style={cell}>Produto</th>
                  <th style={cell}>Marca</th>
                  <th style={{ ...cell, textAlign: "right" }}>Seu preço</th>
                  <th style={{ ...cell, textAlign: "right" }}>Referência</th>
                  <th style={{ ...cell, textAlign: "right" }}>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const d = r.diferencaPct;
                  const cor = d == null ? "#5b636b" : d < 0 ? "#137333" : d > 0 ? "#b3261e" : "#5b636b";
                  return (
                    <tr key={`${r.id}-${r.pais}-${i}`}>
                      <td style={cell}>
                        {r.titulo}
                        <div style={{ fontSize: 12, color: "#8a9199" }}>{r.id}</div>
                      </td>
                      <td style={cell}>{r.marca}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{brl(r.preco, r.moeda)}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{brl(r.referencia, r.moeda)}</td>
                      <td style={{ ...cell, textAlign: "right", color: cor, fontWeight: 600 }}>
                        {d == null ? "—" : `${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR")}%`}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td style={{ ...cell, textAlign: "center", color: "#5b636b" }} colSpan={5}>
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p style={{ color: "#8a9199", fontSize: 12 }}>
            {rows.length} de {todos.length} produtos. Os dados são mantidos em cache por 10
            minutos.
          </p>
        </>
      )}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Row } from "@/lib/merchant";

import {
  buildTrayCsv,
  buildTrayLines,
  isVariationOffer,
  offerIdToTrayId,
  roundMoney,
  suggestedPrice,
} from "@/lib/tray";

import styles from "./precos.module.css";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlText = (value: number | null) =>
  value == null ? "—" : brl.format(value);

const pctText = (value: number | null) => {
  if (value == null) return "—";

  const formatted = value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return `${value > 0 ? "+" : ""}${formatted}%`;
};

const signedBrl = (value: number) => {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";

  return `${sign}${brl.format(Math.abs(value))}`;
};

const isSelectable = (row: Row) => row.referencia != null && row.referencia > 0;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

type Props = {
  rows: Row[];

  erro: string;
};

export default function PrecosApp({ rows, erro }: Props) {
  const [q, setQ] = useState("");

  const [marca, setMarca] = useState("");

  const [filtro, setFiltro] = useState("todos");

  const [ordem, setOrdem] = useState("maior");

  const [desconto, setDesconto] = useState(5);

  const [naoAumentar, setNaoAumentar] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const [confirming, setConfirming] = useState(false);

  const [baixandoXlsx, setBaixandoXlsx] = useState(false);

  const [sucesso, setSucesso] = useState("");

  const [erroDownload, setErroDownload] = useState("");

  const [aplicarPromocao, setAplicarPromocao] = useState(false);

  const [dataPromocaoInicio, setDataPromocaoInicio] = useState<Date | null>(
    null,
  );

  const [dataPromocaoFim, setDataPromocaoFim] = useState<Date | null>(null);

  // PAGINAÇÃO ESTADO

  const [page, setPage] = useState(1);

  const [pageSize] = useState(20); // linhas por página

  // Quando o desconto for 0, desmarcar automaticamente a promoção

  useEffect(() => {
    if (desconto === 0) setAplicarPromocao(false);
  }, [desconto]);

  const selectAllRef = useRef<HTMLInputElement>(null);

  const confirmRef = useRef<HTMLButtonElement>(null);

  const comReferencia = useMemo(
    () => rows.filter((row) => isSelectable(row)),

    [rows],
  );

  // Lista única de marcas, derivada das linhas, para o filtro de marca

  const marcas = useMemo(() => {
    const set = new Set<string>();

    for (const row of rows) {
      const m = row.marca?.trim();

      if (m) set.add(m);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const baratos = comReferencia.filter(
    (row) => row.diferencaPct != null && row.diferencaPct < 0,
  ).length;

  const caros = comReferencia.filter(
    (row) => row.diferencaPct != null && row.diferencaPct > 0,
  ).length;

  const sortedRows = useMemo(() => {
    const rowsCopy = [...rows];

    return rowsCopy.sort((a, b) => {
      const daVal = a.diferencaPct;

      const dbVal = b.diferencaPct;

      if (daVal == null && dbVal == null)
        return a.titulo.localeCompare(b.titulo, "pt-BR");

      if (daVal == null) return 1;

      if (dbVal == null) return -1;

      return ordem === "menor" ? daVal - dbVal : dbVal - daVal;
    });
  }, [rows, ordem]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.id)),
    [rows, selected],
  );

  const trayLines = useMemo(
    () => buildTrayLines(selectedRows, desconto, { naoAumentar }),

    [selectedRows, desconto, naoAumentar],
  );

  // Filtros aplicados sobre o catálogo ordenado (total)

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();

    const filtered = sortedRows.filter((row) => {
      if (
        term &&
        !`${row.titulo} ${row.id} ${offerIdToTrayId(row.id)}`
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }

      if (marca && row.marca !== marca) return false;

      if (
        filtro === "baratos" &&
        !(row.diferencaPct != null && row.diferencaPct < 0)
      )
        return false;

      if (
        filtro === "caros" &&
        !(row.diferencaPct != null && row.diferencaPct > 0)
      )
        return false;

      return true;
    });

    return filtered.sort((a, b) => {
      const da = a.diferencaPct;

      const db = b.diferencaPct;

      if (da == null && db == null)
        return a.titulo.localeCompare(b.titulo, "pt-BR");

      if (da == null) return 1;

      if (db == null) return -1;

      return ordem === "menor" ? da - db : db - da;
    });
  }, [sortedRows, q, marca, filtro, ordem]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const startIndex = (page - 1) * pageSize;

  // Visível = paginação sobre o filtrado

  const visibleRows = useMemo(() => {
    const start = (page - 1) * pageSize;

    return filtrados.slice(start, start + pageSize);
  }, [filtrados, page, pageSize]);

  // IDs de todos os produtos que passaram pelos filtros

  useEffect(() => {
    setPage(1);
  }, [q, marca, filtro, ordem]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleIds = useMemo(
    () => new Set(filtrados.map((row) => row.id)),
    [filtrados],
  );

  const hiddenSelected = selectedRows.filter(
    (row) => !visibleIds.has(row.id),
  ).length;

  const selectableVisible = visibleRows.filter(isSelectable);

  const allVisibleSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((row) => selected.has(row.id));

  const totalAtual = trayLines.reduce((sum, line) => sum + line.precoAtual, 0);

  const totalNovo = trayLines.reduce(
    (sum, line) => sum + line.precoSugerido,
    0,
  );

  const variacaoTotal = roundMoney(totalNovo - totalAtual);

  const aumentos = trayLines.filter(
    (line) => line.precoSugerido > line.precoAtual,
  ).length;

  const reducoes = trayLines.filter(
    (line) => line.precoSugerido < line.precoAtual,
  ).length;

  const resumo =
    caros > 0
      ? `${caros} ${caros === 1 ? "produto está" : "produtos estão"} acima da referência do mercado. Selecione os que deseja reposicionar.`
      : comReferencia.length > 0
        ? "Nenhum produto está acima da referência do mercado."
        : "Nenhum produto com preço de referência foi encontrado.";

  useEffect(() => {
    if (selectAllRef.current) {
      // Lógica baseada na página visível, não no catálogo completo

      const pageSelectable = visibleRows.filter(isSelectable);

      const pageSelected = pageSelectable.filter((row) => selected.has(row.id));

      const allSelected =
        pageSelectable.length > 0 &&
        pageSelected.length === pageSelectable.length;

      const someSelected =
        pageSelectable.length > 0 &&
        pageSelected.length > 0 &&
        pageSelected.length < pageSelectable.length;

      selectAllRef.current.indeterminate = someSelected;

      selectAllRef.current.checked = allSelected;
    }
  }, [visibleRows, selected, isSelectable]);

  useEffect(() => {
    if (!confirming) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirming(false);
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKeyDown);

    const timer = window.setTimeout(() => confirmRef.current?.focus(), 30);

    return () => {
      document.body.style.overflow = previousOverflow;

      document.removeEventListener("keydown", onKeyDown);

      window.clearTimeout(timer);
    };
  }, [confirming]);

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);

      const pageSelectable = visibleRows.filter(isSelectable);

      if (allVisibleSelected) {
        for (const row of pageSelectable) next.delete(row.id);
      } else {
        for (const row of pageSelectable) next.add(row.id);
      }

      return next;
    });
  }

  function baixarCsv() {
    if (trayLines.length === 0) return;

    // Gerado no navegador para o download começar imediatamente, sem depender

    // de uma requisição assíncrona. As linhas são as mesmas revisadas na tela.

    const csv = buildTrayCsv(trayLines);

    const date = new Date().toISOString().slice(0, 10);

    downloadBlob(
      new Blob([csv], { type: "text/csv; charset=utf-8" }),

      `modelo-tray-${date}.csv`,
    );

    setErroDownload("");

    setSucesso(
      `${trayLines.length} ${
        trayLines.length === 1 ? "produto exportado" : "produtos exportados"
      } em CSV com o modelo Tray.`,
    );

    setConfirming(false);
  }

  async function baixarXlsx() {
    if (selectedRows.length === 0) return;

    setBaixandoXlsx(true);

    setErroDownload("");

    try {
      // Usa a origem sem credenciais embutidas na URL (necessário quando a página

      // é aberta via http\://usuário:senha@host pelo Basic Auth).

      const requestUrl = new URL("/api/precos.xlsx", window.location.origin);

      const response = await fetch(requestUrl, {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          ids: selectedRows.map((row) => row.id),

          descontoPct: desconto,

          naoAumentar,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";

        const message = await response.text();

        throw new Error(
          contentType.includes("text/plain")
            ? message
            : "Não foi possível gerar o arquivo. Atualize os dados e tente novamente.",
        );
      }

      const blob = await response.blob();

      const disposition = response.headers.get("content-disposition") ?? "";

      const match = disposition.match(/filename="([^"]+)"/i);

      const filename =
        match?.[1] ??
        `modelo-tray-${new Date().toISOString().slice(0, 10)}.xlsx`;

      downloadBlob(blob, filename);

      setSucesso(
        `${trayLines.length} ${
          trayLines.length === 1 ? "produto exportado" : "produtos exportados"
        } em XLSX com o modelo Tray.`,
      );

      setConfirming(false);
    } catch (error: any) {
      setErroDownload(error?.message || "Não foi possível gerar o arquivo.");
    } finally {
      setBaixandoXlsx(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <svg
            className={styles.mark}
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="18" r="4.2" />

            <circle cx="23" cy="18" r="4.2" />

            <path d="M13.2 18h5.6M4.8 16.2 8 10h3.4l2.8 5.2M27.2 16.2 24 10h-3.4l-2.8 5.2" />
          </svg>

          <div>
            <div className={styles.brandName}>Óticas Foto Paulo</div>

            <div className={styles.brandScope}>Catálogo · Google Merchant</div>
          </div>
        </div>

        <a className={styles.refresh} href="/?atualizar=1">
          Atualizar dados
        </a>
      </header>

      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Preços x Mercado</h1>

          <p className={styles.lede}>
            {erro
              ? "Não foi possível carregar os dados do Merchant Center."
              : resumo}
          </p>
        </div>
      </div>

      {erro ? (
        <section className={styles.errorPanel} role="alert">
          <strong>Falha ao buscar os dados.</strong>

          <pre className={styles.errorText}>{erro}</pre>

          <a className={styles.retry} href="/?atualizar=1">
            Tentar novamente
          </a>
        </section>
      ) : (
        <>
          <section className={styles.stats} aria-label="Resumo do catálogo">
            <div className={styles.stat}>
              <div className={styles.statLabel}>Produtos com referência</div>

              <div className={styles.statValue}>{comReferencia.length}</div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statLabel}>Mais baratos que o mercado</div>

              <div className={styles.statValue}>{baratos}</div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statLabel}>Mais caros que o mercado</div>

              <div className={styles.statValue}>{caros}</div>
            </div>
          </section>

          <section className={styles.policy} aria-labelledby="politica-preco">
            <div>
              <h2 id="politica-preco" className={styles.policyTitle}>
                Política de preço
              </h2>

              <p className={styles.policyText}>
                {naoAumentar
                  ? `Preço sugerido = menor valor entre o preço atual e a referência − ${desconto.toLocaleString(
                      "pt-BR",
                    )}%. Produtos já mais baratos não sobrem.`
                  : `Preço sugerido = referência do mercado − ${desconto.toLocaleString(
                      "pt-BR",
                    )}%. Revise os valores e aprove a seleção para gerar o arquivo.`}
              </p>
            </div>

            <div className={styles.policyControls}>
              <div className={styles.field}>
                <label htmlFor="desconto">Desconto sobre a referência</label>

                <div className={styles.inputWrap}>
                  <input
                    id="desconto"
                    type="number"
                    min={0}
                    max={99}
                    step={0.5}
                    value={desconto}
                    onChange={(event) => {
                      const next = Number(event.target.value.replace(",", "."));

                      const normalized = Math.round(next * 100) / 100;

                      setDesconto(
                        Number.isFinite(next)
                          ? Math.min(99, Math.max(0, normalized))
                          : 0,
                      );
                    }}
                  />

                  <span>%</span>
                </div>
              </div>

              <div
                className={styles.presets}
                role="group"
                aria-label="Descontos rápidos"
              >
                {[0, 3, 5, 10, 15].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.preset} ${desconto === value ? styles.presetActive : ""}`}
                    onClick={() => setDesconto(value)}
                    aria-pressed={desconto === value}
                  >
                    {value}%
                  </button>
                ))}
              </div>

              <label
                className={styles.toggle}
                title="Se o preço atual já estiver abaixo do sugerido, ele é mantido."
              >
                <input
                  type="checkbox"
                  checked={naoAumentar}
                  onChange={(event) => setNaoAumentar(event.target.checked)}
                />

                <span>Não aumentar preços</span>
              </label>

              <label
                className={styles.toggle}
                title="Aplicar desconto como promoção nas colunas do modelo Tray"
              >
                <input
                  type="checkbox"
                  checked={aplicarPromocao}
                  onChange={(event) => setAplicarPromocao(event.target.checked)}
                  disabled={desconto === 0}
                />

                <span>Aplicar como promoção</span>
              </label>

              {aplicarPromocao && (
                <div
                  className={styles.policyDateRow}
                  aria-label="Datas da promoção"
                >
                  <div className={styles.field}>
                    <label htmlFor="data-inicio">Data inicial</label>

                    <div className={styles.inputWrap}>
                      <input
                        id="data-inicio"
                        type="date"
                        value={
                          dataPromocaoInicio
                            ? dataPromocaoInicio.toISOString().split("T")[0]
                            : ""
                        }
                        onChange={(event) =>
                          setDataPromocaoInicio(
                            event.target.value
                              ? new Date(event.target.value)
                              : null,
                          )
                        }
                        min={new Date().toISOString().split("T")[0]}
                        required={false}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="data-fim">Data final</label>

                    <div className={styles.inputWrap}>
                      <input
                        id="data-fim"
                        type="date"
                        value={
                          dataPromocaoFim
                            ? dataPromocaoFim.toISOString().split("T")[0]
                            : ""
                        }
                        onChange={(event) =>
                          setDataPromocaoFim(
                            event.target.value
                              ? new Date(event.target.value)
                              : null,
                          )
                        }
                        min={new Date().toISOString().split("T")[0]}
                        required={false}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={styles.filters} aria-label="Filtros">
            <label className={styles.search}>
              <span className={styles.srOnly}>Buscar produto</span>

              <input
                className={styles.control}
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar por nome, ID Tray ou ID Google"
              />
            </label>

            <label>
              <span className={styles.srOnly}>Marca</span>

              <select
                className={styles.control}
                value={marca}
                onChange={(event) => setMarca(event.target.value)}
              >
                <option value="">Todas as marcas</option>

                {marcas.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={styles.srOnly}>Diferença para o mercado</span>

              <select
                className={styles.control}
                value={filtro}
                onChange={(event) => setFiltro(event.target.value)}
              >
                <option value="todos">Todos</option>

                <option value="baratos">Só mais baratos que o mercado</option>

                <option value="caros">Só mais caros que o mercado</option>
              </select>
            </label>

            <label>
              <span className={styles.srOnly}>Ordenação</span>

              <select
                className={styles.control}
                value={ordem}
                onChange={(event) => setOrdem(event.target.value)}
              >
                <option value="maior">Mais caro primeiro</option>

                <option value="menor">Mais barato primeiro</option>
              </select>
            </label>
          </section>

          {sucesso && (
            <div className={styles.notice} role="status" aria-live="polite">
              <span>{sucesso}</span>

              <button
                type="button"
                className={styles.noticeClose}
                onClick={() => setSucesso("")}
                aria-label="Fechar aviso"
              >
                ×
              </button>
            </div>
          )}

          {selected.size > 0 && (
            <div className={styles.selectionBar}>
              <div>
                <div className={styles.selectionTitle}>
                  {selected.size}{" "}
                  {selected.size === 1
                    ? "item selecionado"
                    : "itens selecionados"}
                </div>

                <div className={styles.selectionSub}>
                  {trayLines.length}{" "}
                  {trayLines.length === 1 ? "produto" : "produtos"} no arquivo
                  {hiddenSelected > 0
                    ? ` · ${hiddenSelected} fora do filtro atual`
                    : ""}
                  {selectedRows.length !== trayLines.length
                    ? " · variações agrupadas pelo produto pai"
                    : ""}
                </div>
              </div>

              <div className={styles.selectionActions}>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => setSelected(new Set())}
                >
                  Limpar
                </button>

                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => setConfirming(true)}
                  disabled={trayLines.length === 0}
                >
                  Aprovar seleção
                </button>
              </div>
            </div>
          )}

          {/* Controles de paginação */}

          {filtrados.length > pageSize && (
            <div
              className={styles.pagination}
              aria-label="Navegação de páginas"
            >
              <button
                type="button"
                className={styles.paginationButton}
                onClick={() => setPage(page - 1)}
                aria-label="Página anterior"
                disabled={page <= 1}
              >
                Anterior
              </button>

              <span>
                Página {page} de {totalPages}
              </span>

              <button
                type="button"
                className={styles.paginationButton}
                onClick={() => setPage(page + 1)}
                aria-label="Próxima página"
                disabled={page >= totalPages}
              >
                Próximo
              </button>
            </div>
          )}

          {/* Contagem de página atual */}

          <span className={styles.pageInfo}>
            Mostrando {filtrados.length === 0 ? 0 : startIndex + 1}-
            {Math.min(startIndex + pageSize, filtrados.length)} de{" "}
            {filtrados.length} produtos
          </span>

          <section className={styles.panel} aria-label="Produtos">
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>Produtos</div>

                <div className={styles.panelMeta}>
                  {filtrados.length} de {rows.length} produtos
                </div>
              </div>

              <button
                type="button"
                className={styles.secondary}
                onClick={toggleAllVisible}
                disabled={filtrados.length === 0}
              >
                {allVisibleSelected ? "Desmarcar página" : "Selecionar página"}
              </button>
            </div>

            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={`${styles.th} ${styles.checkCell}`}>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        disabled={selectableVisible.length === 0}
                        aria-label="Selecionar todos os produtos filtrados"
                      />
                    </th>

                    <th className={styles.th}>Produto</th>

                    <th className={`${styles.th} ${styles.colMarca}`}>Marca</th>

                    <th className={`${styles.th} ${styles.colNum}`}>
                      Seu preço
                    </th>

                    <th
                      className={`${styles.th} ${styles.colRef} ${styles.colNum}`}
                    >
                      Referência
                    </th>

                    <th
                      className={`${styles.th} ${styles.colDiff} ${styles.colNum}`}
                    >
                      Diferença
                    </th>

                    <th className={`${styles.th} ${styles.colNum}`}>
                      Preço sugerido
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.map((row) => {
                    const isSelected = selected.has(row.id);

                    const selectable = isSelectable(row);

                    const diferenca = row.diferencaPct;

                    const diffClass =
                      diferenca == null
                        ? styles.muted
                        : diferenca < 0
                          ? styles.positive
                          : diferenca > 0
                            ? styles.negative
                            : styles.muted;

                    const calculado =
                      selectable && row.referencia != null
                        ? suggestedPrice(row.referencia, desconto)
                        : null;

                    const sugerido =
                      calculado == null
                        ? null
                        : naoAumentar && row.preco != null
                          ? Math.min(row.preco, calculado)
                          : calculado;

                    const trayId = offerIdToTrayId(row.id);

                    const variacao = isVariationOffer(row.id);

                    return (
                      <tr
                        key={row.id}
                        className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                      >
                        <td className={`${styles.td} ${styles.checkCell}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!selectable}
                            onChange={() => toggleRow(row.id)}
                            aria-label={`Selecionar ${row.titulo}`}
                            title={
                              selectable
                                ? undefined
                                : "Produto sem preço de referência no relatório."
                            }
                          />
                        </td>

                        <td className={styles.td}>
                          <div className={styles.productName}>{row.titulo}</div>

                          <div className={styles.productMeta}>
                            <span>Tray {trayId || "—"}</span>

                            {variacao && (
                              <span className={styles.tag}>variação</span>
                            )}

                            <span className={styles.dot}>·</span>

                            <span className={styles.muted}>{row.id}</span>
                          </div>
                        </td>

                        <td className={`${styles.td} ${styles.colMarca}`}>
                          {row.marca || "—"}
                        </td>

                        <td className={`${styles.td} ${styles.colNum}`}>
                          {brlText(row.preco)}
                        </td>

                        <td
                          className={`${styles.td} ${styles.colRef} ${styles.colNum}`}
                        >
                          {brlText(row.referencia)}
                        </td>

                        <td
                          className={`${styles.td} ${styles.colDiff} ${styles.colNum} ${diffClass}`}
                        >
                          {pctText(diferenca)}
                        </td>

                        <td className={`${styles.td} ${styles.colNum}`}>
                          {sugerido == null ? (
                            <span className={styles.muted}>—</span>
                          ) : (
                            <span className={styles.suggested}>
                              {brlText(sugerido)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filtrados.length === 0 && (
                    <tr>
                      <td className={styles.empty} colSpan={7}>
                        Nenhum produto encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.panelFoot}>
            <span>
              O CSV segue o modelo <strong>modelo.xlsx</strong> da Tray.
              Referência do fornecedor e colunas de promoção ficam vazias porque
              não vêm do relatório do Google.
            </span>

            <span>Cache de 10 minutos.</span>
          </div>
        </>
      )}

      {confirming && (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirming(false);
          }}
        >
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-titulo"
          >
            <div className={styles.dialogHeader}>
              <div>
                <h2 id="confirmar-titulo" className={styles.dialogTitle}>
                  Aprovar atualização de preços
                </h2>

                <p className={styles.dialogLede}>
                  {trayLines.length}{" "}
                  {trayLines.length === 1
                    ? "produto pronto"
                    : "produtos prontos"}{" "}
                  para exportar com a política de{" "}
                  {desconto.toLocaleString("pt-BR")}% sobre a referência.
                </p>
              </div>

              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setConfirming(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className={styles.dialogBody}>
              <dl className={styles.summaryGrid}>
                <div className={styles.summaryCell}>
                  <dt className={styles.summaryLabel}>Produtos no arquivo</dt>

                  <dd className={styles.summaryValue}>{trayLines.length}</dd>
                </div>

                <div className={styles.summaryCell}>
                  <dt className={styles.summaryLabel}>Desconto aplicado</dt>

                  <dd className={styles.summaryValue}>
                    {desconto.toLocaleString("pt-BR")}%
                  </dd>
                </div>

                <div className={styles.summaryCell}>
                  <dt className={styles.summaryLabel}>Total hoje</dt>

                  <dd className={styles.summaryValue}>{brlText(totalAtual)}</dd>
                </div>

                <div className={styles.summaryCell}>
                  <dt className={styles.summaryLabel}>Total sugerido</dt>

                  <dd className={styles.summaryValue}>{brlText(totalNovo)}</dd>
                </div>

                <div className={styles.summaryCell}>
                  <dt className={styles.summaryLabel}>Variação total</dt>

                  <dd
                    className={`${styles.summaryValue} ${
                      variacaoTotal > 0
                        ? styles.negative
                        : variacaoTotal < 0
                          ? styles.positive
                          : styles.muted
                    }`}
                  >
                    {signedBrl(variacaoTotal)}
                  </dd>
                </div>

                <div className={styles.summaryCell}>
                  <dt className={styles.summaryLabel}>Aumentos / reduções</dt>

                  <dd className={styles.summaryValue}>
                    {aumentos} / {reducoes}
                  </dd>
                </div>
              </dl>

              {trayLines.length > 0 && (
                <div
                  className={styles.previewList}
                  aria-label="Prévia dos produtos"
                >
                  {trayLines.slice(0, 6).map((line) => (
                    <div key={line.codigo} className={styles.previewRow}>
                      <span className={styles.previewName}>
                        {line.nome || `Produto ${line.codigo}`}{" "}
                        <span className={styles.muted}>#{line.codigo}</span>
                      </span>

                      <span className={styles.previewPrices}>
                        {brlText(line.precoAtual)} →{" "}
                        <strong>{brlText(line.precoSugerido)}</strong>
                      </span>
                    </div>
                  ))}

                  {trayLines.length > 6 && (
                    <div className={styles.previewMore}>
                      + {trayLines.length - 6} produtos
                    </div>
                  )}
                </div>
              )}

              <div className={styles.dialogNote}>
                O arquivo segue as 7 colunas do modelo{" "}
                <strong>modelo.xlsx</strong>. As colunas de promoção e a
                referência do fornecedor vão vazias. Variações são agrupadas
                pelo código do produto pai e usam o menor preço sugerido do
                grupo.
                {naoAumentar &&
                  " Produtos já abaixo do preço sugerido mantêm o valor atual."}
                <br />
                Confirme no importador da Tray que a identificação é feita pelo{" "}
                <strong>Código do produto (ID)</strong>. A Tray importa Excel
                (XLS/XLSX); se o seu modelo estiver nesse formato, baixe a
                planilha .xlsx.
              </div>

              {erroDownload && (
                <div className={styles.errorInline} role="alert">
                  {erroDownload}
                </div>
              )}

              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setConfirming(false)}
                  disabled={baixandoXlsx}
                >
                  Voltar
                </button>

                <button
                  type="button"
                  className={styles.secondary}
                  onClick={baixarXlsx}
                  disabled={baixandoXlsx}
                >
                  {baixandoXlsx ? "Gerando..." : "Baixar .xlsx"}
                </button>

                <button
                  ref={confirmRef}
                  type="button"
                  className={styles.primary}
                  onClick={baixarCsv}
                  disabled={baixandoXlsx || trayLines.length === 0}
                >
                  Confirmar e baixar CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
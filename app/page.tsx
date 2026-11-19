import { getPrecos, type Row } from "@/lib/merchant";
import PrecosApp from "./precos-app";

export const dynamic = "force-dynamic";

type SP = { atualizar?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  let rows: Row[] = [];
  let erro = "";
  try {
    rows = await getPrecos(sp.atualizar === "1");
  } catch (e: any) {
    erro = e?.response?.data?.error?.message || e?.message || String(e);
  }

  return <PrecosApp rows={rows} erro={erro} />;
}

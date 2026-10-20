import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../supabase";

export default function Ranking({ cfg, myId }) {
  const [view, setView] = useState("bolao");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("ranking");
    setFailed(!!error);
    if (data) setRows(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const standings = useMemo(() => {
    const w = cfg.teams.map((name, i) => ({ i, name, wins: 0, games: 0 }));
    for (const m of cfg.matches) {
      if (!["R1", "R2", "R3", "R4"].includes(m.phase)) continue;
      for (const g of m.games) {
        if (!g.w) continue;
        w[m.a].games++; w[m.b].games++;
        w[g.w === "A" ? m.a : m.b].wins++;
      }
    }
    return w.sort((a, b) => b.wins - a.wins);
  }, [cfg]);

  let lastTotal = null, lastPos = 0;
  return (
    <>
      <div className="seg">
        <button className={view === "bolao" ? "on" : ""} onClick={() => setView("bolao")}>Bolão</button>
        <button className={view === "equipes" ? "on" : ""} onClick={() => setView("equipes")}>Equipes</button>
      </div>

      {view === "bolao" ? (
        <>
          <div className="row sp">
            <span className="mute">{rows.length} participantes</span>
            <button className="btn ghost sm" onClick={load} disabled={loading}>
              <RefreshCw size={14} style={{ verticalAlign: -2 }} /> {loading ? "Atualizando" : "Atualizar"}
            </button>
          </div>
          {failed && <div className="err">Não foi possível carregar o ranking. Confira se o schema.sql foi executado por completo.</div>}
          <div className="card" style={{ marginTop: 12 }}>
            {rows.map((r, idx) => {
              if (r.total !== lastTotal) { lastPos = idx + 1; lastTotal = r.total; }
              const medal = lastPos === 1 ? "🥇" : lastPos === 2 ? "🥈" : lastPos === 3 ? "🥉" : null;
              return (
                <div key={r.uid} className={"rk" + (r.uid === myId ? " me" : "")}>
                  <div className="pos">{medal || lastPos + "º"}</div>
                  <div className="nm">
                    <b>{r.pname}{r.pkind === "convidado" && <span className="tag">convidado</span>}</b>
                    <span className="mute">{r.game_hits} jogos certos · {r.cat_hits} categorias</span>
                  </div>
                  <div className="tt">{r.total}</div>
                </div>
              );
            })}
            {!rows.length && !loading && <div className="empty">Ninguém pontuou ainda.</div>}
          </div>
        </>
      ) : (
        <>
          <div className="mute">Vitórias nas 4 rodadas classificatórias. As 4 primeiras equipes vão para a semifinal. Desempate: confronto direto, depois saldo de pontos.</div>
          <div className="card" style={{ marginTop: 12 }}>
            {standings.map((t, idx) => (
              <div className="rk" key={t.i}>
                <div className="pos">{idx + 1}º</div>
                <div className="nm"><b>{t.name}</b><span className="mute">{t.games} jogos disputados</span></div>
                <div className="tt">{t.wins}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

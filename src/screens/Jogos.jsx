import { useState, useMemo } from "react";
import { Lock, Clock } from "lucide-react";
import { GAME_PTS, PHASES, PHASE_ORDER, GROUPS, fmtDate, countdown, teamName, matchLocked } from "../rules";

export default function Jogos({ cfg, picks, now, onPick }) {
  const groupsWith = GROUPS.filter((g) => cfg.matches.some((m) => g.phases.includes(m.phase)));
  const [sel, setSel] = useState(null);

  const def = useMemo(() => {
    const open = groupsWith.find((g) => cfg.matches.some((m) => g.phases.includes(m.phase) && !matchLocked(m, now)));
    return (open || groupsWith[groupsWith.length - 1])?.id;
  }, [cfg.matches, now]); // eslint-disable-line

  if (!groupsWith.length)
    return <div className="empty">Os jogos ainda não foram cadastrados.<br />Assim que o organizador publicar, eles aparecem aqui.</div>;

  const cur = groupsWith.find((g) => g.id === (sel ?? def)) || groupsWith[0];
  const matches = cfg.matches
    .filter((m) => cur.phases.includes(m.phase))
    .sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || new Date(a.start) - new Date(b.start));

  const total = matches.reduce((n, m) => n + m.games.length, 0);
  const done = matches.reduce((n, m) => n + m.games.filter((g) => picks.g[g.id]).length, 0);

  return (
    <>
      <div className="chips">
        {groupsWith.map((g) => (
          <button key={g.id} className={"chip" + (g.id === cur.id ? " on" : "")} onClick={() => setSel(g.id)}>{g.label}</button>
        ))}
      </div>
      <div className="mute">Você palpitou {done} de {total} jogos nesta fase. Acerto vale {GAME_PTS} pontos.</div>

      {matches.map((m) => {
        const locked = matchLocked(m, now);
        const ms = m.start ? new Date(m.start).getTime() - now : null;
        const earned = m.games.reduce((n, g) => n + (g.w && picks.g[g.id] === g.w ? GAME_PTS : 0), 0);
        return (
          <div className="card" key={m.id}>
            <div className="card-h">
              <div className="mute" style={{ marginBottom: 4 }}>{PHASES[m.phase].label}</div>
              <div className="vs">
                <span className="t">{teamName(cfg, m.a)}</span><span className="x">x</span><span className="t">{teamName(cfg, m.b)}</span>
              </div>
              <div className="meta">
                <span>{m.start ? fmtDate(m.start) : "Horário a definir"}</span>
                {locked ? (
                  <span className="st"><Lock size={12} /> Palpites encerrados{earned ? ` · +${earned}` : ""}</span>
                ) : (
                  <span className="st open"><Clock size={12} /> {ms !== null ? `Fecha em ${countdown(ms)}` : "Aberto"}</span>
                )}
              </div>
            </div>
            {m.games.map((g) => {
              const mine = picks.g[g.id];
              const off = locked || !!g.w;
              const cls = (side) => {
                let c = "pbtn";
                if (mine === side) c += " on";
                if (g.w === side) c += " win";
                if (g.w && mine === side && g.w !== side) c += " miss";
                return c;
              };
              return (
                <div className="game" key={g.id}>
                  <div className="gl"><b>Jogo {g.idx + 1}</b><em>{PHASES[m.phase].games[g.idx]}</em></div>
                  <div className="pick">
                    <button className={cls("A")} disabled={off} onClick={() => onPick(g, "A")}>{teamName(cfg, m.a)}</button>
                    <button className={cls("B")} disabled={off} onClick={() => onPick(g, "B")}>{teamName(cfg, m.b)}</button>
                  </div>
                  {off && !mine && <div className="mute" style={{ marginTop: 6 }}>Sem palpite</div>}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

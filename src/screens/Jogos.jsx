import { useState, useMemo } from "react";
import { Lock, Clock, ChevronDown } from "lucide-react";
import { GAME_PTS, PHASES, PHASE_ORDER, GROUPS, GROUP_INFO, fmtDate, countdown, teamName, matchLocked } from "../rules";

export default function Jogos({ cfg, picks, now, onPick }) {
  const [sel, setSel] = useState(null);
  const [openIds, setOpenIds] = useState({}); // confrontos abertos/fechados pelo usuário

  const def = useMemo(() => {
    const withMatches = GROUPS.filter((g) => cfg.matches.some((m) => g.phases.includes(m.phase)));
    const open = GROUPS.find((g) => cfg.matches.some((m) => g.phases.includes(m.phase) && !matchLocked(m, now)));
    return (open || withMatches[withMatches.length - 1] || GROUPS[0]).id;
  }, [cfg.matches, now]);

  const cur = GROUPS.find((g) => g.id === (sel ?? def)) || GROUPS[0];

  const matches = cfg.matches
    .filter((m) => cur.phases.includes(m.phase))
    .sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || new Date(a.start) - new Date(b.start));

  // Com 1 ou 2 confrontos (semifinais, final) já abre aberto; com mais, começa fechado
  const isOpen = (m) => (m.id in openIds ? openIds[m.id] : matches.length <= 2);
  const toggle = (m) => setOpenIds((o) => ({ ...o, [m.id]: !isOpen(m) }));
  const setAll = (v) => setOpenIds((o) => ({ ...o, ...Object.fromEntries(matches.map((m) => [m.id, v])) }));

  const total = matches.reduce((n, m) => n + m.games.length, 0);
  const done = matches.reduce((n, m) => n + m.games.filter((g) => picks.g[g.id]).length, 0);

  return (
    <>
      <div className="chips">
        {GROUPS.map((g) => (
          <button key={g.id} className={"chip" + (g.id === cur.id ? " on" : "")} onClick={() => setSel(g.id)}>{g.label}</button>
        ))}
      </div>

      {GROUP_INFO[cur.id] && <div className="notice">{GROUP_INFO[cur.id]}</div>}
      {total > 0 && (
        <>
          <div className="mute">Você palpitou {done} de {total} jogos nesta fase. Acerto vale {GAME_PTS} pontos.</div>
          {matches.length > 2 && (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn ghost sm" onClick={() => setAll(true)}>Abrir todos</button>
              <button className="btn ghost sm" onClick={() => setAll(false)}>Fechar todos</button>
            </div>
          )}
        </>
      )}

      {cur.phases.map((phase) => {
        const list = matches.filter((m) => m.phase === phase);
        if (!list.length) return <Pending key={phase} phase={phase} />;
        return list.map((m) => (
          <MatchCard key={m.id} m={m} cfg={cfg} picks={picks} now={now} onPick={onPick} open={isOpen(m)} onToggle={() => toggle(m)} />
        ));
      })}
    </>
  );
}

// Selo com a pontuação do jogo (fica verde quando você acertou)
function PtsBadge({ hit }) {
  return (
    <span className="st" style={hit ? { color: "var(--ok)", borderColor: "var(--ok)", fontWeight: 600 } : undefined}>
      {hit ? `+${GAME_PTS} pts` : `${GAME_PTS} pts`}
    </span>
  );
}

// Aparece enquanto o organizador ainda não cadastrou os confrontos da fase
function Pending({ phase }) {
  return (
    <div className="card">
      <div className="card-h">
        <div className="mute" style={{ marginBottom: 4 }}>{PHASES[phase].label}</div>
        <div className="vs"><span className="t">Equipes a definir</span></div>
        <div className="meta"><span>Os palpites abrem quando o organizador cadastrar o confronto.</span></div>
      </div>
      {PHASES[phase].games.map((d, i) => (
        <div className="game" key={i}>
          <div className="gl"><span className="row"><b>Jogo {i + 1}</b><PtsBadge /></span><em>{d}</em></div>
        </div>
      ))}
    </div>
  );
}

function MatchCard({ m, cfg, picks, now, onPick, open, onToggle }) {
  const locked = matchLocked(m, now);
  const ms = m.start ? new Date(m.start).getTime() - now : null;
  const earned = m.games.reduce((n, g) => n + (g.w && picks.g[g.id] === g.w ? GAME_PTS : 0), 0);
  const done = m.games.filter((g) => picks.g[g.id]).length;
  return (
    <div className="card">
      <button
        className="card-h"
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: "100%", textAlign: "left", border: 0, borderBottom: open ? undefined : 0, cursor: "pointer", font: "inherit", color: "inherit", display: "block" }}
      >
        <div className="row sp" style={{ marginBottom: 4 }}>
          <span className="mute">{PHASES[m.phase].label}</span>
          <ChevronDown size={20} style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none", color: "var(--brand)" }} />
        </div>
        <div className="vs">
          <span className="t">{teamName(cfg, m.a)}</span><span className="x">x</span><span className="t">{teamName(cfg, m.b)}</span>
        </div>
        <div className="meta">
          <span>{m.start ? fmtDate(m.start) : "Horário a definir"} · {done}/{m.games.length} palpites</span>
          {locked ? (
            <span className="st"><Lock size={12} /> Encerrado{earned ? ` · +${earned}` : ""}</span>
          ) : (
            <span className="st open"><Clock size={12} /> {ms !== null ? `Fecha em ${countdown(ms)}` : "Aberto"}</span>
          )}
        </div>
      </button>
      {open && m.games.map((g) => {
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
            <div className="gl">
              <span className="row"><b>Jogo {g.idx + 1}</b><PtsBadge hit={!!g.w && mine === g.w} /></span>
              <em>{PHASES[m.phase].games[g.idx]}</em>
            </div>
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
}

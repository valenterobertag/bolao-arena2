import { CATS, fmtDate, countdown, teamName, personName, hasRes, catsLocked } from "../rules";

export default function Categorias({ cfg, picks, now, onPick }) {
  const locked = catsLocked(cfg, now);
  const roster = [...cfg.roster].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <>
      <div className="notice">
        {locked
          ? "Palpites de categorias encerrados."
          : cfg.catDeadline
            ? `Você pode mudar seus palpites até ${fmtDate(cfg.catDeadline)} (fecha em ${countdown(new Date(cfg.catDeadline).getTime() - now)}).`
            : "O organizador ainda vai definir o prazo. Os palpites ficam abertos por enquanto."}
      </div>

      {CATS.map((c) => {
        const mine = picks.c[c.id];
        const res = cfg.catResults?.[c.id];
        const done = hasRes(res);
        const right = done && hasRes(mine) && String(mine) === String(res);
        return (
          <div className="card" key={c.id}>
            <div className="card-h">
              <div className="row sp">
                <div className="vs" style={{ fontSize: 18 }}><span>{c.icon}</span><span className="t">{c.label}</span></div>
                <span className="st" style={right ? { color: "var(--ok)", borderColor: "var(--ok)" } : undefined}>
                  {right ? `+${c.pts} pts` : `${c.pts} pts`}
                </span>
              </div>
              {c.sub && <div className="mute" style={{ marginTop: 2 }}>{c.sub}</div>}
            </div>
            <div className="card-b">
              {c.kind === "team" ? (
                <div className="teams">
                  {cfg.teams.map((t, i) => (
                    <button key={i} disabled={locked}
                      className={"pbtn" + (String(mine) === String(i) ? " on" : "") + (done && String(res) === String(i) ? " win" : "") + (done && String(mine) === String(i) && !right ? " miss" : "")}
                      onClick={() => onPick(c.id, i)}>{t}</button>
                  ))}
                </div>
              ) : cfg.roster.length ? (
                <select className="in" disabled={locked} value={mine ?? ""} onChange={(e) => onPick(c.id, e.target.value)}>
                  <option value="">Escolha uma pessoa</option>
                  {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <div className="mute">A lista de jogadores ainda não foi cadastrada.</div>
              )}
              {done && (
                <div className="mute" style={{ marginTop: 8 }}>
                  Resultado oficial: <b style={{ color: "var(--ink)" }}>{c.kind === "team" ? teamName(cfg, res) : personName(cfg, res)}</b>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

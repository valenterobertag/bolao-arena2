import { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import { CATS, PHASES, PHASE_ORDER, slug, teamName, isoToInput, inputToIso, hasRes } from "../rules";

export default function Admin({ cfg, run, notify }) {
  const [sec, setSec] = useState("jogos");
  return (
    <>
      <div className="seg">
        {[["jogos", "Jogos"], ["cats", "Categorias"], ["equipes", "Equipes"], ["pessoas", "Pessoas"]].map(([id, l]) => (
          <button key={id} className={sec === id ? "on" : ""} onClick={() => setSec(id)}>{l}</button>
        ))}
      </div>
      {sec === "jogos" && <AdminJogos cfg={cfg} run={run} notify={notify} />}
      {sec === "cats" && <AdminCats cfg={cfg} run={run} />}
      {sec === "equipes" && <AdminEquipes cfg={cfg} run={run} notify={notify} />}
      {sec === "pessoas" && <AdminPessoas notify={notify} />}
    </>
  );
}

// Campo de data/hora com botão "Salvar horário" (evita gravar a cada toque)
function DateTimeField({ value, onSave, label = "Salvar horário" }) {
  const [v, setV] = useState(isoToInput(value));
  useEffect(() => setV(isoToInput(value)), [value]);
  const changed = v !== isoToInput(value);
  return (
    <>
      <input className="in" type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} />
      {changed && v && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => onSave(inputToIso(v))}>{label}</button>}
    </>
  );
}

/* ---------- Jogos e resultados ---------- */

function AdminJogos({ cfg, run, notify }) {
  const [phase, setPhase] = useState("R1");
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const [start, setStart] = useState("");
  const [err, setErr] = useState("");
  const [del, setDel] = useState(null);

  async function create() {
    if (a === b) return setErr("Escolha duas equipes diferentes.");
    if (!start) return setErr("Defina data e hora de início. Os palpites fecham nesse horário.");
    setErr("");
    const ok = await run(supabase.from("matches").insert({ phase, team_a: a, team_b: b, starts_at: inputToIso(start) }));
    if (ok) notify("Confronto criado.", true);
  }

  const sorted = [...cfg.matches].sort(
    (x, y) => PHASE_ORDER.indexOf(x.phase) - PHASE_ORDER.indexOf(y.phase) || new Date(x.start) - new Date(y.start)
  );

  return (
    <>
      <div className="card"><div className="card-b">
        <div className="h2" style={{ marginTop: 0 }}>Novo confronto</div>
        <div className="mute">Cada confronto entre duas equipes já vem com os jogos da fase. Cadastre as semifinais e a final depois de definidos os classificados.</div>
        <label className="lb">Fase</label>
        <select className="in" value={phase} onChange={(e) => setPhase(e.target.value)}>
          {PHASE_ORDER.map((p) => <option key={p} value={p}>{PHASES[p].label}</option>)}
        </select>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="lb">Equipe A</label>
            <select className="in" value={a} onChange={(e) => setA(Number(e.target.value))}>{cfg.teams.map((t, i) => <option key={i} value={i}>{t}</option>)}</select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="lb">Equipe B</label>
            <select className="in" value={b} onChange={(e) => setB(Number(e.target.value))}>{cfg.teams.map((t, i) => <option key={i} value={i}>{t}</option>)}</select>
          </div>
        </div>
        <label className="lb">Início (os palpites fecham neste horário)</label>
        <input className="in" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={create}>Criar confronto</button>
      </div></div>

      {sorted.map((m) => (
        <div className="card" key={m.id}>
          <div className="card-h">
            <div className="mute">{PHASES[m.phase].label}</div>
            <div className="vs"><span className="t">{teamName(cfg, m.a)}</span><span className="x">x</span><span className="t">{teamName(cfg, m.b)}</span></div>
            <label className="lb" style={{ marginTop: 10 }}>Início</label>
            <DateTimeField value={m.start} onSave={(iso) => run(supabase.from("matches").update({ starts_at: iso }).eq("id", m.id))} />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn ghost sm" onClick={() => run(supabase.from("matches").update({ closed: !m.closed }).eq("id", m.id))}>
                {m.closed ? "Reabrir palpites" : "Encerrar palpites agora"}
              </button>
              {del === m.id ? (
                <button className="btn danger sm" onClick={() => { run(supabase.from("matches").delete().eq("id", m.id)); setDel(null); }}>Confirmar exclusão</button>
              ) : (
                <button className="btn ghost sm" onClick={() => setDel(m.id)}><Trash2 size={14} style={{ verticalAlign: -2 }} /> Excluir</button>
              )}
            </div>
          </div>
          {m.games.map((g) => (
            <div className="game" key={g.id}>
              <div className="gl"><b>Jogo {g.idx + 1}</b><em>{PHASES[m.phase].games[g.idx]}</em></div>
              <div className="mute" style={{ marginBottom: 6 }}>Quem venceu?</div>
              <div className="pick">
                {["A", "B"].map((side) => (
                  <button key={side} className={"pbtn" + (g.w === side ? " on" : "")}
                    onClick={() => run(supabase.from("games").update({ winner: g.w === side ? null : side }).eq("id", g.id))}>
                    {teamName(cfg, side === "A" ? m.a : m.b)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      {!sorted.length && <div className="empty">Nenhum confronto cadastrado ainda.</div>}
    </>
  );
}

/* ---------- Categorias ---------- */

function AdminCats({ cfg, run }) {
  const roster = [...cfg.roster].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const setRes = (cat, v) => run(supabase.from("cat_results").upsert({ cat, value: v === null ? null : String(v) }));
  return (
    <>
      <div className="card"><div className="card-b">
        <div className="h2" style={{ marginTop: 0 }}>Prazo dos palpites de categorias</div>
        <label className="lb">Fecha em</label>
        <DateTimeField value={cfg.catDeadline} label="Salvar prazo" onSave={(iso) => run(supabase.from("settings").update({ cat_deadline: iso }).eq("id", 1))} />
        <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => run(supabase.from("settings").update({ cat_closed: !cfg.catClosed }).eq("id", 1))}>
          {cfg.catClosed ? "Reabrir palpites" : "Encerrar palpites agora"}
        </button>
      </div></div>

      <div className="h2">Resultados oficiais</div>
      <div className="mute">Preencha conforme o torneio avança. Os pontos entram no ranking na hora.</div>
      {CATS.map((c) => (
        <div className="card" key={c.id}><div className="card-b">
          <div className="row sp"><b>{c.icon} {c.label}</b><span className="mute">{c.pts} pts</span></div>
          <select className="in" style={{ marginTop: 8 }}
            value={hasRes(cfg.catResults?.[c.id]) ? cfg.catResults[c.id] : ""}
            onChange={(e) => setRes(c.id, e.target.value === "" ? null : e.target.value)}>
            <option value="">Ainda não definido</option>
            {c.kind === "team"
              ? cfg.teams.map((t, i) => <option key={i} value={String(i)}>{t}</option>)
              : roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div></div>
      ))}
    </>
  );
}

/* ---------- Equipes e jogadores ---------- */

function AdminEquipes({ cfg, run, notify }) {
  const rosterText = (r) => r.map((p) => (p.team !== null && p.team !== undefined ? `${p.name}, ${p.team + 1}` : p.name)).join("\n");
  const [teams, setTeams] = useState(cfg.teams);
  const [text, setText] = useState(rosterText(cfg.roster));
  const [busy, setBusy] = useState(false);

  function parseRoster() {
    const seen = new Set();
    const out = [];
    for (const line of text.split("\n")) {
      const [n, t] = line.split(",").map((s) => s.trim());
      if (!n) continue;
      const id = slug(n);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name: n, team: t && /^[1-8]$/.test(t) ? Number(t) - 1 : null });
    }
    return out;
  }

  async function save() {
    setBusy(true);
    const list = parseRoster();
    const names = teams.map((t, i) => t.trim() || `Equipe ${i + 1}`);
    const r1 = await supabase.from("settings").update({ teams: names }).eq("id", 1);
    let r2 = { error: null };
    if (list.length) r2 = await supabase.from("players").upsert(list);
    const keep = new Set(list.map((p) => p.id));
    const removed = cfg.roster.filter((p) => !keep.has(p.id)).map((p) => p.id);
    let r3 = { error: null };
    if (removed.length) r3 = await supabase.from("players").delete().in("id", removed);
    const error = r1.error || r2.error || r3.error;
    await run(Promise.resolve({ error }));
    setBusy(false);
    if (!error) notify("Equipes e jogadores salvos.", true);
  }

  return (
    <div className="card"><div className="card-b">
      <div className="h2" style={{ marginTop: 0 }}>Nomes das 8 equipes</div>
      {teams.map((t, i) => (
        <input key={i} className="in" style={{ marginTop: 8 }} value={t} aria-label={`Equipe ${i + 1}`}
          onChange={(e) => setTeams(teams.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
      <div className="h2">Jogadores</div>
      <div className="mute">Um por linha. Opcional: vírgula e o número da equipe (1 a 8). Essa lista alimenta as categorias de MVP, Sidão, check-ins e revelação.</div>
      <textarea className="in" style={{ marginTop: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Ana Souza, 1\nBruno Lima, 1\nCarla Dias, 2"} />
      <div className="mute" style={{ marginTop: 6 }}>{parseRoster().length} jogadores na lista</div>
      <button className="btn" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Salvar equipes e jogadores"}</button>
    </div></div>
  );
}

/* ---------- Pessoas ---------- */

function AdminPessoas({ notify }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("name");
    setList(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleAdmin(u) {
    const { error } = await supabase.from("profiles").update({ is_admin: !u.is_admin }).eq("id", u.id);
    if (error) notify(error.message);
    load();
  }
  async function resetPin(u) {
    const { error } = await supabase.rpc("admin_reset_pin", { target: u.id });
    if (error) notify(error.message);
    else notify(`PIN de ${u.name} redefinido para 0000. Peça para a pessoa entrar e trocar.`, true);
  }

  return (
    <>
      <div className="row sp">
        <span className="mute">{list.length} cadastrados</span>
        <button className="btn ghost sm" onClick={load} disabled={loading}>{loading ? "…" : "Atualizar"}</button>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        {list.map((u) => (
          <div className="rk" key={u.id} style={{ flexWrap: "wrap" }}>
            <div className="nm" style={{ flexBasis: "100%" }}>
              <b>{u.name}
                {u.kind === "convidado" && <span className="tag">convidado</span>}
                {u.is_admin && <span className="tag" style={{ color: "var(--brand)" }}>organizador</span>}
              </b>
            </div>
            <button className="btn ghost sm" onClick={() => toggleAdmin(u)}>{u.is_admin ? "Remover admin" : "Tornar admin"}</button>
            <button className="btn ghost sm" onClick={() => resetPin(u)}>Resetar PIN</button>
          </div>
        ))}
        {!list.length && !loading && <div className="empty">Ninguém se cadastrou ainda.</div>}
      </div>
    </>
  );
}

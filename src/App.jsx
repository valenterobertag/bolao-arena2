import { useState, useEffect, useCallback, useRef } from "react";
import { Trophy, ListOrdered, Target, Settings } from "lucide-react";
import { supabase, configured } from "./supabase";
import { EMPTY_CFG, emailFor, passFor, slug, scoreUser } from "./rules";
import LOGO from "./assets/logo.png";
import Jogos from "./screens/Jogos";
import Categorias from "./screens/Categorias";
import Ranking from "./screens/Ranking";
import Admin from "./screens/Admin";

const mapMatch = (m) => ({
  id: m.id,
  phase: m.phase,
  a: m.team_a,
  b: m.team_b,
  start: m.starts_at,
  closed: m.closed,
  games: [...(m.games || [])].sort((x, y) => x.idx - y.idx).map((g) => ({ id: g.id, idx: g.idx, w: g.winner })),
});

export default function App() {
  const [boot, setBoot] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cfg, setCfg] = useState(EMPTY_CFG);
  const [picks, setPicks] = useState({ g: {}, c: {} });
  const [tab, setTab] = useState("palpites");
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null); // { msg, info }
  const [saveState, setSaveState] = useState("idle");
  const [showPin, setShowPin] = useState(false);
  const savedTimer = useRef(null);

  const notify = useCallback((msg, info = false) => setToast({ msg, info }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- Dados ---------- */

  const loadCfg = useCallback(async () => {
    const [s, pl, ms, cr] = await Promise.all([
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("players").select("*").order("name"),
      supabase.from("matches").select("*, games(*)").order("starts_at", { ascending: true }),
      supabase.from("cat_results").select("*"),
    ]);
    setCfg({
      teams: s.data?.teams || EMPTY_CFG.teams,
      catDeadline: s.data?.cat_deadline || "",
      catClosed: !!s.data?.cat_closed,
      roster: (pl.data || []).map((p) => ({ id: p.id, name: p.name, team: p.team })),
      matches: (ms.data || []).map(mapMatch),
      catResults: Object.fromEntries((cr.data || []).filter((r) => r.value !== null).map((r) => [r.cat, r.value])),
    });
  }, []);

  const loadPicks = useCallback(async (uid) => {
    const [g, c] = await Promise.all([
      supabase.from("game_picks").select("game_id, pick").eq("user_id", uid),
      supabase.from("cat_picks").select("cat, value").eq("user_id", uid),
    ]);
    setPicks({
      g: Object.fromEntries((g.data || []).map((r) => [r.game_id, r.pick])),
      c: Object.fromEntries((c.data || []).map((r) => [r.cat, r.value])),
    });
  }, []);

  const refreshProfile = useCallback(async (uid) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) setProfile(data);
    return data;
  }, []);

  /* ---------- Sessão ---------- */

  useEffect(() => {
    if (!configured) { setBoot(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;
  useEffect(() => {
    if (!configured) return;
    if (!uid) {
      setProfile(null);
      if (session === null) setBoot(false);
      return;
    }
    let alive = true;
    (async () => {
      const meta = session.user.user_metadata || {};
      // Garante o perfil (caso o cadastro tenha sido interrompido no meio)
      await supabase.from("profiles").upsert(
        { id: uid, name: meta.name || "Sem nome", kind: meta.kind || "jogador" },
        { onConflict: "id", ignoreDuplicates: true }
      );
      await refreshProfile(uid);
      await Promise.all([loadCfg(), loadPicks(uid)]);
      if (alive) setBoot(false);
    })();
    return () => { alive = false; };
  }, [uid]); // eslint-disable-line

  useEffect(() => {
    const t1 = setInterval(() => setNow(Date.now()), 20000);
    const t2 = setInterval(() => { if (uid) loadCfg(); }, 30000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [uid, loadCfg]);

  /* ---------- Ações ---------- */

  // Executa uma operação do painel do organizador e recarrega os dados
  const run = useCallback(async (promise) => {
    const { error } = await promise;
    if (error) notify(error.message);
    await loadCfg();
    return !error;
  }, [loadCfg, notify]);

  function markSaved(ok) {
    clearTimeout(savedTimer.current);
    setSaveState(ok ? "saved" : "error");
    if (ok) savedTimer.current = setTimeout(() => setSaveState("idle"), 2500);
  }

  async function pickGame(game, side) {
    const cur = picks.g[game.id];
    const next = cur === side ? null : side;
    setPicks((p) => {
      const g = { ...p.g };
      if (next) g[game.id] = next; else delete g[game.id];
      return { ...p, g };
    });
    setSaveState("saving");
    const res = next
      ? await supabase.from("game_picks").upsert({ user_id: uid, game_id: game.id, pick: next, updated_at: new Date().toISOString() })
      : await supabase.from("game_picks").delete().eq("user_id", uid).eq("game_id", game.id);
    if (res.error) {
      notify("Não foi possível salvar. Os palpites deste jogo podem já ter fechado.");
      await Promise.all([loadPicks(uid), loadCfg()]);
    }
    markSaved(!res.error);
  }

  async function pickCat(catId, value) {
    const cur = picks.c[catId];
    const v = value === "" || value === null || value === undefined ? null : String(value);
    const next = v === null || cur === v ? null : v;
    setPicks((p) => {
      const c = { ...p.c };
      if (next !== null) c[catId] = next; else delete c[catId];
      return { ...p, c };
    });
    setSaveState("saving");
    const res = next !== null
      ? await supabase.from("cat_picks").upsert({ user_id: uid, cat: catId, value: next, updated_at: new Date().toISOString() })
      : await supabase.from("cat_picks").delete().eq("user_id", uid).eq("cat", catId);
    if (res.error) {
      notify("Não foi possível salvar. O prazo das categorias pode ter acabado.");
      await Promise.all([loadPicks(uid), loadCfg()]);
    }
    markSaved(!res.error);
  }

  async function logout() {
    await supabase.auth.signOut();
    setTab("palpites");
    setPicks({ g: {}, c: {} });
  }

  /* ---------- Telas ---------- */

  if (!configured)
    return (
      <div className="bt"><div className="wrap" style={{ paddingTop: 40 }}>
        <div className="h2">Falta configurar o Supabase</div>
        <p className="mute">Crie o arquivo <b>.env</b> com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README) e gere o app de novo.</p>
      </div></div>
    );

  if (boot) return <div className="bt"><div className="empty">Carregando…</div></div>;

  if (!session || !profile)
    return (
      <div className="bt">
        {toast && <div className={"toast" + (toast.info ? " info" : "")}>{toast.msg}</div>}
        <Auth notify={notify} refreshProfile={refreshProfile} />
      </div>
    );

  const isAdmin = !!profile.is_admin;
  const me = scoreUser(picks, cfg);
  const tabs = [
    { id: "palpites", label: "Jogos", icon: <Target size={22} /> },
    { id: "categorias", label: "Categorias", icon: <Trophy size={22} /> },
    { id: "ranking", label: "Ranking", icon: <ListOrdered size={22} /> },
    ...(isAdmin ? [{ id: "admin", label: "Organizar", icon: <Settings size={22} /> }] : []),
  ];

  return (
    <div className="bt">
      {toast && <div className={"toast" + (toast.info ? " info" : "")}>{toast.msg}</div>}
      <div className="hd">
        <div className="hd-in">
          <img src={LOGO} alt="Arena Barra Mares" />
          <div>
            <div className="ttl">Bolão do 5º<br />torneio de equipes</div>
            <div className="sub">Arena Barra Mares</div>
          </div>
          <div className="score"><b>{me.total}</b><span>seus pontos</span></div>
        </div>
      </div>
      <div className="ub">
        {profile.name} · <u onClick={() => setShowPin((v) => !v)}>trocar PIN</u> · <u onClick={logout}>sair</u>
        <span style={{ color: saveState === "error" ? "var(--bad)" : "var(--mute)" }}>
          {saveState === "saving" ? " · salvando…" : saveState === "saved" ? " · palpite salvo" : saveState === "error" ? " · erro ao salvar" : ""}
        </span>
      </div>

      <div className="wrap">
        {showPin && <PinCard notify={notify} onClose={() => setShowPin(false)} />}
        {tab === "palpites" && <Jogos cfg={cfg} picks={picks} now={now} onPick={pickGame} />}
        {tab === "categorias" && <Categorias cfg={cfg} picks={picks} now={now} onPick={pickCat} />}
        {tab === "ranking" && <Ranking cfg={cfg} myId={uid} />}
        {tab === "admin" && isAdmin && <Admin cfg={cfg} run={run} notify={notify} />}
      </div>

      <div className="nav"><div>
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.icon}{t.label}</button>
        ))}
      </div></div>
    </div>
  );
}

/* ---------- Troca de PIN ---------- */

function PinCard({ notify, onClose }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!/^\d{4}$/.test(pin)) return notify("O PIN precisa ter 4 números.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: passFor(pin) });
    setBusy(false);
    if (error) return notify(error.message);
    notify("PIN alterado.", true);
    onClose();
  }
  return (
    <div className="card"><div className="card-b">
      <b>Novo PIN</b>
      <input className="in" style={{ marginTop: 8 }} type="password" inputMode="numeric" value={pin} placeholder="4 números"
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm" disabled={busy} onClick={save}>Salvar PIN</button>
        <button className="btn ghost sm" onClick={onClose}>Cancelar</button>
      </div>
    </div></div>
  );
}

/* ---------- Entrar / criar conta ---------- */

function Auth({ notify, refreshProfile }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [kind, setKind] = useState("jogador");
  const [wantAdmin, setWantAdmin] = useState(false);
  const [org, setOrg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    const nm = name.trim().replace(/\s+/g, " ");
    if (nm.length < 3 || !slug(nm)) return setErr("Digite seu nome completo.");
    if (!/^\d{4}$/.test(pin)) return setErr("O PIN precisa ter 4 números.");
    setBusy(true);
    try {
      const email = emailFor(nm);
      const password = passFor(pin);
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setErr("Nome ou PIN incorreto. Se esqueceu o PIN, peça ao organizador para redefinir.");
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: nm, kind } } });
      if (error) {
        if (/registered|already/i.test(error.message)) setErr("Já existe alguém com esse nome. Use nome e sobrenome.");
        else setErr(error.message);
        return;
      }
      if (!data.session) {
        setErr("Conta criada, mas o Supabase está pedindo confirmação por e-mail. Desative essa opção (veja o README).");
        return;
      }
      if (wantAdmin) {
        await supabase.from("profiles").upsert({ id: data.user.id, name: nm, kind }, { onConflict: "id", ignoreDuplicates: true });
        const { data: ok } = await supabase.rpc("claim_admin", { p_code: org.trim() });
        if (ok) { await refreshProfile(data.user.id); notify("Você agora é organizador.", true); }
        else notify("Conta criada, mas o código de organizador está incorreto.");
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-bg"><div className="auth">
      <div className="lockup">
        <img src={LOGO} alt="" />
        <div className="n1">Arena<br />Barra Mares</div>
        <div className="n2">Beach Training</div>
      </div>
      <div className="auth-card">
        <div className="h2">Bolão do 5º torneio de equipes</div>
        <div className="mute">Palpite nos jogos e nas categorias até o início de cada um.</div>

        <div className="seg">
          <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Entrar</button>
          <button className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>Criar conta</button>
        </div>

        <label className="lb">Nome e sobrenome</label>
        <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana Souza" autoComplete="name" />
        <label className="lb">PIN de 4 números</label>
        <input className="in" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" placeholder="••••" />

        {mode === "signup" && (
          <>
            <label className="lb">Você é</label>
            <div className="seg" style={{ marginTop: 0 }}>
              <button className={kind === "jogador" ? "on" : ""} onClick={() => setKind("jogador")}>Jogador</button>
              <button className={kind === "convidado" ? "on" : ""} onClick={() => setKind("convidado")}>Convidado</button>
            </div>
            <label className="check">
              <input type="checkbox" checked={wantAdmin} onChange={(e) => setWantAdmin(e.target.checked)} />
              Sou organizador
            </label>
            {wantAdmin && (
              <>
                <label className="lb">Código de organizador</label>
                <input className="in" value={org} onChange={(e) => setOrg(e.target.value)} />
              </>
            )}
          </>
        )}

        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy} onClick={submit}>{mode === "login" ? "Entrar" : "Criar conta"}</button>
      </div>
    </div></div>
  );
}

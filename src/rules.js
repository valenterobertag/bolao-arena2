// Regras, textos e utilidades do bolão (pontuação conforme definido pela organização)

export const GAME_PTS = 3;

// O sufixo abaixo precisa ser igual ao usado na função admin_reset_pin do schema.sql
export const PIN_SUFFIX = "-arena5";

export const CATS = [
  { id: "champion", label: "Campeão", pts: 15, icon: "🏆", kind: "team" },
  { id: "mvp", label: "MVP do torneio", pts: 10, icon: "⭐", kind: "person" },
  { id: "revelacao", label: "Revelação do torneio", pts: 5, icon: "🚀", kind: "person" },
];

export const PHASES = {
  R1: { label: "1ª rodada", games: ["Preto + Branco", "Preto + Branco", "Preto + Branco", "Dois cinzas"] },
  R2: { label: "2ª rodada", games: ["Preto + Cinza", "Preto + Branco", "Preto + Branco", "Cinza + Branco"] },
  R3: { label: "3ª rodada", games: ["Preto + Cinza", "Cinza + Branco", "Preto + Branco", "Preto + Branco"] },
  R4: { label: "4ª rodada", games: ["Preto + Cinza", "Preto + Cinza", "Preto + Branco", "Quadra"] },
  SF1: { label: "Semifinal 1", games: ["Dois pretos", "Dois cinzas (preto entra no 9º ponto)", "Preto + Branco (outro branco entra no 9º ponto)"] },
  SF2: { label: "Semifinal 2", games: ["Dois pretos", "Dois cinzas (preto entra no 9º ponto)", "Preto + Branco (outro branco entra no 9º ponto)"] },
  FINAL: { label: "Final", games: ["Quadra (quaisquer 4 do time)", "Quadra (os 4 que não jogaram o Jogo 1)", "Quadra (2 do Jogo 1 e 2 do Jogo 2)"] },
};
export const PHASE_ORDER = ["R1", "R2", "R3", "R4", "SF1", "SF2", "FINAL"];
export const GROUPS = [
  { id: "R1", label: "1ª rodada", phases: ["R1"] },
  { id: "R2", label: "2ª rodada", phases: ["R2"] },
  { id: "R3", label: "3ª rodada", phases: ["R3"] },
  { id: "R4", label: "4ª rodada", phases: ["R4"] },
  { id: "SF", label: "Semifinais", phases: ["SF1", "SF2"] },
  { id: "FINAL", label: "Final", phases: ["FINAL"] },
];

// Explicações mostradas nas abas de Semifinais e Final (conforme a dinâmica do torneio)
export const GROUP_INFO = {
  SF: "Os 4 melhores das rodadas vão para a semifinal. A 1ª colocada escolhe quem quer enfrentar, e as outras duas se enfrentam. Os dois confrontos seguem a mesma lógica de duplas.",
  FINAL: "Os 3 jogos são disputados entre as duas equipes vencedoras da semifinal. Nenhum atleta preto pode jogar os 3 jogos.",
};

export const EMPTY_CFG = {
  teams: Array.from({ length: 8 }, (_, i) => `Equipe ${i + 1}`),
  roster: [],
  catDeadline: "",
  catClosed: false,
  catResults: {},
  matches: [],
};

/* ---------- Utilidades ---------- */

export const slug = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Login por nome + PIN: o nome vira um e-mail interno e o PIN vira a senha
export const emailFor = (name) => `${slug(name)}@arenabarramares.app`;
export const passFor = (pin) => `${pin}${PIN_SUFFIX}`;

export const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const isoToInput = (iso) => (iso ? toLocalInput(new Date(iso)) : "");
export const inputToIso = (v) => (v ? new Date(v).toISOString() : null);

export const fmtDate = (s) =>
  new Date(s).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const countdown = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}min`;
  return `${mm}min`;
};

export const teamName = (cfg, i) => (i === null || i === undefined || i === "" ? "?" : cfg.teams[Number(i)] ?? "?");
export const personName = (cfg, id) => cfg.roster.find((p) => p.id === id)?.name ?? "";
export const hasRes = (v) => v !== null && v !== undefined && v !== "";

export const matchLocked = (m, now) => !!m.closed || (!!m.start && now >= new Date(m.start).getTime());
export const catsLocked = (cfg, now) => !!cfg.catClosed || (!!cfg.catDeadline && now >= new Date(cfg.catDeadline).getTime());

// Pontuação do próprio usuário (o ranking geral vem do banco)
export function scoreUser(picks, cfg) {
  let game = 0, hits = 0, cat = 0, catHits = 0;
  for (const m of cfg.matches) {
    for (const g of m.games) {
      if (g.w && picks.g?.[g.id] === g.w) { game += GAME_PTS; hits++; }
    }
  }
  for (const c of CATS) {
    const r = cfg.catResults?.[c.id];
    if (hasRes(r) && hasRes(picks.c?.[c.id]) && String(picks.c[c.id]) === String(r)) { cat += c.pts; catHits++; }
  }
  return { total: game + cat, game, hits, cat, catHits };
}

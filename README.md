# Bolão do 5º Torneio de Equipes – Arena Barra Mares

App instalável (PWA) para o bolão: cada participante abre um link, cria a conta com nome + PIN, palpita nos jogos e nas categorias, e acompanha o ranking. Os palpites fecham sozinhos no horário de início de cada confronto, e **o bloqueio é feito no servidor** (não dá para burlar pelo celular).

Tecnologias: React + Vite (app), Supabase (banco de dados e login). Tudo no plano gratuito atende 64 pessoas + convidados.

---

## Passo a passo para colocar no ar

### 1. Criar o banco (Supabase)
1. Crie uma conta em https://supabase.com e clique em **New project** (região: South America / São Paulo).
2. Abra o arquivo `supabase/schema.sql`, **troque `TROQUE-ESTE-CODIGO`** por um código só seu (é o código que transforma alguém em organizador) e salve.
3. No Supabase, vá em **SQL Editor → New query**, cole o arquivo inteiro e clique em **Run**. Rode **uma única vez**.
4. Vá em **Authentication → Sign In / Providers → Email** e **desligue "Confirm email"**. (Os logins usam um e-mail interno fictício gerado a partir do nome, então não há e-mail para confirmar.)
5. Vá em **Project Settings → API** e copie o **Project URL** e a chave **anon public**.

### 2. Preparar o app (precisa do Node.js 18+ instalado, https://nodejs.org)
```bash
cp .env.example .env        # abra o .env e cole o URL e a chave anon
npm install
npm run dev                 # testa no computador (http://localhost:5173)
npm run build               # gera a pasta dist/ para publicar
```

### 3. Publicar
- **Mais fácil:** acesse https://app.netlify.com/drop e arraste a pasta `dist`. Você recebe um link; dá para trocar o nome do endereço em *Site settings → Change site name*.
- Alternativas: Vercel, Cloudflare Pages ou GitHub Pages (é um site estático).

### 4. Primeiro acesso (organizador)
1. Abra o link, toque em **Criar conta**, preencha nome e PIN, marque **Sou organizador** e digite o código do passo 1.2.
2. Em **Organizar → Equipes**: digite o nome das 8 equipes e cole a lista de jogadores (um por linha; opcional `, 3` para indicar a equipe).
3. Em **Organizar → Jogos**: crie os confrontos (fase, equipes, data e hora de início). Cada confronto já vem com os jogos da fase.
4. Em **Organizar → Categorias**: defina o prazo para palpites de campeão, MVP etc.
5. Para outros organizadores: eles criam conta marcando "Sou organizador" com o mesmo código, ou você usa **Organizar → Pessoas → Tornar admin**.

### 5. Compartilhar com os participantes
Mande o link no WhatsApp. Para instalar no celular:
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.

---

## Durante o torneio
- **Semifinais e final:** quando as 8 equipes terminarem as 4 rodadas, veja a aba **Ranking → Equipes** (vitórias por equipe) e cadastre os confrontos da semifinal e da final em **Organizar → Jogos**.
- **Lançar resultado:** em **Organizar → Jogos**, toque na equipe vencedora de cada jogo. O ranking atualiza na hora. Um jogo com resultado lançado não aceita mais palpites.
- **Encerrar antes do horário:** use *Encerrar palpites agora* no confronto.
- **Resultados de categorias** (campeão, vice, MVP…): em **Organizar → Categorias**, conforme forem definidos.
- **Esqueceu o PIN?** Em **Organizar → Pessoas → Resetar PIN** (volta para 0000; a pessoa entra e usa *trocar PIN*).

## Pontuação (já configurada)
Acerto de jogo 3 pts · Campeão 15 · Vice 10 · 3º 7 · 4º 5 · MVP 10 · Sidão 5 · Check-ins 5 · Revelação 5.
Para mudar valores: `src/rules.js` (CATS, GAME_PTS) **e** a função `ranking()` no `schema.sql`.

## Antes do dia do torneio (checklist)
- [ ] Criar 2 ou 3 contas de teste, palpitar, lançar um resultado e conferir o ranking.
- [ ] Criar um confronto de teste com início daqui a 2 minutos e confirmar que o palpite bloqueia.
- [ ] Apagar os confrontos de teste em Organizar → Jogos (os palpites de teste somem junto).
- [ ] No plano gratuito do Supabase, projetos ficam pausados após ~7 dias sem acesso. Abra o app na semana do torneio.

## Segurança em resumo
- Cada pessoa só vê e altera os **próprios palpites**; ninguém vê o palpite do outro.
- O ranking é calculado no banco, e só organizadores lançam resultados.
- O PIN de 4 números é prático, mas simples. Serve para um bolão entre conhecidos. Não reutilize senhas importantes.
- A chave `anon` é pública por natureza; a proteção está nas regras (RLS) do `schema.sql`.

## Observação técnica
O texto `-arena5` aparece em `src/rules.js` (PIN_SUFFIX) e em `supabase/schema.sql` (função `admin_reset_pin`). Se mudar um, mude o outro, senão o "Resetar PIN" deixa de funcionar.

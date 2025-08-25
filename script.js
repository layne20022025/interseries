/*
  script.js
  - Lógica completa do site Interclasse (Futsal e Vôlei)
  - Mantém dados somente em memória (offline)
  - Comentários explicam cada bloco para fácil manutenção
*/

// Configuração geral
const MAX_TEAMS = 16; // limite por modalidade
const MODALITIES = ["futsal", "volei"];

// Estado global da aplicação, separado por modalidade
const state = {
  modality: "futsal",
  teamsByModality: { futsal: [], volei: [] },
  bracketByModality: { futsal: null, volei: null },
  lockedByModality: { futsal: false, volei: false }
};

// Seletores de elementos da página
const modalitySelect = document.getElementById("modality-select");
const teamNameInput = document.getElementById("team-name");
const addTeamBtn = document.getElementById("add-team-btn");
const generateBracketBtn = document.getElementById("generate-bracket-btn");
const resetTournamentBtn = document.getElementById("reset-tournament-btn");
const teamListEl = document.getElementById("team-list");
const teamCountEl = document.getElementById("team-count");
const bracketContainerEl = document.getElementById("bracket-container");
const championBannerEl = document.getElementById("champion-banner");
const currentModalityBadge = document.getElementById("current-modality-label");
const lockWarningEl = document.getElementById("lock-warning");
const formEl = document.getElementById("team-form");
const exportBtn = document.getElementById("export-data-btn");
const importInput = document.getElementById("import-file-input");
const currentUser = window.__CURRENT_USER__ || null; // vindo de index.html

// Utilitários
function logInfo(message, payload) {
  console.log(`[INFO] ${message}`, payload ?? "");
}
function logError(message, payload) {
  console.error(`[ERRO] ${message}`, payload ?? "");
}

function sanitizeName(raw) {
  return String(raw || "").trim();
}

function isLocked(modality) {
  return state.lockedByModality[modality];
}

function setLocked(modality, locked) {
  state.lockedByModality[modality] = locked;
  updateFormLockUI();
}

function updateFormLockUI() {
  const locked = isLocked(state.modality);
  const msg = locked ?
    `A modalidade está com chaveamento gerado. Edite resultados ou clique em "Limpar torneio" para voltar a editar as equipes.` : "";
  lockWarningEl.textContent = msg;
  lockWarningEl.hidden = !locked;

  // Espectador: bloqueia edição
  const isSpectator = currentUser && currentUser.role === 'espectador';
  teamNameInput.disabled = locked || isSpectator;
  addTeamBtn.disabled = locked || isSpectator;
  generateBracketBtn.disabled = isSpectator;
  resetTournamentBtn.disabled = isSpectator;
  modalitySelect.disabled = false; // troca de modalidade sempre permitida
}

function setModality(modality) {
  if (!MODALITIES.includes(modality)) return;
  state.modality = modality;
  currentModalityBadge.textContent = modality === "futsal" ? "Futsal" : "Vôlei";
  teamNameInput.placeholder = modality === "futsal" ? "Ex.: 1ºA, 2ºB (Futsal)" : "Ex.: 1ºA, 2ºB (Vôlei)";
  renderTeams();
  renderBracket();
  updateFormLockUI();
  logInfo("Modalidade alterada", { modality });
}

// Persistência (localStorage)
const STORAGE_KEY = "interclasse:v1";

function persist() {
  try {
    const data = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, data);
    logInfo("Estado salvo no localStorage");
  } catch (err) {
    logError("Falha ao salvar no localStorage", err);
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Validação superficial
    if (saved && saved.teamsByModality && saved.bracketByModality && saved.lockedByModality) {
      state.modality = saved.modality ?? state.modality;
      state.teamsByModality = saved.teamsByModality;
      state.bracketByModality = saved.bracketByModality;
      state.lockedByModality = saved.lockedByModality;
      logInfo("Estado restaurado do localStorage");
    }
  } catch (err) {
    logError("Falha ao restaurar do localStorage", err);
  }
}

// Gestão de equipes
function addTeam() {
  if (isLocked(state.modality)) {
    logError("Não é possível adicionar equipes com chaveamento bloqueado.");
    return;
  }
  const name = sanitizeName(teamNameInput.value);
  if (!name) {
    logError("Nome da equipe inválido.");
    alert("Informe um nome válido para a equipe.");
    return;
  }
  const teams = state.teamsByModality[state.modality];
  if (teams.length >= MAX_TEAMS) {
    logError("Limite máximo de equipes atingido.");
    alert(`Máximo de ${MAX_TEAMS} equipes por modalidade.`);
    return;
  }
  const exists = teams.some(t => t.toLowerCase() === name.toLowerCase());
  if (exists) {
    logError("Equipe duplicada.");
    alert("Esta equipe já foi cadastrada nesta modalidade.");
    return;
  }
  teams.push(name);
  teamNameInput.value = "";
  renderTeams();
  logInfo("Equipe adicionada", { modality: state.modality, name });
  persist();
}

function removeTeam(index) {
  if (isLocked(state.modality)) {
    logError("Não é possível remover equipes com chaveamento bloqueado.");
    return;
  }
  const teams = state.teamsByModality[state.modality];
  const removed = teams.splice(index, 1)[0];
  renderTeams();
  logInfo("Equipe removida", { modality: state.modality, name: removed });
  persist();
}

function renderTeams() {
  const teams = state.teamsByModality[state.modality];
  teamListEl.innerHTML = "";
  teamCountEl.textContent = String(teams.length);

  teams.forEach((teamName, index) => {
    const li = document.createElement("li");
    li.className = "team-item";

    const span = document.createElement("span");
    span.className = "team-name";
    span.textContent = teamName;

    const actions = document.createElement("div");
    actions.className = "team-actions";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn";
    removeBtn.textContent = "Remover";
    removeBtn.disabled = isLocked(state.modality);
    removeBtn.addEventListener("click", () => removeTeam(index));

    actions.appendChild(removeBtn);
    li.appendChild(span);
    li.appendChild(actions);
    teamListEl.appendChild(li);
  });
}

// Chaveamento (estrutura e utilitários)
function nextPowerOfTwo(n) {
  if (n < 1) return 1;
  const p = Math.pow(2, Math.ceil(Math.log2(n)));
  return p;
}

function roundName(roundIndex, totalRounds) {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinal";
  if (remaining === 3) return "Quartas";
  if (remaining === 4) return "Oitavas";
  return `Rodada ${roundIndex + 1}`;
}

function createEmptyBracket(teams) {
  // Constrói a estrutura de rounds para copa simples, adicionando byes se necessário
  const totalTeams = teams.length;
  const target = nextPowerOfTwo(totalTeams);
  const byes = target - totalTeams; // byes = vagas automáticas
  const totalRounds = Math.log2(target);
  const rounds = [];

  // Round 0 - inicial
  const matchesRound0 = [];
  const entries = teams.map(name => ({ name }));
  // Insere byes no final da lista para preencher o target
  for (let i = 0; i < byes; i++) entries.push({ name: null });

  for (let i = 0; i < target; i += 2) {
    const a = entries[i] || { name: null };
    const b = entries[i + 1] || { name: null };
    matchesRound0.push({
      teamA: a.name,
      teamB: b.name,
      scoreA: null,
      scoreB: null,
      winner: null
    });
  }
  rounds.push(matchesRound0);

  // Demais rounds vazios
  for (let r = 1; r < totalRounds; r++) {
    const numMatches = target / Math.pow(2, r + 1);
    const roundMatches = [];
    for (let m = 0; m < numMatches; m++) {
      roundMatches.push({ teamA: null, teamB: null, scoreA: null, scoreB: null, winner: null });
    }
    rounds.push(roundMatches);
  }

  return rounds;
}

function autopropagateByes(rounds) {
  // Define vencedor automático quando um dos lados é bye (null)
  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r];
    for (let m = 0; m < round.length; m++) {
      const match = round[m];
      if ((match.teamA && !match.teamB) || (!match.teamA && match.teamB)) {
        match.winner = match.teamA || match.teamB;
        // Propaga para próxima rodada
        if (r < rounds.length - 1) {
          const nextMatchIndex = Math.floor(m / 2);
          const isA = m % 2 === 0;
          const nextMatch = rounds[r + 1][nextMatchIndex];
          if (isA) nextMatch.teamA = match.winner; else nextMatch.teamB = match.winner;
        }
      }
    }
  }
}

function clearDownstream(rounds, fromRoundIndex, fromMatchIndex) {
  // Limpa partidas dependentes a partir de certo ponto (ao editar um placar)
  for (let r = fromRoundIndex + 1; r < rounds.length; r++) {
    const round = rounds[r];
    for (let m = 0; m < round.length; m++) {
      const match = round[m];
      if (r === fromRoundIndex + 1) {
        // Apenas limpa o slot correspondente
        if (Math.floor(fromMatchIndex / 2) === m) {
          if (fromMatchIndex % 2 === 0) match.teamA = null; else match.teamB = null;
          match.scoreA = null; match.scoreB = null; match.winner = null;
        }
      } else {
        match.teamA = null; match.teamB = null; match.scoreA = null; match.scoreB = null; match.winner = null;
      }
    }
  }
}

function generateBracket() {
  const modality = state.modality;
  if (isLocked(modality)) {
    logError("Chaveamento já gerado para esta modalidade.");
    return;
  }
  const teams = state.teamsByModality[modality];
  if (teams.length < 2) {
    logError("Número insuficiente de equipes para gerar chaveamento.");
    alert("Cadastre pelo menos 2 equipes para gerar o chaveamento.");
    return;
  }

  const rounds = createEmptyBracket(teams);
  autopropagateByes(rounds);
  state.bracketByModality[modality] = rounds;
  setLocked(modality, true);
  renderTeams();
  renderBracket();
  logInfo("Chaveamento gerado", { modality, teams: teams.length });
  persist();
}

function onSaveScore(roundIndex, matchIndex, inputA, inputB) {
  const rounds = state.bracketByModality[state.modality];
  if (!rounds) return;
  const match = rounds[roundIndex][matchIndex];
  if (!match.teamA || !match.teamB) {
    logError("Partida sem duas equipes não aceita placar.");
    alert("Esta partida ainda não possui duas equipes definidas.");
    return;
  }

  const valA = Number(inputA.value);
  const valB = Number(inputB.value);
  const isValid = Number.isInteger(valA) && Number.isInteger(valB) && valA >= 0 && valB >= 0;
  if (!isValid) {
    logError("Placar inválido.");
    alert("Informe placares válidos (números inteiros >= 0).");
    return;
  }
  if (valA === valB) {
    logError("Empate não permitido em eliminatória.");
    alert("Empate não permitido. Ajuste os placares para definir um vencedor.");
    return;
  }

  // Registrar placar e vencedor
  match.scoreA = valA;
  match.scoreB = valB;
  match.winner = valA > valB ? match.teamA : match.teamB;

  // Propagar para próxima rodada
  if (roundIndex < rounds.length - 1) {
    const nextIndex = Math.floor(matchIndex / 2);
    const isA = matchIndex % 2 === 0;
    const nextMatch = rounds[roundIndex + 1][nextIndex];

    // Limpa dependentes primeiro para evitar inconsistência
    clearDownstream(rounds, roundIndex, matchIndex);

    if (isA) nextMatch.teamA = match.winner; else nextMatch.teamB = match.winner;
    // Se o oponente do próximo já existir de bye anterior, não definir vencedor automático aqui
  }

  // Se definimos vencedor da final, mostra campeão
  const isFinal = roundIndex === rounds.length - 1;
  if (isFinal) {
    championBannerEl.hidden = false;
    championBannerEl.textContent = `Campeão (${state.modality === 'futsal' ? 'Futsal' : 'Vôlei'}): ${match.winner}`;
  } else {
    championBannerEl.hidden = true;
    championBannerEl.textContent = "";
  }

  renderBracket();
  logInfo("Placar salvo", { roundIndex, matchIndex, scoreA: valA, scoreB: valB, winner: match.winner });
  persist();
}

function resetTournament() {
  const modality = state.modality;
  state.bracketByModality[modality] = null;
  setLocked(modality, false);
  championBannerEl.hidden = true;
  championBannerEl.textContent = "";
  renderTeams();
  renderBracket();
  logInfo("Torneio resetado", { modality });
  persist();
}

// Renderização do chaveamento
function renderBracket() {
  const rounds = state.bracketByModality[state.modality];
  bracketContainerEl.innerHTML = "";

  if (!rounds) {
    const info = document.createElement("p");
    info.className = "small";
    info.textContent = "Nenhum chaveamento gerado ainda.";
    bracketContainerEl.appendChild(info);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "rounds";

  const totalRounds = rounds.length;

  rounds.forEach((round, roundIndex) => {
    const roundEl = document.createElement("div");
    roundEl.className = "round";

    const title = document.createElement("h4");
    title.className = "round-title";
    title.textContent = roundName(roundIndex, totalRounds);

    const matchesEl = document.createElement("div");
    matchesEl.className = "matches";

    round.forEach((match, matchIndex) => {
      const matchEl = document.createElement("div");
      matchEl.className = "match" + (match.winner ? " winner" : "");

      const rowA = document.createElement("div");
      rowA.className = "team-row";
      const labelA = document.createElement("div");
      labelA.className = "team-label";
      labelA.textContent = match.teamA || "—";
      const inputsA = document.createElement("div");
      inputsA.className = "score-inputs";

      const rowB = document.createElement("div");
      rowB.className = "team-row";
      const labelB = document.createElement("div");
      labelB.className = "team-label";
      labelB.textContent = match.teamB || "—";
      const inputsB = document.createElement("div");
      inputsB.className = "score-inputs";

      if (match.teamA && match.teamB) {
        const inputA = document.createElement("input");
        inputA.type = "number";
        inputA.min = "0";
        inputA.value = match.scoreA ?? "";

        const inputB = document.createElement("input");
        inputB.type = "number";
        inputB.min = "0";
        inputB.value = match.scoreB ?? "";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "save-btn";
        saveBtn.textContent = "Salvar";
        saveBtn.addEventListener("click", () => onSaveScore(roundIndex, matchIndex, inputA, inputB));

        inputsA.appendChild(inputA);
        inputsB.appendChild(inputB);
        inputsB.appendChild(saveBtn);
      } else {
        const note = document.createElement("div");
        note.className = "inline-note";
        note.textContent = match.teamA || match.teamB ? "Vaga por bye" : "Aguardando definição";
        inputsB.appendChild(note);
      }

      rowA.appendChild(labelA);
      rowA.appendChild(inputsA);
      rowB.appendChild(labelB);
      rowB.appendChild(inputsB);

      matchEl.appendChild(rowA);
      matchEl.appendChild(rowB);
      matchesEl.appendChild(matchEl);
    });

    roundEl.appendChild(title);
    roundEl.appendChild(matchesEl);
    wrapper.appendChild(roundEl);
  });

  bracketContainerEl.appendChild(wrapper);
}

// Eventos de UI
formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  addTeam();
});

generateBracketBtn.addEventListener("click", () => generateBracket());

resetTournamentBtn.addEventListener("click", () => {
  const ok = confirm("Tem certeza que deseja limpar o torneio desta modalidade?");
  if (ok) resetTournament();
});

modalitySelect.addEventListener("change", (e) => setModality(e.target.value));

// Exportar/Importar
if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interclasse-${new Date().toISOString().slice(0,19)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      logInfo("Dados exportados com sucesso");
    } catch (err) {
      logError("Falha ao exportar dados", err);
      alert("Falha ao exportar. Veja o console.");
    }
  });
}

if (importInput) {
  importInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !data.teamsByModality || !data.bracketByModality || !data.lockedByModality) {
        throw new Error("Arquivo inválido");
      }
      state.modality = data.modality ?? state.modality;
      state.teamsByModality = data.teamsByModality;
      state.bracketByModality = data.bracketByModality;
      state.lockedByModality = data.lockedByModality;
      setModality(state.modality);
      renderTeams();
      renderBracket();
      updateFormLockUI();
      persist();
      logInfo("Dados importados com sucesso");
      alert("Dados importados com sucesso.");
    } catch (err) {
      logError("Falha ao importar dados", err);
      alert("Falha ao importar. Veja o console.");
    } finally {
      importInput.value = "";
    }
  });
}

// Inicialização da UI
(function init() {
  restore();
  setModality(state.modality || "futsal");
  renderTeams();
  renderBracket();
  updateFormLockUI();
  logInfo("Aplicação iniciada.");
})();

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
// Novos elementos da toolbar/toasts
const printBtn = document.getElementById("print-bracket-btn");
const exportBtn = document.getElementById("export-data-btn");
const importInput = document.getElementById("import-data-input");
const toastContainer = document.getElementById("toast-container");

// Utilitários
function logInfo(message, payload) {
  console.log(`[INFO] ${message}`, payload ?? "");
}
function logError(message, payload) {
  console.error(`[ERRO] ${message}`, payload ?? "");
}

// Toasts não obstrutivos
function showToast(text, type = "info") {
  try {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = text;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 300ms ease";
      setTimeout(() => toast.remove(), 320);
    }, 2200);
  } catch (err) {
    console.warn("Falha ao exibir toast", err);
  }
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
  persistState();
}

function updateFormLockUI() {
  const locked = isLocked(state.modality);
  const msg = locked ?
    `A modalidade está com chaveamento gerado. Edite resultados ou clique em "Limpar torneio" para voltar a editar as equipes.` : "";
  lockWarningEl.textContent = msg;
  lockWarningEl.hidden = !locked;

  teamNameInput.disabled = locked;
  addTeamBtn.disabled = locked;
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

// Gestão de equipes
function addTeam() {
  if (isLocked(state.modality)) {
    logError("Não é possível adicionar equipes com chaveamento bloqueado.");
    showToast("Chaveamento gerado: não é possível adicionar equipes.", "error");
    return;
  }
  const name = sanitizeName(teamNameInput.value);
  if (!name) {
    logError("Nome da equipe inválido.");
    showToast("Informe um nome válido para a equipe.", "error");
    return;
  }
  const teams = state.teamsByModality[state.modality];
  if (teams.length >= MAX_TEAMS) {
    logError("Limite máximo de equipes atingido.");
    showToast(`Máximo de ${MAX_TEAMS} equipes por modalidade.`, "error");
    return;
  }
  const exists = teams.some(t => t.toLowerCase() === name.toLowerCase());
  if (exists) {
    logError("Equipe duplicada.");
    showToast("Esta equipe já foi cadastrada nesta modalidade.", "error");
    return;
  }
  teams.push(name);
  teamNameInput.value = "";
  renderTeams();
  persistState();
  showToast("Equipe adicionada", "success");
  logInfo("Equipe adicionada", { modality: state.modality, name });
}

function removeTeam(index) {
  if (isLocked(state.modality)) {
    logError("Não é possível remover equipes com chaveamento bloqueado.");
    return;
  }
  const teams = state.teamsByModality[state.modality];
  const removed = teams.splice(index, 1)[0];
  renderTeams();
  persistState();
  showToast("Equipe removida", "info");
  logInfo("Equipe removida", { modality: state.modality, name: removed });
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
    showToast("Cadastre pelo menos 2 equipes para gerar o chaveamento.", "error");
    return;
  }

  const rounds = createEmptyBracket(teams);
  autopropagateByes(rounds);
  state.bracketByModality[modality] = rounds;
  setLocked(modality, true);
  renderTeams();
  renderBracket();
  persistState();
  showToast("Chaveamento gerado!", "success");
  logInfo("Chaveamento gerado", { modality, teams: teams.length });
}

function onSaveScore(roundIndex, matchIndex, inputA, inputB) {
  const rounds = state.bracketByModality[state.modality];
  if (!rounds) return;
  const match = rounds[roundIndex][matchIndex];
  if (!match.teamA || !match.teamB) {
    logError("Partida sem duas equipes não aceita placar.");
    showToast("Partida sem duas equipes.", "error");
    return;
  }

  const valA = Number(inputA.value);
  const valB = Number(inputB.value);
  const isValid = Number.isInteger(valA) && Number.isInteger(valB) && valA >= 0 && valB >= 0;
  if (!isValid) {
    logError("Placar inválido.");
    showToast("Informe placares inteiros >= 0.", "error");
    return;
  }
  if (valA === valB) {
    logError("Empate não permitido em eliminatória.");
    showToast("Empate não permitido.", "error");
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
    showToast(`Campeão: ${match.winner}`, "success");
  } else {
    championBannerEl.hidden = true;
    championBannerEl.textContent = "";
  }

  renderBracket();
  persistState();
  logInfo("Placar salvo", { roundIndex, matchIndex, scoreA: valA, scoreB: valB, winner: match.winner });
}

function resetTournament() {
  const modality = state.modality;
  state.bracketByModality[modality] = null;
  setLocked(modality, false);
  championBannerEl.hidden = true;
  championBannerEl.textContent = "";
  renderTeams();
  renderBracket();
  persistState();
  showToast("Torneio limpo.", "info");
  logInfo("Torneio resetado", { modality });
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

// Toolbar: imprimir, exportar e importar
if (printBtn) {
  printBtn.addEventListener("click", () => {
    window.print();
    showToast("Abrindo impressão...", "info");
  });
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    try {
      const data = exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
      a.download = `interclasse-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
      showToast("Exportado com sucesso.", "success");
    } catch (err) {
      logError("Falha ao exportar", err);
      showToast("Erro ao exportar.", "error");
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
      importData(data);
      showToast("Importado com sucesso.", "success");
    } catch (err) {
      logError("Falha ao importar", err);
      showToast("Arquivo inválido.", "error");
    } finally {
      e.target.value = ""; // permite reimportar o mesmo arquivo
    }
  });
}

// Persistência em localStorage
const LS_KEY = "interclasse_state_v1";
function persistState() {
  try {
    const data = exportData();
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Falha ao persistir state", err);
  }
}

function exportData() {
  return {
    modality: state.modality,
    teamsByModality: state.teamsByModality,
    bracketByModality: state.bracketByModality,
    lockedByModality: state.lockedByModality,
    version: 1
  };
}

function importData(data) {
  if (!data || typeof data !== "object") throw new Error("Dados inválidos");
  state.modality = MODALITIES.includes(data.modality) ? data.modality : "futsal";
  state.teamsByModality = data.teamsByModality ?? { futsal: [], volei: [] };
  state.bracketByModality = data.bracketByModality ?? { futsal: null, volei: null };
  state.lockedByModality = data.lockedByModality ?? { futsal: false, volei: false };
  setModality(state.modality);
  renderTeams();
  renderBracket();
  updateFormLockUI();
  persistState();
}

// Inicialização da UI
(function init() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      importData(data);
      logInfo("Estado restaurado do localStorage");
    } else {
      setModality("futsal");
      renderTeams();
      renderBracket();
      updateFormLockUI();
    }
  } catch (err) {
    console.warn("Falha ao restaurar state", err);
    setModality("futsal");
    renderTeams();
    renderBracket();
    updateFormLockUI();
  }
  logInfo("Aplicação iniciada.");
})();

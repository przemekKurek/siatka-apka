import { setupAttendanceImport } from "./attendance-import.js";

let players = [];
let activeAttendanceMatch = null;
const manualAttendance = new Map();
const voterView = new URLSearchParams(location.search).get("view") === "attendance";

if (voterView) {
  document.title = "Zapisy na siatkówkę";
  document.getElementById("team-draw").hidden = true;
  document.getElementById("attendance-voter").hidden = false;
}

// 🔹 ŁADOWANIE
async function loadPlayers() {
  const res = await fetch("players.json");
  if (!res.ok) throw new Error("Nie udało się wczytać listy zawodników.");
  players = await res.json();
  if (voterView) {
    const { setupAttendanceVoter } = await import("./attendance-voter.js");
    await setupAttendanceVoter(players);
    return;
  }

  renderPlayers();
  setupAttendanceImport(players, matched => {
    const present = new Set(matched.map(p => String(p.id)));
    if (activeAttendanceMatch) {
      for (const player of players) {
        const id = String(player.id);
        manualAttendance.set(id, present.has(id));
      }
    }
    replaceSelection(present);
  });

  const { setupAttendanceOrganizer } = await import("./attendance-organizer.js");
  await setupAttendanceOrganizer(players, (matchId, playerIds) => {
    if (activeAttendanceMatch !== matchId) manualAttendance.clear();
    activeAttendanceMatch = matchId;
    if (matchId) replaceSelection(new Set(playerIds), manualAttendance);
  });
}

function replaceSelection(present, overrides) {
  document.querySelectorAll("#players .player-card").forEach(card => {
    const id = String(players[card.dataset.index].id);
    card.classList.toggle("selected", overrides?.get(id) ?? present.has(id));
  });
}

// 🔹 LISTA ZAWODNIKÓW
function renderPlayers() {
  const container = document.getElementById("players");
  container.innerHTML = "";

  players.forEach((p, index) => {
    const div = document.createElement("div");
    div.className = "player-card";
    div.textContent = `${p.name} ${p.surname}`;
    div.dataset.index = index;

    div.onclick = () => {
      const selected = div.classList.toggle("selected");
      if (activeAttendanceMatch) manualAttendance.set(String(p.id), selected);
    };

    container.appendChild(div);
  });
}

// 🔹 PUNKTY
function calculateScore(p) {
  return p.atak + p.obrona + p.serwis + p.wystawa + (p.wzrost * 10);
}

// 🔹 ROZMIARY DRUŻYN
function getTeamSizes(n) {
  const map = {
    10: [5,5],
    11: [6,5],
    12: [6,6],
    13: [7,6],
    14: [7,7],
    15: [5,5,5],
    16: [6,5,5],
    17: [6,6,5],
    18: [6,6,6]
  };
  return map[n] || null;
}

// 🔹 LOSOWANIE
document.getElementById("generateBtn").onclick = () => {
  const selected = [];

  document.querySelectorAll(".player-card").forEach((card, i) => {
    if (card.classList.contains("selected")) {
      selected.push({...players[i]});
    }
  });

  const sizes = getTeamSizes(selected.length);

  if (!sizes) {
    alert("Wybierz 10–18 zawodników");
    return;
  }

  selected.forEach(p => {
    p.score = calculateScore(p);
    p.fullName = p.name + " " + p.surname;
  });

  let bestTeams = null;
  let bestScore = Infinity;

  for (let i = 0; i < 300; i++) {

    const shuffled = [...selected].sort(() => Math.random() - 0.5);

    const teams = sizes.map(() => []);
    let index = 0;

    sizes.forEach((size, t) => {
      for (let j = 0; j < size; j++) {
        teams[t].push(shuffled[index++]);
      }
    });

    const sums = teams.map(t => t.reduce((s,p)=>s+p.score,0));
    const women = teams.map(t => t.filter(p=>p.gender==="kobieta").length);

    const diffPoints = Math.max(...sums) - Math.min(...sums);
    const diffWomen = Math.max(...women) - Math.min(...women);

    let conflictPenalty = 0;
    teams.forEach(team => {
      team.forEach(p => {
        p.conflicts?.forEach(c => {
          if (team.some(t => t.fullName === c)) {
            conflictPenalty += 50;
          }
        });
      });
    });

    const score = diffPoints + diffWomen*30 + conflictPenalty*10;

    if (score < bestScore) {
      bestScore = score;
      bestTeams = teams;
    }
  }

  renderTeams(bestTeams);
};

// 🔹 TABELA DRUŻYN
function renderTeams(teams) {
  const container = document.getElementById("teams");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "teams-table";

  // nagłówek
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  teams.forEach((_, i) => {
    const th = document.createElement("th");
    th.textContent = "Drużyna " + (i+1);
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  // maksymalna długość drużyny
  const maxLen = Math.max(...teams.map(t => t.length));

  const tbody = document.createElement("tbody");

  for (let i = 0; i < maxLen; i++) {
    const row = document.createElement("tr");

    teams.forEach((team, teamIndex) => {
      const cell = document.createElement("td");

      if (team[i]) {
        const p = team[i];

        const wrapper = document.createElement("div");
        wrapper.textContent = p.name + " " + p.surname;

        // przyciski przenoszenia
        const left = document.createElement("button");
        left.textContent = "⬅";
        left.onclick = () => movePlayer(teams, teamIndex, i, -1);

        const right = document.createElement("button");
        right.textContent = "➡";
        right.onclick = () => movePlayer(teams, teamIndex, i, 1);

        wrapper.appendChild(left);
        wrapper.appendChild(right);

        cell.appendChild(wrapper);
      }

      row.appendChild(cell);
    });

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

// 🔹 PRZENOSZENIE
function movePlayer(teams, teamIndex, playerIndex, direction) {
  const newTeamIndex = teamIndex + direction;
  if (newTeamIndex < 0 || newTeamIndex >= teams.length) return;

  const player = teams[teamIndex].splice(playerIndex, 1)[0];
  teams[newTeamIndex].push(player);

  renderTeams(teams);
}

// START
loadPlayers().catch(() => {
  const status = document.getElementById(voterView ? "voter-status" : "players");
  status.textContent = "Nie udało się uruchomić aplikacji. Odśwież stronę i spróbuj ponownie.";
});

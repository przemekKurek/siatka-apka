let players = [];

// 🔹 ŁADOWANIE ZAWODNIKÓW
async function loadPlayers() {
  const res = await fetch("players.json");
  players = await res.json();
  renderPlayers();
}

// 🔹 RENDER LISTY
function renderPlayers() {
  const container = document.getElementById("players");
  container.innerHTML = "";

  players.forEach((p, index) => {
    const div = document.createElement("div");
    div.className = "player-card";
    div.textContent = `${p.name} ${p.surname}`;
    div.dataset.index = index;

    div.onclick = () => {
      div.classList.toggle("selected");
    };

    container.appendChild(div);
  });
}

// 🔹 OBLICZANIE PUNKTÓW
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

// 🔹 LOSOWANIE DRUŻYN (ULEPSZONE)
window.generateTeams = function() {
  const selected = [];

  document.querySelectorAll(".player-card").forEach((card, i) => {
    if (card.classList.contains("selected")) {
      selected.push({...players[i]});
    }
  });

  const n = selected.length;
  const sizes = getTeamSizes(n);

  if (!sizes) {
    alert("Wybierz od 10 do 18 zawodników");
    return;
  }

  // punktacja
  selected.forEach(p => {
    p.score = calculateScore(p);
    p.fullName = p.name + " " + p.surname;
  });

  let bestTeams = null;
  let bestScore = Infinity;

  const ITERATIONS = 300;

  for (let i = 0; i < ITERATIONS; i++) {

    const shuffled = [...selected].sort(() => Math.random() - 0.5);

    const teams = sizes.map(() => []);
    let index = 0;

    sizes.forEach((size, teamIndex) => {
      for (let j = 0; j < size; j++) {
        teams[teamIndex].push(shuffled[index++]);
      }
    });

    // 🔹 OCENA

    const sums = teams.map(team =>
      team.reduce((sum, p) => sum + p.score, 0)
    );

    const women = teams.map(team =>
      team.filter(p => p.gender === "kobieta").length
    );

    const maxSum = Math.max(...sums);
    const minSum = Math.min(...sums);
    const diffPoints = maxSum - minSum;

    const maxWomen = Math.max(...women);
    const minWomen = Math.min(...women);
    const diffWomen = maxWomen - minWomen;

    let conflictPenalty = 0;

    teams.forEach(team => {
      team.forEach(p => {
        if (!p.conflicts) return;

        p.conflicts.forEach(c => {
          if (team.some(t => t.fullName === c)) {
            conflictPenalty += 50;
          }
        });
      });
    });

    const totalScore =
      diffPoints * 1 +
      diffWomen * 30 +
      conflictPenalty * 10;

    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestTeams = teams;
    }
  }

  renderTeams(bestTeams);
};

// 🔹 RENDER DRUŻYN + PRZENOSZENIE
function renderTeams(teams) {
  const container = document.getElementById("teams");
  container.innerHTML = "";

  teams.forEach((team, teamIndex) => {
    const div = document.createElement("div");
    div.className = "team-card";

    const title = document.createElement("h3");
    title.textContent = "Drużyna " + (teamIndex + 1);
    div.appendChild(title);

    team.forEach((player, playerIndex) => {
      const pDiv = document.createElement("div");
      pDiv.textContent = player.name + " " + player.surname;

      const btnLeft = document.createElement("button");
      btnLeft.textContent = "⬅";
      btnLeft.onclick = () => movePlayer(teams, teamIndex, playerIndex, -1);

      const btnRight = document.createElement("button");
      btnRight.textContent = "➡";
      btnRight.onclick = () => movePlayer(teams, teamIndex, playerIndex, 1);

      pDiv.appendChild(btnLeft);
      pDiv.appendChild(btnRight);

      div.appendChild(pDiv);
    });

    container.appendChild(div);
  });
}

// 🔹 PRZENOSZENIE ZAWODNIKA
function movePlayer(teams, teamIndex, playerIndex, direction) {
  const newTeamIndex = teamIndex + direction;

  if (newTeamIndex < 0 || newTeamIndex >= teams.length) return;

  const player = teams[teamIndex].splice(playerIndex, 1)[0];
  teams[newTeamIndex].push(player);

  renderTeams(teams);
}

// 🔹 START
loadPlayers();
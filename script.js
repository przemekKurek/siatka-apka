import { collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const playersCol = collection(window.db, "players");

// Funkcja dodawania zawodnika
export function addPlayer() {
  const name = document.getElementById("name").value.trim();
  const surname = document.getElementById("surname").value.trim();
  if (!name || !surname) return alert("Wpisz imię i nazwisko");

  addDoc(playersCol, { name, surname })
    .then(() => {
      document.getElementById("name").value = "";
      document.getElementById("surname").value = "";
    });
}

// Nasłuchiwanie zmian w czasie rzeczywistym
onSnapshot(playersCol, snapshot => {
  const container = document.getElementById("players");
  container.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.className = "player-card";
    div.textContent = `${data.name} ${data.surname}`;
    container.appendChild(div);
  });
});

// Losowanie drużyn
window.generateTeams = function() {
  const teamCount = parseInt(document.getElementById("teamCount").value);
  if (!teamCount || teamCount < 2) return alert("Podaj co najmniej 2 drużyny");

  // Pobranie obecnych zawodników
  let players = [];
  const container = document.getElementById("players");
  container.querySelectorAll(".player-card").forEach(card => {
    players.push(card.textContent);
  });

  const shuffled = players.sort(() => Math.random() - 0.5);
  const teams = Array.from({ length: teamCount }, () => []);

  shuffled.forEach((p, i) => {
    teams[i % teamCount].push(p);
  });

  const teamsContainer = document.getElementById("teams");
  teamsContainer.innerHTML = "";
  teams.forEach((team, idx) => {
    const div = document.createElement("div");
    div.className = "team-card";
    div.innerHTML = `<strong>Drużyna ${idx + 1}</strong><br>` + team.join("<br>");
    teamsContainer.appendChild(div);
  });
};
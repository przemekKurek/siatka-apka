import { collection, addDoc, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const db = window.db;
const playersCol = collection(db, "players");

// -------------------- MODAL --------------------
const modal = document.getElementById("playerModal");
const addBtn = document.getElementById("addPlayerBtn");
const closeBtn = modal.querySelector(".close");
const form = document.getElementById("playerForm");
let editingDocId = null;

addBtn.onclick = () => {
  editingDocId = null;
  modal.style.display = "block";
  document.getElementById("modalTitle").textContent = "Dodaj zawodnika";
  form.reset();
}

closeBtn.onclick = () => modal.style.display = "none";
window.onclick = e => { if(e.target==modal) modal.style.display="none"; }

// -------------------- FIRESTORE --------------------
onSnapshot(playersCol, snapshot => {
  const container = document.getElementById("players");
  container.innerHTML = "";
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement("div");
    div.className = "player-card";
    div.textContent = `${data.name} ${data.surname}`;
    div.dataset.id = docSnap.id;
    div.onclick = () => div.classList.toggle("selected");

    // edit icon
    const edit = document.createElement("span");
    edit.textContent = "✏️";
    edit.className = "edit-icon";
    edit.onclick = e => {
      e.stopPropagation();
      editingDocId = docSnap.id;
      modal.style.display = "block";
      document.getElementById("modalTitle").textContent = "Edytuj zawodnika";
      document.getElementById("name").value = data.name;
      document.getElementById("surname").value = data.surname;
      document.getElementById("atak").value = data.atak;
      document.getElementById("obrona").value = data.obrona;
      document.getElementById("serwis").value = data.serwis;
      document.getElementById("wystawa").value = data.wystawa;
      document.getElementById("wzrost").value = data.wzrost;
      document.getElementById("gender").value = data.gender;
      document.getElementById("conflicts").value = (data.conflicts || []).join(", ");
    }
    div.appendChild(edit);
    container.appendChild(div);
  });
});

// -------------------- DODAJ / EDYTUJ ZAWODNIKA --------------------
form.onsubmit = async e => {
  e.preventDefault();
  const newData = {
    name: document.getElementById("name").value,
    surname: document.getElementById("surname").value,
    atak: parseInt(document.getElementById("atak").value),
    obrona: parseInt(document.getElementById("obrona").value),
    serwis: parseInt(document.getElementById("serwis").value),
    wystawa: parseInt(document.getElementById("wystawa").value),
    wzrost: parseInt(document.getElementById("wzrost").value),
    gender: document.getElementById("gender").value,
    conflicts: document.getElementById("conflicts").value.split(",").map(s=>s.trim()).filter(s=>s)
  };
  try {
    if(editingDocId){
      const d = doc(db, "players", editingDocId);
      await updateDoc(d, newData);
    } else {
      await addDoc(playersCol, newData);
    }
    modal.style.display="none";
  } catch(err){ alert("Błąd: "+err); }
}

// -------------------- LOSOWANIE DRUŻYN --------------------
document.getElementById("generateBtn").onclick = () => {
  const selectedCards = document.querySelectorAll(".player-card.selected");
  if(selectedCards.length < 2){ alert("Wybierz co najmniej 2 zawodników"); return; }
  const players = Array.from(selectedCards).map(c=>{
    const id = c.dataset.id;
    const name = c.textContent;
    const data = c.__data; // przypisane przy onSnapshot
    return {id, name, ...data};
  });

  const teamsContainer = document.getElementById("teams");
  teamsContainer.innerHTML = "";

  // Wyliczamy ilość drużyn i liczebność
  const n = players.length;
  let teamSizes;
  if(n<=14){
    teamSizes = [Math.ceil(n/2), Math.floor(n/2)];
  } else {
    // 3 drużyny
    const base = Math.floor(n/3);
    teamSizes = [base, base, n-2*base];
  }

  // Algorytm: sortujemy losowo, dzielimy na drużyny
  const shuffled = players.sort(()=>Math.random()-0.5);
  const teams = [];
  let idx=0;
  for(let size of teamSizes){
    teams.push(shuffled.slice(idx, idx+size));
    idx+=size;
  }

  // Render drużyn
  teams.forEach((t, i)=>{
    const div = document.createElement("div");
    div.className="team-card";
    div.innerHTML=`<strong>Drużyna ${i+1}</strong><br>`+t.map(p=>p.name).join("<br>");
    teamsContainer.appendChild(div);
  });
};
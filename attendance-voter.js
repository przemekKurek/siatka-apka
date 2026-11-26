const playerPreference = "siatka-attendance-player";
const matchDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Warsaw"
});

function readPlayerPreference() {
  try {
    return localStorage.getItem(playerPreference) ?? "";
  } catch {
    return "";
  }
}

function savePlayerPreference(playerId) {
  try {
    localStorage.setItem(playerPreference, playerId);
  } catch {
    // Głosowanie działa również bez zapamiętania nazwiska.
  }
}

export async function setupAttendanceVoter(players) {
  const section = document.getElementById("attendance-voter");
  const status = document.getElementById("voter-status");
  const date = document.getElementById("voter-date");
  const controls = document.getElementById("voter-controls");
  const playerSelect = document.getElementById("voter-player");
  const yesButton = document.getElementById("voter-yes");
  const noButton = document.getElementById("voter-no");
  let rememberedPlayer = readPlayerPreference();
  let match;
  let response = null;
  let saving = false;
  let message = "";
  let voteVersion = 0;
  let store;

  function render() {
    const optionsAvailable = Boolean(match) && playerSelect.options.length > 1;
    const canVote = optionsAvailable && match.acceptingVotes && !saving;
    const responseLabel = response === "yes" ? "Będę" : "Nie będę";

    date.textContent = match ? matchDateFormatter.format(match.startsAt) : "";
    controls.hidden = !optionsAvailable;
    playerSelect.disabled = !optionsAvailable || saving;
    yesButton.disabled = !canVote || !playerSelect.value;
    noButton.disabled = yesButton.disabled;
    yesButton.setAttribute("aria-pressed", String(response === "yes"));
    noButton.setAttribute("aria-pressed", String(response === "no"));

    if (message) {
      status.textContent = message;
    } else if (match === undefined) {
      status.textContent = "Wczytuję zapisy…";
    } else if (!match) {
      status.textContent = "Nie ma jeszcze terminu gry.";
    } else if (!match.acceptingVotes) {
      status.textContent = response
        ? `Zapisy zamknięte. Przesłana odpowiedź to „${responseLabel}”.`
        : "Zapisy zamknięte.";
    } else if (!optionsAvailable) {
      status.textContent = "Lista zawodników jest niedostępna.";
    } else if (saving) {
      status.textContent = "Zapisuję odpowiedź…";
    } else if (response) {
      status.textContent = `Zapisano odpowiedź „${responseLabel}”.`;
    } else {
      status.textContent = playerSelect.value
        ? "Wybierz odpowiedź."
        : "Wybierz swoje nazwisko.";
    }
  }

  async function loadPlayerResponse() {
    const version = ++voteVersion;
    response = null;
    saving = false;
    message = "";
    render();
    if (!match || !playerSelect.value) return;

    try {
      const savedResponse = await store.readVote(match.matchId, playerSelect.value);
      if (version === voteVersion) response = savedResponse;
    } catch {
      if (version === voteVersion) message = "Nie udało się odczytać poprzedniej odpowiedzi.";
    }
    if (version === voteVersion) render();
  }

  function receiveMatch(nextMatch) {
    const previousMatchId = match?.matchId;
    const previousPlayerId = playerSelect.value;
    match = nextMatch;
    const playerIds = new Set(match?.playerIds ?? []);
    const available = players.filter(player => playerIds.has(String(player.id)));
    playerSelect.replaceChildren(
      new Option("Wybierz swoje nazwisko", ""),
      ...available.map(player => new Option(`${player.name} ${player.surname}`, String(player.id)))
    );
    playerSelect.value = playerIds.has(rememberedPlayer) ? rememberedPlayer : "";
    if (match?.matchId !== previousMatchId || playerSelect.value !== previousPlayerId) {
      loadPlayerResponse();
    } else {
      render();
    }
  }

  function showConnectionError() {
    voteVersion += 1;
    match = null;
    response = null;
    saving = false;
    message = "Nie udało się wczytać zapisów. Odśwież stronę i spróbuj ponownie.";
    render();
  }

  async function submitVote(nextResponse) {
    if (!match?.acceptingVotes || !playerSelect.value || saving) return;
    if (!navigator.onLine) {
      message = "Połącz się z internetem i spróbuj ponownie.";
      render();
      return;
    }

    const version = ++voteVersion;
    saving = true;
    message = "";
    render();

    try {
      await store.saveVote(match.matchId, playerSelect.value, nextResponse);
      if (version === voteVersion) response = nextResponse;
    } catch (error) {
      if (version === voteVersion) {
        message = error.code === "permission-denied"
          ? "Odpowiedź mogła zostać zapisana na innym urządzeniu albo zapisy zostały zamknięte."
          : "Nie udało się zapisać odpowiedzi. Spróbuj ponownie.";
      }
    } finally {
      if (version === voteVersion) {
        saving = false;
        render();
      }
    }
  }

  playerSelect.addEventListener("change", () => {
    rememberedPlayer = playerSelect.value;
    savePlayerPreference(rememberedPlayer);
    loadPlayerResponse();
  });
  yesButton.addEventListener("click", () => submitVote("yes"));
  noButton.addEventListener("click", () => submitVote("no"));

  section.hidden = false;
  render();
  try {
    const { connectAttendance } = await import("./attendance-store.js");
    store = await connectAttendance();
    store.watchCurrent(receiveMatch, showConnectionError);
  } catch {
    showConnectionError();
  }
}

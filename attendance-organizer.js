const matchDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Warsaw"
});

export async function setupAttendanceOrganizer(players, syncSelection) {
  const status = document.getElementById("organizer-status");
  const login = document.getElementById("organizer-login");
  const loginButton = login.querySelector("button");
  const email = document.getElementById("organizer-email");
  const password = document.getElementById("organizer-password");
  const signOut = document.getElementById("organizer-sign-out");
  const settings = document.getElementById("organizer-settings");
  const matchForm = document.getElementById("organizer-match-form");
  const start = document.getElementById("organizer-start");
  const open = document.getElementById("organizer-open");
  const close = document.getElementById("organizer-close");
  const matchText = document.getElementById("organizer-match");
  const totals = document.getElementById("organizer-totals");
  const share = document.getElementById("organizer-share");
  const shareInput = document.getElementById("organizer-link");
  const voteLink = document.getElementById("organizer-voter-link");
  const shareUrl = new URL(location.href);
  shareUrl.searchParams.set("view", "attendance");
  shareUrl.hash = "";
  voteLink.href = shareUrl.href;
  shareInput.value = shareUrl.href;
  let store;
  let session;
  let match;
  let working = false;
  let stopMatch;
  let stopVotes;

  function render() {
    login.hidden = session !== null;
    signOut.hidden = !session;
    settings.hidden = !session?.authorized;
    loginButton.disabled = working;
    signOut.disabled = working;
    open.disabled = working || match === undefined;
    close.disabled = working || !match?.acceptingVotes;

    if (match) {
      const startsAt = matchDateFormatter.format(match.startsAt);
      matchText.textContent = `${startsAt} · ${match.acceptingVotes ? "zapisy otwarte" : "zapisy zamknięte"}`;
    } else {
      matchText.textContent = match === null ? "Nie ma jeszcze terminu gry." : "Wczytuję termin…";
    }
  }

  function receiveMatch(nextMatch) {
    const previousId = match?.matchId;
    match = nextMatch;
    render();
    if (match?.matchId === previousId) return;

    stopVotes?.();
    stopVotes = undefined;
    if (!match) {
      totals.textContent = "";
      syncSelection(null, []);
      return;
    }

    const matchId = match.matchId;
    const eligible = new Set(match.playerIds);
    syncSelection(matchId, []);
    totals.textContent = "Wczytuję odpowiedzi…";
    stopVotes = store.watchVotes(matchId, votes => {
      if (match?.matchId !== matchId) return;
      const currentVotes = votes.filter(vote => eligible.has(vote.playerId));
      const present = currentVotes.filter(vote => vote.response === "yes").map(vote => vote.playerId);
      const absent = currentVotes.filter(vote => vote.response === "no").length;
      totals.textContent = `${present.length} na tak · ${absent} na nie`;
      syncSelection(matchId, present);
    }, () => {
      if (match?.matchId === matchId) totals.textContent = "Nie udało się wczytać odpowiedzi.";
    });
  }

  function showConnectionError() {
    stopMatch?.();
    stopVotes?.();
    stopMatch = undefined;
    stopVotes = undefined;
    match = undefined;
    totals.textContent = "";
    syncSelection(null, []);
    status.textContent = "Nie udało się wczytać zapisów. Odśwież stronę i spróbuj ponownie.";
    render();
  }

  function receiveSession(nextSession) {
    session = nextSession;
    status.textContent = session && !session.authorized ? "To konto nie ma dostępu organizatora." : "";
    if (session?.authorized) {
      stopMatch ??= store.watchCurrent(receiveMatch, showConnectionError);
    } else {
      stopMatch?.();
      stopVotes?.();
      stopMatch = undefined;
      stopVotes = undefined;
      match = undefined;
      totals.textContent = "";
      syncSelection(null, []);
    }
    render();
  }

  async function runAction(action, errorMessage) {
    if (working) return;
    working = true;
    status.textContent = "";
    render();
    try {
      await action();
    } catch {
      status.textContent = errorMessage;
    } finally {
      working = false;
      render();
    }
  }

  login.addEventListener("submit", event => {
    event.preventDefault();
    if (!store || session !== null) return;
    runAction(async () => {
      await store.signInOrganizer(email.value, password.value);
      password.value = "";
    }, "Logowanie nie powiodło się. Sprawdź dane konta organizatora.");
  });

  signOut.addEventListener("click", () => {
    if (store && session) runAction(() => store.signOutOrganizer(), "Nie udało się wylogować.");
  });

  matchForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!session?.authorized || match === undefined) return;
    const startsAt = new Date(start.value).getTime();
    if (!Number.isFinite(startsAt)) return;
    runAction(async () => {
      await store.openMatch(startsAt, players.map(player => player.id));
      status.textContent = "Zapisy są otwarte. Możesz wysłać link graczom.";
    }, "Nie udało się otworzyć zapisów. Spróbuj ponownie.");
  });

  close.addEventListener("click", () => {
    if (!session?.authorized || !match?.acceptingVotes) return;
    runAction(async () => {
      await store.closeMatch(match.matchId);
      status.textContent = "Zapisy zamknięte.";
    }, "Nie udało się zamknąć zapisów. Sprawdź bieżący termin i spróbuj ponownie.");
  });

  share.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.href);
      shareInput.hidden = true;
      status.textContent = "Skopiowano link do zapisów.";
    } catch {
      shareInput.hidden = false;
      shareInput.focus();
      shareInput.select();
      status.textContent = "Skopiuj zaznaczony link.";
    }
  });

  try {
    const { connectAttendance } = await import("./attendance-store.js");
    store = await connectAttendance({ organizer: true });
    store.watchSession(receiveSession, showConnectionError);
  } catch {
    showConnectionError();
  }
}

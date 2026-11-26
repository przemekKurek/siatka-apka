import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, connectFirestoreEmulator, doc, getDoc, getFirestore, onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBBavHPLC-0SoMY53VjaGdD9To41HMorfM",
  authDomain: "siatkowka-marki.firebaseapp.com",
  projectId: "siatkowka-marki",
  storageBucket: "siatkowka-marki.firebasestorage.app",
  messagingSenderId: "42272616577",
  appId: "1:42272616577:web:2127d217dc60b8a1c8dd80",
  measurementId: "G-HLXWDR5D4F"
};

export async function connectAttendance({ organizer = false } = {}) {
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const useEmulator = localHost && new URLSearchParams(location.search).get("emulator") === "1";
  const role = organizer ? "organizer" : "player";
  const appName = useEmulator ? `attendance-demo-${role}` : `attendance-${role}`;
  const config = useEmulator ? {
    apiKey: "demo-siatka-apka",
    projectId: "demo-siatka-apka"
  } : firebaseConfig;
  const existingApp = getApps().find(app => app.name === appName);
  const app = existingApp ?? initializeApp(config, appName);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (useEmulator && !existingApp) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }

  const current = doc(db, "attendance", "current");
  let signingIn;

  async function getPlayerUid() {
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser.uid;

    signingIn ??= signInAnonymously(auth).finally(() => {
      signingIn = null;
    });
    return (await signingIn).user.uid;
  }

  function watchSession(onValue, onError) {
    let stopAdmin;
    const stopAuth = onAuthStateChanged(auth, user => {
      stopAdmin?.();
      if (!user) {
        onValue(null);
        return;
      }
      stopAdmin = onSnapshot(doc(db, "attendanceAdmins", user.uid), snapshot => {
        onValue({ authorized: snapshot.exists() });
      }, error => onError?.(error));
    }, error => onError?.(error));

    return () => {
      stopAdmin?.();
      stopAuth();
    };
  }

  async function readVote(matchId, playerId) {
    await auth.authStateReady();
    if (!auth.currentUser) return null;

    try {
      const vote = await getDoc(doc(db, "attendanceMatches", matchId, "votes", String(playerId)));
      return vote.data()?.response ?? null;
    } catch (error) {
      if (error.code === "permission-denied") return null;
      throw error;
    }
  }

  async function saveVote(matchId, playerId, response) {
    const ownerId = await getPlayerUid();
    const ballot = doc(db, "attendanceMatches", matchId, "votes", String(playerId));
    await runTransaction(db, async transaction => {
      await transaction.get(ballot);
      transaction.set(ballot, { ownerId, response });
    });
  }

  function openMatch(startsAt, playerIds) {
    const next = {
      matchId: crypto.randomUUID(),
      startsAt,
      acceptingVotes: true,
      playerIds: [...new Set(playerIds.map(String))]
    };

    return runTransaction(db, async transaction => {
      const snapshot = await transaction.get(current);
      const active = snapshot.data();
      if (active?.startsAt === startsAt) {
        if (!active.acceptingVotes) transaction.update(current, { acceptingVotes: true });
        return { ...active, acceptingVotes: true };
      }
      transaction.set(current, next);
      return next;
    });
  }

  function closeMatch(matchId) {
    return runTransaction(db, async transaction => {
      const snapshot = await transaction.get(current);
      const active = snapshot.data();
      if (active?.matchId !== matchId) {
        const error = new Error("Lista zapisów zmieniła się.");
        error.code = "match-changed";
        throw error;
      }
      transaction.update(current, { acceptingVotes: false });
    });
  }

  return {
    watchCurrent(onValue, onError) {
      return onSnapshot(current, snapshot => {
        onValue(snapshot.data() ?? null);
      }, error => onError?.(error));
    },
    watchSession,
    signInOrganizer: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    signOutOrganizer: () => signOut(auth),
    readVote,
    saveVote,
    watchVotes(matchId, onValue, onError) {
      return onSnapshot(collection(db, "attendanceMatches", matchId, "votes"), snapshot => {
        onValue(snapshot.docs.map(vote => ({ playerId: vote.id, response: vote.data().response })));
      }, error => onError?.(error));
    },
    openMatch,
    closeMatch
  };
}

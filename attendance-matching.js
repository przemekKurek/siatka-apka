const reactionHeadings = /^(?:(?:wszystkie|all)(?: reakcje)?(?: \d+)?|reakcje(?: na wiadomosc)?|message reactions|reactions)$/u;
const avatarMarker = /^(?:[O0]|\([O0]\))\s+/u;

function normalizeName(value) {
  return value.normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function matchAttendance(text, players) {
  const playersByName = new Map();
  for (const player of players) {
    const name = normalizeName(player.name);
    const surname = normalizeName(player.surname);
    if (!name || !surname) continue;

    for (const fullName of new Set([`${name} ${surname}`, `${surname} ${name}`])) {
      const candidates = playersByName.get(fullName) ?? [];
      candidates.push(player);
      playersByName.set(fullName, candidates);
    }
  }

  const matched = new Set();
  const unmatched = new Set();
  for (const rawLine of text.split(/\r\n|\n|\r/u)) {
    const line = rawLine.trim();
    const normalized = normalizeName(line);
    let candidates = playersByName.get(normalized);
    if (!candidates && avatarMarker.test(line)) {
      candidates = playersByName.get(normalizeName(line.replace(avatarMarker, "")));
    }

    if (candidates?.length === 1) {
      matched.add(candidates[0]);
    } else if (/\p{L}/u.test(normalized) && !reactionHeadings.test(normalized)) {
      unmatched.add(line);
    }
  }

  return { matched: [...matched], unmatched: [...unmatched] };
}

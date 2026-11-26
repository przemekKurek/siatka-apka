import { matchAttendance } from "./attendance-matching.js";

const ocrModule = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js";

async function createPolishWorker() {
  const { default: tesseract } = await import(ocrModule);
  const { createWorker, OEM, PSM } = tesseract;
  const worker = await new Promise((resolve, reject) => {
    createWorker("pol", OEM.LSTM_ONLY, { errorHandler: reject }).then(resolve, reject);
  });

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return worker;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

function showList(list, entries) {
  list.replaceChildren(...entries.map(entry => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));
  list.parentElement.hidden = entries.length === 0;
}

export function setupAttendanceImport(players, selectPlayers) {
  const panel = document.getElementById("attendance-import");
  const input = document.getElementById("attendance-files");
  const status = document.getElementById("attendance-status");
  const review = document.getElementById("attendance-review");
  const text = document.getElementById("attendance-text");
  const preview = document.getElementById("attendance-preview");
  const matchedList = document.getElementById("attendance-matched");
  const unmatchedList = document.getElementById("attendance-unmatched");
  const apply = document.getElementById("attendance-apply");
  const clear = document.getElementById("attendance-clear");
  let reading = false;
  let matched = [];

  function updatePreview() {
    const result = matchAttendance(text.value, players);
    matched = result.matched;
    showList(matchedList, matched.map(player => `${player.name} ${player.surname}`));
    showList(unmatchedList, result.unmatched);
    preview.hidden = matched.length === 0 && result.unmatched.length === 0;
    apply.disabled = reading || matched.length === 0;
  }

  async function readScreenshots(files) {
    if (!files.length || reading) return;

    reading = true;
    input.disabled = true;
    apply.disabled = true;
    clear.disabled = true;
    status.textContent = "Przygotowuję odczyt zrzutów…";
    const recognized = [];
    let worker;

    try {
      worker = await createPolishWorker();
      for (const [index, file] of files.entries()) {
        status.textContent = `Odczyt zrzutu ${index + 1} z ${files.length}…`;
        try {
          const { data } = await worker.recognize(file);
          const result = data.text.trim();
          if (result) recognized.push(result);
        } catch {
          // Uszkodzony plik nie przerywa odczytu pozostałych zrzutów.
        }
      }
    } catch {
      status.textContent = "Nie udało się uruchomić odczytu obrazu. Spróbuj ponownie lub wklej listę jako tekst.";
    } finally {
      reading = false;
      input.disabled = false;
      clear.disabled = false;
      review.hidden = false;
      text.value = [text.value.trim(), ...recognized].filter(Boolean).join("\n");
      updatePreview();
      if (worker) {
        if (recognized.length === files.length) {
          status.textContent = matched.length
            ? "Odczyt gotowy. Sprawdź dopasowania i zatwierdź obecnych."
            : "Odczyt gotowy. Sprawdź pisownię i uzupełnij odczytaną listę.";
        } else if (recognized.length) {
          status.textContent = `Odczytano ${recognized.length} z ${files.length} zrzutów. Brakujące zrzuty możesz dodać ponownie.`;
        } else {
          status.textContent = "Nie odczytano tekstu. Spróbuj dodać wyraźniejszy zrzut lub wklej listę jako tekst.";
        }
        await worker.terminate();
      }
    }
  }

  input.disabled = false;
  input.addEventListener("change", () => {
    const files = Array.from(input.files);
    input.value = "";
    readScreenshots(files);
  });

  document.addEventListener("paste", event => {
    if (!panel.open || reading) return;
    const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    readScreenshots(files);
  });

  text.addEventListener("input", () => {
    updatePreview();
    if (!reading) status.textContent = "";
  });

  apply.addEventListener("click", () => {
    if (reading || !matched.length) return;
    selectPlayers(matched);
    status.textContent = `Zaznaczono ${matched.length} z listy zawodników.`;
  });

  clear.addEventListener("click", () => {
    text.value = "";
    status.textContent = "";
    updatePreview();
    text.focus();
  });
}

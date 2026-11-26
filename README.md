# Zapisy na siatkówkę

W aplikacji rozwiń **Zapisy na grę**, zaloguj się jako organizator, ustaw termin i kliknij **Otwórz zapisy**. Przycisk **Kopiuj link do zapisów** kopiuje stały link, który możesz przypiąć na grupie w Messengerze. Ten sam link pokazuje bieżący termin po otwarciu nowych zapisów.

Gracz wybiera swoje nazwisko i klika **Będę** albo **Nie będę**. Przeglądarka zapamiętuje nazwisko, a odpowiedź można zmienić z tej samej sesji. Osoby z odpowiedzią **Będę** są automatycznie zaznaczane na liście organizatora.

## Pierwsze uruchomienie w Firebase

1. W projekcie `siatkowka-marki` otwórz **Authentication → Sign-in method** i włącz **Anonymous** oraz **Email/Password**.
2. W **Authentication → Users** utwórz konto organizatora i skopiuj jego UID.
3. W bazie Cloud Firestore utwórz dokument `attendanceAdmins/<UID>`. Może zawierać pole `enabled` o wartości `true`. Istnienie dokumentu nadaje uprawnienia organizatora.
4. Opublikuj reguły z `firestore.rules`. Jeżeli projekt ma własne reguły dla innych funkcji, zachowaj je i dodaj reguły zapisów do odpowiedniego bloku `match`. W projekcie bez innych reguł możesz wdrożyć ten plik przez CLI.

```powershell
firebase deploy --only firestore:rules --project siatkowka-marki
```

## Test lokalny

Uruchom emulatory Authentication i Firestore z izolowanym projektem `demo-siatka-apka`.

```powershell
firebase emulators:start --only auth,firestore --project demo-siatka-apka
```

Uruchom osobno serwer HTTP dla katalogu aplikacji. Na adresie `localhost` lub `127.0.0.1` dodaj do URL `?emulator=1`. Konto organizatora i dokument `attendanceAdmins/<UID>` utwórz w emulatorach. Link skopiowany z widoku organizatora wskaże ekran głosowania korzystający z tych samych emulatorów.

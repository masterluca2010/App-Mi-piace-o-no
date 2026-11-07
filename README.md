# Mi piace o no?

Un'app per ricordare quali prodotti ti piacciono e quali no.
Scansioni il codice a barre e poi scorri la scheda:

| Gesto | Risultato |
|---|---|
| Scorri a **destra** → | 👍 Mi piace |
| Scorri a **sinistra** ← | 👎 Non mi piace |
| Trascina in **basso** ↓ | 🤔 Forse (da decidere più avanti) |

Se scansioni un prodotto che hai già valutato, l'app ti dice **"Già provato!"** e mostra il giudizio e la data della prima volta. Puoi anche cambiare idea scorrendo di nuovo.

## Caratteristiche

- **Gratis, per sempre**: niente intelligenza artificiale, abbonamenti, account o pubblicità.
- **Nomi e foto dei prodotti** presi da [Open Food Facts](https://world.openfoodfacts.org) (e dai database "gemelli" per cosmetici, animali e altri prodotti), un archivio libero e gratuito. Se un prodotto non c'è, scrivi tu il nome.
- **Leggerissima**: l'app pesa meno di 100 KB. Per ogni prodotto salva solo testo (nome, marca, data, giudizio, indirizzo della foto), circa 300 byte: **1000 prodotti ≈ 0,3 MB**. Le foto non vengono salvate sul telefono.
- **I dati restano sul telefono**: dal menu ⋮ puoi fare un **backup**, che puoi salvare su Drive o mandarti via email, e poi **ripristinarlo**.
- Elenco diviso in Mi piace / No / Forse, con ricerca per nome, marca o codice.
- Luce del flash per scansionare nei posti bui e inserimento del codice a mano.
- Il tasto "indietro" di Android funziona normalmente.

## Installarla sul telefono (POCO / Android)

È una **web app installabile** (PWA): si installa da Chrome, senza Play Store e senza file APK, e si apre a schermo intero come un'app normale, con la sua icona.

1. Apri con **Chrome** l'indirizzo dell'app (vedi la sezione qui sotto).
2. Tocca il menu **⋮** in alto a destra, poi **"Installa app"** (oppure **"Aggiungi a schermata Home"**).
3. Apri l'app dall'icona, tocca **Scansiona** e consenti l'uso della fotocamera.

### Pubblicare l'app (una volta sola, gratis con GitHub Pages)

1. Unisci questo lavoro al branch `main`.
2. Su GitHub apri **Settings → Pages**.
3. In "Build and deployment" scegli **Source: Deploy from a branch**, poi **Branch: `main`** e cartella **`/ (root)`**, e premi **Save**.
4. Dopo un paio di minuti l'app è online all'indirizzo
   **https://masterluca2010.github.io/App-Mi-piace-o-no/**

Gli aggiornamenti futuri arrivano da soli: basta riaprire l'app.

## Struttura dei file

| File | Contenuto |
|---|---|
| `index.html`, `style.css` | Le schermate e la grafica |
| `app.js` | Scanner, ricerca dei prodotti, swipe, elenco, backup |
| `db.js` | Archivio locale (IndexedDB) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installazione e avvio rapido |
| `vendor/` | Lettore di codici a barre di riserva (open source, licenza MIT). Viene caricato solo se il telefono non ne ha uno integrato. |

Per provarla sul computer: `python3 -m http.server` nella cartella del progetto, poi apri http://localhost:8000.

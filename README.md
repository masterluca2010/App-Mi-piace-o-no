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

### Opzione 1: APK (consigliata)

1. Dal telefono apri questo link e scarica il file:
   **https://github.com/masterluca2010/App-Mi-piace-o-no/releases/latest/download/mi-piace-o-no.apk**
2. Apri il file scaricato. Android ti chiederà di **consentire l'installazione da questa fonte** (Chrome o Gestione file): consenti e torna indietro.
3. Premi **Installa**. Se compare un avviso di Play Protect, scegli **Installa comunque**: l'app non viene dallo Play Store, ma è sicura.
4. Apri l'app e consenti l'uso della **fotocamera**.

**Aggiornamenti**: quando c'è una versione nuova, scarica di nuovo l'APK dallo stesso link e installalo sopra. I tuoi prodotti restano dove sono.

### Opzione 2: web app da Chrome

Apri **https://masterluca2010.github.io/App-Mi-piace-o-no/** con Chrome, poi tocca **⋮ → Installa app**. Si aggiorna da sola.

> Le due versioni sono separate: i prodotti salvati in una non compaiono nell'altra. Per passarli dall'una all'altra usa backup e ripristino.

### Come vengono pubblicate

- **APK**: a ogni modifica di `main`, GitHub compila l'APK gratis (`.github/workflows/apk.yml`) e lo pubblica nelle *Releases*. L'app web viene inserita nell'APK con [Capacitor](https://capacitorjs.com) (cartella `android/`).
- **Web app**: a ogni modifica di `main`, il codice viene copiato sul branch `gh-pages` (`.github/workflows/pubblica.yml`) e pubblicato con GitHub Pages.
- La chiave di firma (`android/app/mipiace.keystore`) è inclusa nel progetto apposta: serve a far sì che ogni nuovo APK possa aggiornare quello già installato. Va bene per un'app personale installata a mano, ma non va usata per pubblicare l'app sul Play Store.

## Struttura dei file

| File | Contenuto |
|---|---|
| `index.html`, `style.css` | Le schermate e la grafica |
| `app.js` | Scanner, ricerca dei prodotti, swipe, elenco, backup |
| `db.js` | Archivio locale (IndexedDB) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installazione e avvio rapido |
| `android/`, `capacitor.config.json`, `package.json` | Progetto Android che crea l'APK |
| `vendor/` | Lettore di codici a barre di riserva (open source, licenza MIT). Viene caricato solo se il telefono non ne ha uno integrato. |

Per provarla sul computer: `python3 -m http.server` nella cartella del progetto, poi apri http://localhost:8000.

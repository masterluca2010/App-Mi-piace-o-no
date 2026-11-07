// Copia i file dell'app web nella cartella "www", che finisce dentro l'APK.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const files = ['index.html', 'style.css', 'app.js', 'db.js', 'manifest.webmanifest', 'icons', 'vendor'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of files) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
console.log('www pronta');

'use strict';

/* ================= Utilità ================= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const VERDICT = {
  like:    { label: 'Mi piace',     emoji: '👍', past: 'Ti piaceva' },
  dislike: { label: 'Non mi piace', emoji: '👎', past: 'Non ti piaceva' },
  maybe:   { label: 'Forse',        emoji: '🤔', past: 'Era nei "forse"' },
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(msg, actionLabel, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  if (actionLabel) {
    const b = document.createElement('button');
    b.textContent = actionLabel;
    b.onclick = () => { el.classList.remove('show'); action(); };
    el.appendChild(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), actionLabel ? 5000 : 2500);
}

const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };

/* ================= Navigazione ================= */
// Il tasto "indietro" di Android riporta sempre all'elenco.
function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  if (id !== 'screen-scan') stopCamera();
  if (id === 'screen-home') renderList();
}

function go(id) {
  if (history.state?.screen) history.replaceState({ screen: id }, '');
  else history.pushState({ screen: id }, '');
  show(id);
}

function goHome() {
  if (history.state?.screen) history.back(); // scatena popstate → show home
  else show('screen-home');
}

window.addEventListener('popstate', () => {
  if ($('#manual').open) $('#manual').close();
  if ($('#menu').open) $('#menu').close();
  show(history.state?.screen || 'screen-home');
});

/* ================= Elenco ================= */
let currentTab = 'like';
let allProducts = [];

async function renderList() {
  allProducts = await DB.all();
  allProducts.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  for (const v of Object.keys(VERDICT)) {
    $(`#count-${v}`).textContent = allProducts.filter((p) => p.verdict === v).length;
  }

  const q = $('#search').value.trim().toLowerCase();
  const items = allProducts.filter((p) => {
    if (q) return `${p.name} ${p.brand} ${p.code}`.toLowerCase().includes(q); // la ricerca guarda tutte le liste
    return p.verdict === currentTab;
  });

  const list = $('#list');
  list.innerHTML = items.map((p) => `
    <li class="item" data-code="${escapeHtml(p.code)}">
      ${p.image
        ? `<img class="thumb" src="${escapeHtml(p.image)}" loading="lazy" alt="" onerror="this.outerHTML='<div class=&quot;thumb&quot;>📦</div>'">`
        : '<div class="thumb">📦</div>'}
      <div class="item-text">
        <div class="item-name">${q ? VERDICT[p.verdict].emoji + ' ' : ''}${escapeHtml(p.name || 'Senza nome')}</div>
        <div class="item-sub">${escapeHtml(p.brand ? p.brand + ' · ' : '')}dal ${fmtDate(p.firstSeen)}</div>
      </div>
    </li>`).join('');

  const empty = $('#empty');
  if (items.length) {
    empty.classList.add('hidden');
  } else {
    empty.classList.remove('hidden');
    empty.innerHTML = q
      ? 'Nessun prodotto trovato.'
      : allProducts.length
        ? `Nessun prodotto in "${VERDICT[currentTab].label}".`
        : 'Ancora nessun prodotto.<br>Premi <b>Scansiona</b> e inquadra il codice a barre di un prodotto.';
  }
}

$$('.tab').forEach((t) => t.addEventListener('click', () => {
  currentTab = t.dataset.tab;
  $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#search').value = '';
  renderList();
}));

$('#search').addEventListener('input', renderList);

$('#list').addEventListener('click', async (e) => {
  const li = e.target.closest('.item');
  if (!li) return;
  const p = await DB.get(li.dataset.code);
  if (p) openCard(p, p, false, true);
});

/* ================= Scanner ================= */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
let stream = null;
let detector = null;
let scanning = false;
let lastCode = null;
let torchOn = false;

async function getDetector() {
  if (detector) return detector;
  let Detector = window.BarcodeDetector;
  if (Detector) {
    try {
      const supported = await Detector.getSupportedFormats();
      if (!supported.includes('ean_13')) Detector = null;
    } catch (_) { Detector = null; }
  }
  if (!Detector) {
    // Riserva: lettore open source incluso, caricato solo se il telefono non ne ha uno integrato.
    const mod = await import('./vendor/barcode-detector.js');
    Detector = mod.BarcodeDetector;
  }
  const supported = await Detector.getSupportedFormats().catch(() => FORMATS);
  detector = new Detector({ formats: FORMATS.filter((f) => supported.includes(f)) });
  return detector;
}

// Controlla la cifra di controllo dei codici EAN/UPC per evitare letture sbagliate.
function validCode(code, format) {
  if (!/^\d+$/.test(code)) return format === 'code_128' || format === 'code_39';
  if (!['ean_13', 'ean_8', 'upc_a'].includes(format)) return code.length >= 6;
  const digits = code.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

async function startScan() {
  go('screen-scan');
  $('#scan-hint').textContent = 'Avvio fotocamera…';
  lastCode = null;
  try {
    const [det, s] = await Promise.all([
      getDetector(),
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      }),
    ]);
    if (!$('#screen-scan').classList.contains('active')) { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s;
    const video = $('#video');
    video.srcObject = stream;
    await video.play();

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    $('#btn-torch').classList.toggle('hidden', !caps.torch);
    if (caps.focusMode?.includes('continuous')) {
      track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }

    $('#scan-hint').textContent = 'Inquadra il codice a barre';
    scanning = true;
    scanLoop(det, video);
  } catch (err) {
    console.error(err);
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    $('#scan-hint').textContent = denied ? 'Permesso fotocamera negato' : 'Fotocamera non disponibile';
    toast(denied ? 'Consenti l\'uso della fotocamera nelle impostazioni del browser' : 'Non riesco ad aprire la fotocamera: scrivi il codice a mano');
  }
}

async function scanLoop(det, video) {
  if (!scanning) return;
  try {
    if (video.readyState >= 2) {
      const codes = await det.detect(video);
      const hit = codes.find((c) => validCode(c.rawValue, c.format));
      if (hit) {
        // Serve leggere lo stesso codice due volte di fila: evita errori.
        if (hit.rawValue === lastCode) {
          scanning = false;
          vibrate(80);
          stopCamera();
          handleCode(hit.rawValue);
          return;
        }
        lastCode = hit.rawValue;
      }
    }
  } catch (err) { console.warn(err); }
  setTimeout(() => scanLoop(det, video), 120);
}

function stopCamera() {
  scanning = false;
  torchOn = false;
  $('#btn-torch').classList.remove('on');
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  $('#video').srcObject = null;
}

$('#btn-scan').addEventListener('click', startScan);
$('#btn-scan-close').addEventListener('click', goHome);
$('#btn-torch').addEventListener('click', async () => {
  const track = stream?.getVideoTracks()[0];
  if (!track) return;
  torchOn = !torchOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    $('#btn-torch').classList.toggle('on', torchOn);
  } catch (_) { torchOn = false; }
});

$('#btn-manual').addEventListener('click', () => {
  stopCamera();
  $('#manual-code').value = '';
  $('#manual').showModal();
  setTimeout(() => $('#manual-code').focus(), 50);
});
$('#btn-manual-cancel').addEventListener('click', () => { $('#manual').close(); startScan(); });
$('#manual').addEventListener('cancel', () => setTimeout(startScan)); // tasto indietro sul riquadro
$('#manual-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('#manual-code').value.replace(/\D/g, '');
  if (code.length < 6) return;
  $('#manual').close();
  handleCode(code);
});

/* ================= Ricerca prodotto (gratuita) ================= */
// Database liberi della famiglia Open Food Facts: nessuna chiave, nessun costo.
const SOURCES = [
  'https://world.openfoodfacts.org',
  'https://world.openbeautyfacts.org',
  'https://world.openproductsfacts.org',
  'https://world.openpetfoodfacts.org',
];
const FIELDS = 'product_name,product_name_it,generic_name_it,brands,image_front_url,image_front_small_url,image_url,image_small_url';

async function fetchJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; } finally { clearTimeout(t); }
}

async function lookup(code) {
  for (const base of SOURCES) {
    const data = await fetchJson(`${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
    const p = data && data.status === 1 && data.product;
    if (p && (p.product_name || p.product_name_it || p.brands)) {
      return {
        name: (p.product_name_it || p.product_name || p.generic_name_it || '').trim(),
        brand: (p.brands || '').split(',')[0].trim(),
        image: p.image_front_small_url || p.image_small_url || '',
        imageLarge: p.image_front_url || p.image_url || '',
      };
    }
  }
  return null;
}

async function handleCode(code) {
  const existing = await DB.get(code);
  if (existing) {
    vibrate([60, 60, 60]);
    openCard(existing, existing);
    return;
  }
  const draft = { code, name: '', brand: '', image: '', imageLarge: '' };
  openCard(draft, null, true);
  const info = await lookup(code);
  if (currentCard?.product.code !== code) return; // l'utente è già andato oltre
  if (info) {
    Object.assign(currentCard.product, info);
    fillCard(currentCard.product, '');
  } else {
    fillCard(currentCard.product, navigator.onLine
      ? 'Prodotto non trovato nel database: scrivi tu il nome.'
      : 'Sei offline: scrivi tu il nome del prodotto.');
    $('#card-name').focus();
  }
}

/* ================= Scheda prodotto + swipe ================= */
let currentCard = null; // { product, existing }

function openCard(product, existing, loading = false, fromList = false) {
  currentCard = { product: { ...product }, existing };
  go('screen-card');

  const card = $('#card');
  card.classList.remove('animate');
  card.style.transform = '';
  card.style.opacity = '';
  setStamps(0, 0);

  $('#card-title').textContent = fromList ? 'Il tuo giudizio' : existing ? 'Già provato!' : 'Nuovo prodotto';
  $('#btn-card-delete').classList.toggle('hidden', !existing);

  const banner = $('#known-banner');
  if (existing) {
    const v = VERDICT[existing.verdict];
    banner.className = `known-banner ${existing.verdict}`;
    banner.innerHTML = `${v.emoji} ${v.past}<small>Prima volta: ${fmtDate(existing.firstSeen)}` +
      (existing.updatedAt && existing.updatedAt.slice(0, 10) !== existing.firstSeen.slice(0, 10)
        ? ` · ultimo giudizio: ${fmtDate(existing.updatedAt)}` : '') +
      ' · scorri per cambiare idea</small>';
  } else {
    banner.className = 'known-banner hidden';
  }

  $$('.vote').forEach((b) => b.classList.toggle('current', existing?.verdict === b.dataset.verdict));
  fillCard(currentCard.product, loading ? 'Cerco il prodotto…' : '');
}

function fillCard(p, status) {
  const img = $('#card-img');
  const wrap = img.parentElement;
  const src = p.imageLarge || p.image;
  wrap.classList.toggle('noimg', !src);
  img.onerror = () => wrap.classList.add('noimg');
  if (src) img.src = src; else img.removeAttribute('src');
  $('#card-name').value = p.name || '';
  $('#card-brand').value = p.brand || '';
  $('#card-code').textContent = `Codice: ${p.code}`;
  $('#card-status').textContent = status;
}

function readCardInputs() {
  currentCard.product.name = $('#card-name').value.trim();
  currentCard.product.brand = $('#card-brand').value.trim();
}

async function vote(verdict, direction) {
  if (!currentCard) return;
  readCardInputs();
  const { product, existing } = currentCard;
  const now = new Date().toISOString();
  const record = {
    code: product.code,
    name: product.name,
    brand: product.brand,
    image: product.image || '',
    imageLarge: product.imageLarge || '',
    verdict,
    firstSeen: existing?.firstSeen || now,
    updatedAt: now,
  };
  currentCard = null;
  vibrate(30);

  // animazione di uscita
  const card = $('#card');
  card.classList.add('animate');
  const out = { like: 'translate(130vw, 0) rotate(25deg)', dislike: 'translate(-130vw, 0) rotate(-25deg)', maybe: 'translate(0, 110vh)' };
  card.style.transform = direction || out[verdict];
  card.style.opacity = '0';

  await DB.put(record);
  setTimeout(() => {
    currentTab = verdict;
    $$('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === verdict));
    $('#search').value = '';
    goHome();
    toast(`${VERDICT[verdict].emoji} Salvato in "${VERDICT[verdict].label}"`, 'ANNULLA', async () => {
      if (existing) await DB.put(existing); else await DB.remove(record.code);
      renderList();
    });
  }, 250);
}

$$('.vote').forEach((b) => b.addEventListener('click', () => vote(b.dataset.verdict)));

$('#btn-card-back').addEventListener('click', async () => {
  // Se hai solo corretto il nome di un prodotto già salvato, lo aggiorniamo.
  if (currentCard?.existing) {
    readCardInputs();
    const { product, existing } = currentCard;
    if (product.name !== existing.name || product.brand !== existing.brand) {
      await DB.put({ ...existing, name: product.name, brand: product.brand });
    }
  }
  currentCard = null;
  goHome();
});

$('#btn-card-delete').addEventListener('click', async () => {
  if (!currentCard?.existing) return;
  const old = currentCard.existing;
  if (!confirm(`Eliminare "${old.name || old.code}" dall'elenco?`)) return;
  await DB.remove(old.code);
  currentCard = null;
  goHome();
  toast('Prodotto eliminato', 'ANNULLA', async () => { await DB.put(old); renderList(); });
});

// ---- gesti di trascinamento ----
const SWIPE_X = 90;
const SWIPE_Y = 110;
let drag = null;

function setStamps(dx, dy) {
  const like = Math.max(0, Math.min(1, dx / SWIPE_X));
  const dislike = Math.max(0, Math.min(1, -dx / SWIPE_X));
  const maybe = dy > Math.abs(dx) ? Math.max(0, Math.min(1, dy / SWIPE_Y)) : 0;
  $('.stamp-like').style.opacity = maybe ? 0 : like;
  $('.stamp-dislike').style.opacity = maybe ? 0 : dislike;
  $('.stamp-maybe').style.opacity = maybe;
}

const cardEl = $('#card');
cardEl.addEventListener('pointerdown', (e) => {
  if (e.target.closest('input') || !currentCard) return;
  document.activeElement?.blur();
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
  cardEl.setPointerCapture(e.pointerId);
  cardEl.classList.remove('animate');
});

cardEl.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.dx = e.clientX - drag.x;
  drag.dy = Math.max(-40, e.clientY - drag.y); // verso l'alto si muove poco
  cardEl.style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 18}deg)`;
  setStamps(drag.dx, drag.dy);
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { dx, dy } = drag;
  drag = null;
  if (dy > SWIPE_Y && dy > Math.abs(dx)) return vote('maybe');
  if (dx > SWIPE_X) return vote('like');
  if (dx < -SWIPE_X) return vote('dislike');
  cardEl.classList.add('animate');
  cardEl.style.transform = '';
  setStamps(0, 0);
}
cardEl.addEventListener('pointerup', endDrag);
cardEl.addEventListener('pointercancel', endDrag);

/* ================= Menu, backup ================= */
$('#btn-menu').addEventListener('click', async () => {
  const all = await DB.all();
  const kb = Math.max(1, Math.round(new Blob([JSON.stringify(all)]).size / 1024));
  $('#stats').textContent = `${all.length} prodotti salvati · circa ${kb} KB di spazio occupato.`;
  $('#menu').showModal();
});
$('#btn-menu-close').addEventListener('click', () => $('#menu').close());

$('#btn-export').addEventListener('click', async () => {
  const all = await DB.all();
  const blob = new Blob([JSON.stringify({ app: 'mi-piace-o-no', version: 1, exportedAt: new Date().toISOString(), products: all }, null, 1)], { type: 'application/json' });
  const name = `mipiace-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  // Su Android si apre il menu "Condividi" (Drive, email, WhatsApp…); altrimenti si scarica.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup Mi piace o no' }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const incoming = (Array.isArray(data) ? data : data.products || [])
      .filter((p) => p && p.code && VERDICT[p.verdict]);
    const current = new Map((await DB.all()).map((p) => [p.code, p]));
    const merged = incoming.map((p) => {
      const c = current.get(p.code);
      if (!c) return p;
      const newer = (p.updatedAt || '') > (c.updatedAt || '') ? p : c;
      return { ...newer, firstSeen: [p.firstSeen, c.firstSeen].filter(Boolean).sort()[0] };
    });
    await DB.putMany(merged);
    $('#menu').close();
    renderList();
    toast(`Ripristinati ${merged.length} prodotti`);
  } catch (err) {
    console.error(err);
    toast('File di backup non valido');
  }
});

/* ================= Avvio ================= */
show('screen-home');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ═══════════════════════════════════════════════
   Mobile Dev — app.js v4 (Firebase)
═══════════════════════════════════════════════ */

import {
  onAuthReady, signInWithGoogle, signOutUser, getCurrentUser, seedDemoData,
  getVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle,
  getEntries, getEntry, createEntry, updateEntry, deleteEntry,
  getVehicleStats,
} from './db.js';

// ─── STATE ──────────────────────────────────
const State = {
  currentPage:      'home',
  activeVehicleId:  null,
  historyFilter:    'all',
  editingEntryId:   null,
  editingVehicleId: null,
};

// ─── TYPES ──────────────────────────────────
const TYPES = {
  entretien:  { label:'Entretien',  ico:'🔧', color:'blue'   },
  carburant:  { label:'Carburant',  ico:'⛽', color:'teal'   },
  reparation: { label:'Réparation', ico:'🛠️',  color:'orange' },
  assurance:  { label:'Assurance',  ico:'📄', color:'green'  },
  taxe:       { label:'Taxe',       ico:'🏛️',  color:'purple' },
  controle:   { label:'Contrôle',   ico:'✅', color:'yellow' },
  pneus:      { label:'Pneus',      ico:'⚫', color:'muted'  },
  achat:      { label:'Achat',      ico:'🛒', color:'red'    },
  autre:      { label:'Autre',      ico:'📌', color:'muted'  },
};

const COLORS = ['#4d8eff','#20d070','#ff7043','#a78bfa','#fbbf24','#ff4757','#00cec9','#fd79a8'];

// ─── UTILS ──────────────────────────────────
const fmt    = n => Number(n).toLocaleString('fr-BE');
const fmtEur = n => (n ? fmt(Math.round(n)) : '0') + '€';
const fmtDate = d => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-BE', { day:'2-digit', month:'2-digit', year:'numeric' });
};
const today = () => new Date().toISOString().slice(0, 10);

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function showLoader(show) {
  document.getElementById('app-loader').style.display = show ? 'flex' : 'none';
}

// ─── NAVIGATION ─────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  State.currentPage = page;
  renderPage(page);
}

async function renderPage(p) {
  showLoader(true);
  try {
    if (p === 'home')    await renderHome();
    if (p === 'garage')  await renderGarage();
    if (p === 'history') await renderHistory();
    if (p === 'stats')   await renderStats();
  } finally {
    showLoader(false);
  }
}

// ─── HOME ───────────────────────────────────
async function renderHome() {
  const vehicles = await getVehicles();
  if (!State.activeVehicleId || !vehicles.find(v => v.id === State.activeVehicleId)) {
    State.activeVehicleId = vehicles[0]?.id || null;
  }

  const pillsWrap = document.getElementById('home-pills');
  pillsWrap.innerHTML = '';
  vehicles.forEach(v => {
    const pill = document.createElement('div');
    pill.className = 'v-pill' + (v.id === State.activeVehicleId ? ' active' : '');
    pill.innerHTML = `<span class="pill-dot" style="background:${v.color||'#4d8eff'}"></span>${v.name}`;
    pill.onclick = () => { State.activeVehicleId = v.id; renderHome(); };
    pillsWrap.appendChild(pill);
  });

  const vehicle = vehicles.find(v => v.id === State.activeVehicleId) || null;
  if (!vehicle) {
    document.getElementById('home-panel').innerHTML =
      `<div class="empty-state"><div class="empty-ico">🚗</div><p>Aucun véhicule.<br>Rendez-vous dans <b>Garage</b> pour en ajouter un.</p></div>`;
    document.getElementById('home-next-service').innerHTML = '';
    document.getElementById('home-recent').innerHTML = '';
    return;
  }
  const stats = await getVehicleStats(vehicle.id);
  renderVehiclePanel(vehicle, stats);
  renderNextService(vehicle, stats);
  await renderRecentEntries(vehicle);
}

function renderVehiclePanel(vehicle, stats) {
  const panel   = document.getElementById('home-panel');
  const hasPhoto = !!vehicle.photo;
  const heroBg  = hasPhoto
    ? `background-image:url('${vehicle.photo}');background-size:cover;background-position:center;`
    : '';
  const glow = `radial-gradient(circle at 70% 50%, ${vehicle.color||'#4d8eff'}28 0%, transparent 65%)`;

  panel.innerHTML = `
    <div class="v-panel">
      <div class="v-hero${hasPhoto?' has-photo':''}">
        <div class="v-hero-bg${hasPhoto?' has-photo':''}" style="${heroBg}"></div>
        <div class="v-hero-overlay"></div>
        <div class="v-hero-glow" style="background:${glow}"></div>
        <div class="v-hero-emoji">🚗</div>
        <div class="v-hero-name">${vehicle.brand?vehicle.brand+' ':''}${vehicle.name}</div>
        <div class="v-hero-sub">${[vehicle.model,vehicle.year,vehicle.fuel].filter(Boolean).join(' · ')}</div>
        <div class="v-hero-photo-fab" onclick="triggerPhotoUpload('${vehicle.id}')" title="Changer la photo">📷</div>
      </div>
      <div class="v-stats-grid">
        <div class="v-stat">
          <div class="v-stat-val">${vehicle.mileage ? fmt(vehicle.mileage) : '—'}</div>
          <div class="v-stat-lbl">km actuels</div>
        </div>
        <div class="v-stat">
          <div class="v-stat-val">${stats?.costPerKm ? stats.costPerKm.toFixed(2)+'€' : '—'}</div>
          <div class="v-stat-lbl">coût/km (tout incl.)</div>
        </div>
        <div class="v-stat">
          <div class="v-stat-val green">${stats ? fmtEur(stats.totalOther) : '—'}</div>
          <div class="v-stat-lbl">frais hors carbu</div>
        </div>
        <div class="v-stat">
          <div class="v-stat-val fuel">${stats ? fmtEur(stats.totalFuel) : '—'}</div>
          <div class="v-stat-lbl">carburant total</div>
        </div>
      </div>
    </div>`;
}

function renderNextService(vehicle, stats) {
  const wrap  = document.getElementById('home-next-service');
  const addBtn = `<div class="v-action-full" onclick="openEntryForm()" style="margin:0 16px 16px;border-radius:14px;border:1px solid var(--border)">
    <span class="v-action-ico">➕</span>
    <span class="v-action-txt">Ajouter une entrée</span>
  </div>`;

  if (!vehicle.serviceInterval) {
    wrap.innerHTML = `
      <div class="next-service-banner" onclick="openVehicleForm('${vehicle.id}')">
        <div class="nsb-ico">🔧</div>
        <div class="nsb-body">
          <div class="nsb-label">Prochain entretien</div>
          <div class="nsb-no-interval">Définir l'intervalle dans la fiche véhicule →</div>
        </div>
      </div>
      ${addBtn}`;
    return;
  }

  const ns = stats?.nextService;
  if (!ns) {
    wrap.innerHTML = `
      <div class="next-service-banner">
        <div class="nsb-ico">🔧</div>
        <div class="nsb-body">
          <div class="nsb-label">Prochain entretien</div>
          <div class="nsb-no-interval">Aucun entretien enregistré</div>
        </div>
      </div>
      ${addBtn}`;
    return;
  }

  let statusClass, ico, mainTxt;
  if (ns.remaining <= 0) {
    statusClass = 'overdue'; ico = '🚨';
    mainTxt = `Dépassé de ${fmt(Math.abs(ns.remaining))} km !`;
  } else if (ns.remaining <= 2000) {
    statusClass = 'soon'; ico = '⚠️';
    mainTxt = `Dans ${fmt(ns.remaining)} km`;
  } else {
    statusClass = 'ok'; ico = '✅';
    mainTxt = `Dans ${fmt(ns.remaining)} km`;
  }

  wrap.innerHTML = `
    <div class="next-service-banner ${statusClass}">
      <div class="nsb-ico">${ico}</div>
      <div class="nsb-body">
        <div class="nsb-label">Prochain entretien</div>
        <div class="nsb-main ${statusClass}">${mainTxt}</div>
        <div class="nsb-sub">Prévu à ${fmt(ns.nextKm)} km · Dernier à ${fmt(ns.lastKm)} km (${fmtDate(ns.lastDate)})</div>
      </div>
    </div>
    ${addBtn}`;
}

async function renderRecentEntries(vehicle) {
  const entries = (await getEntries(vehicle.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const wrap = document.getElementById('home-recent');
  wrap.innerHTML = `<div class="sec-header"><span class="sec-title">Récent</span><span class="sec-link" onclick="navigate('history')">Tout voir →</span></div>`;

  if (!entries.length) {
    wrap.innerHTML += `<div class="empty-state"><div class="empty-ico">📋</div><p>Aucune entrée</p></div>`;
    return;
  }
  const tl = document.createElement('div');
  tl.className = 'timeline';
  entries.forEach(e => tl.appendChild(buildEntryEl(e, false)));
  wrap.appendChild(tl);
}

// ─── HISTORY ────────────────────────────────
async function renderHistory() {
  const vehicles = await getVehicles();
  if (!State.activeVehicleId || !vehicles.find(v => v.id === State.activeVehicleId)) {
    State.activeVehicleId = vehicles[0]?.id || null;
  }

  const pillsWrap = document.getElementById('history-pills');
  pillsWrap.innerHTML = '';
  vehicles.forEach(v => {
    const pill = document.createElement('div');
    pill.className = 'v-pill' + (v.id === State.activeVehicleId ? ' active' : '');
    pill.innerHTML = `<span class="pill-dot" style="background:${v.color||'#4d8eff'}"></span>${v.name}`;
    pill.onclick = () => { State.activeVehicleId = v.id; renderHistory(); };
    pillsWrap.appendChild(pill);
  });

  const filterBar = document.getElementById('history-filters');
  filterBar.innerHTML = '';
  [{ key:'all', label:'Tous' }, ...Object.entries(TYPES).map(([k,t]) => ({ key:k, label:t.label }))]
    .forEach(f => {
      const pill = document.createElement('div');
      pill.className = 'fpill' + (State.historyFilter === f.key ? ' active' : '');
      pill.textContent = f.label;
      pill.onclick = () => { State.historyFilter = f.key; renderHistory(); };
      filterBar.appendChild(pill);
    });

  const vehicle = vehicles.find(v => v.id === State.activeVehicleId);
  const wrap = document.getElementById('history-timeline');
  wrap.innerHTML = '';
  if (!vehicle) { wrap.innerHTML = '<div class="empty-state"><p>Sélectionnez un véhicule</p></div>'; return; }

  let entries = (await getEntries(vehicle.id)).sort((a,b) => new Date(b.date) - new Date(a.date));
  if (State.historyFilter !== 'all') entries = entries.filter(e => e.type === State.historyFilter);

  if (!entries.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-ico">📭</div><p>Aucune entrée</p></div>';
    return;
  }

  const byYear = {};
  entries.forEach(e => {
    const y = e.date ? new Date(e.date).getFullYear() : 'N/A';
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(e);
  });

  const tl = document.createElement('div');
  tl.className = 'timeline';
  Object.keys(byYear).sort((a,b) => b - a).forEach(year => {
    const badge = document.createElement('div');
    badge.className = 'year-badge';
    badge.innerHTML = `<span class="year-badge-txt">${year}</span><div class="year-badge-line"></div>`;
    tl.appendChild(badge);
    byYear[year].forEach(e => tl.appendChild(buildEntryEl(e, true)));
  });
  wrap.appendChild(tl);
}

// ─── BUILD ENTRY ELEMENT ────────────────────
function buildEntryEl(entry, showActions) {
  const t = TYPES[entry.type] || TYPES.autre;
  const el = document.createElement('div');
  el.className = 't-entry';
  const isFuel  = entry.type === 'carburant';
  const costFree = !entry.cost || parseFloat(entry.cost) === 0;
  const costClass = isFuel ? 'fuel' : costFree ? 'free' : '';
  const costTxt   = costFree && !isFuel ? 'Gratuit' : fmtEur(entry.cost);

  const ppl = (isFuel && entry.liters && entry.cost)
    ? (parseFloat(entry.cost) / parseFloat(entry.liters)).toFixed(3) + '€/L'
    : null;

  const fuelChips = isFuel
    ? `<div class="t-fuel-chips">
        ${entry.liters ? `<div class="fuel-chip">${entry.liters} L</div>` : ''}
        ${ppl ? `<div class="fuel-chip">${ppl}</div>` : ''}
       </div>`
    : '';

  const actions = showActions
    ? `<div class="t-entry-actions">
        <div class="t-act t-act-edit" onclick="openEntryForm('${entry.id}')">✏️ Modifier</div>
        <div class="t-act t-act-del"  onclick="confirmDeleteEntry('${entry.id}')">🗑 Supprimer</div>
       </div>`
    : '';

  el.innerHTML = `
    <div class="t-dot ${entry.type}">${t.ico}</div>
    <div class="t-card">
      <div class="t-card-main" onclick="openEntryForm('${entry.id}')">
        <div class="t-top">
          <div class="t-desc">${entry.description || '—'}</div>
          <div class="t-cost ${costClass}">${costTxt}</div>
        </div>
        <div class="t-meta">
          ${fmtDate(entry.date)}${entry.mileage ? ' · '+fmt(entry.mileage)+' km' : ''}${entry.provider ? ' · '+entry.provider : ''}
        </div>
        ${fuelChips}
      </div>
      ${actions}
    </div>`;
  return el;
}

// ─── GARAGE ─────────────────────────────────
async function renderGarage() {
  const vehicles = await getVehicles();
  const wrap = document.getElementById('garage-list');
  wrap.innerHTML = '';

  for (const v of vehicles) {
    const stats   = await getVehicleStats(v.id);
    const hasPhoto = !!v.photo;
    const heroBg  = hasPhoto
      ? `background-image:url('${v.photo}');background-size:cover;background-position:center;`
      : `background:linear-gradient(135deg,${v.color||'#1a3366'}22,${v.color||'#4d8eff'}44);`;

    const card = document.createElement('div');
    card.className = 'garage-card';
    card.innerHTML = `
      <div class="garage-card-hero" style="${heroBg}">
        ${!hasPhoto ? '<span style="font-size:52px">🚗</span>' : ''}
      </div>
      <div class="garage-card-body">
        <div class="garage-card-name">${v.brand?v.brand+' ':''}${v.name}</div>
        <div class="garage-card-sub">${[v.model,v.year,v.fuel].filter(Boolean).join(' · ')||'Infos à compléter'}</div>
        <div class="garage-card-stats">
          <div>
            <div class="gcs-val">${v.mileage ? fmt(v.mileage)+' km' : '—'}</div>
            <div class="gcs-lbl">Kilométrage</div>
          </div>
          <div>
            <div class="gcs-val">${stats ? fmtEur(stats.totalOther) : '—'}</div>
            <div class="gcs-lbl">Frais</div>
          </div>
          <div>
            <div class="gcs-val">${stats?.entryCount||0}</div>
            <div class="gcs-lbl">Entrées</div>
          </div>
        </div>
        <div class="garage-card-actions">
          <div class="gc-btn gc-btn-detail" onclick="garageDetail('${v.id}')">📋 Détail</div>
          <div class="gc-btn gc-btn-edit"   onclick="openVehicleForm('${v.id}')">✏️ Modifier</div>
          <div class="gc-btn gc-btn-del"    onclick="confirmDeleteVehicle('${v.id}')">🗑</div>
        </div>
      </div>`;
    wrap.appendChild(card);
  }

  const addCard = document.createElement('div');
  addCard.className = 'garage-add-card';
  addCard.innerHTML = `<div class="garage-add-ico">➕</div><div class="garage-add-lbl">Ajouter un véhicule</div>`;
  addCard.onclick = () => openVehicleForm();
  wrap.appendChild(addCard);
}

function garageDetail(vehicleId) {
  State.activeVehicleId = vehicleId;
  navigate('home');
}

// ─── STATS ──────────────────────────────────
async function renderStats() {
  const vehicles = await getVehicles();
  if (!State.activeVehicleId || !vehicles.find(v => v.id === State.activeVehicleId)) {
    State.activeVehicleId = vehicles[0]?.id || null;
  }

  const pillsWrap = document.getElementById('stats-pills');
  pillsWrap.innerHTML = '';
  vehicles.forEach(v => {
    const pill = document.createElement('div');
    pill.className = 'v-pill' + (v.id === State.activeVehicleId ? ' active' : '');
    pill.innerHTML = `<span class="pill-dot" style="background:${v.color||'#4d8eff'}"></span>${v.name}`;
    pill.onclick = () => { State.activeVehicleId = v.id; renderStats(); };
    pillsWrap.appendChild(pill);
  });

  const v = vehicles.find(vv => vv.id === State.activeVehicleId);
  const wrap = document.getElementById('stats-content');
  if (!v) { wrap.innerHTML = ''; return; }

  const s = await getVehicleStats(v.id);
  const entries = await getEntries(v.id);

  // ── Calculs coût mensuel ──
  const purchaseDate = v.purchaseDate ? new Date(v.purchaseDate) : null;
  const now = new Date();
  const monthsOwned = purchaseDate
    ? Math.max(1, (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth()))
    : 1;
  const byTypeMontly = {};
  Object.entries(s.byType).forEach(([type, cost]) => {
    byTypeMontly[type] = cost / monthsOwned;
  });
  const totalMonthly = (s.totalOther + s.totalFuel) / monthsOwned;
  const maxMonthly = Math.max(...Object.values(byTypeMontly), 1);

  // ── Calculs évolution annuelle (frais uniquement, hors carburant) ──
  const fraisOnlyByYear = {};
  entries.filter(e => e.type !== 'carburant').forEach(e => {
    const y = e.date ? new Date(e.date).getFullYear() : null;
    if (!y) return;
    fraisOnlyByYear[y] = (fraisOnlyByYear[y] || 0) + (parseFloat(e.cost) || 0);
  });
  const evoYears = Object.keys(fraisOnlyByYear).sort((a, b) => a - b);
  const currentYear = now.getFullYear();
  // Extrapoler l'année en cours sur 12 mois
  const fraisOnlyByYearExtrap = { ...fraisOnlyByYear };
  if (fraisOnlyByYearExtrap[currentYear] !== undefined) {
    const monthsPassed = now.getMonth() + 1;
    fraisOnlyByYearExtrap[currentYear] = Math.round(fraisOnlyByYearExtrap[currentYear] / monthsPassed * 12);
  }
  const maxFrais = Math.max(...evoYears.map(y => fraisOnlyByYearExtrap[y] || 0), 1);
  // Tendance globale : comparaison première vs dernière année complète
  const fullYears = evoYears.filter(y => parseInt(y) < currentYear);
  let tendance = null, tendancePct = null;
  if (fullYears.length >= 2) {
    const first = fraisOnlyByYear[fullYears[0]];
    const last  = fraisOnlyByYear[fullYears[fullYears.length - 1]];
    tendancePct = Math.round((last - first) / first * 100);
    tendance = tendancePct > 0 ? 'up' : 'down';
  }
  // % évolution année vs précédente
  const evoPct = {};
  evoYears.forEach((y, i) => {
    if (i === 0) { evoPct[y] = null; return; }
    const prev = fraisOnlyByYear[evoYears[i - 1]];
    const curr = fraisOnlyByYearExtrap[y];
    evoPct[y] = prev > 0 ? Math.round((curr - prev) / prev * 100) : null;
  });

  // ── Calculs carburant ──
  const fuelEntries = entries.filter(e => e.type === 'carburant' && e.liters > 0 && e.mileage > 0);
  // Conso aux 100 par année
  const consoByYear = {};
  const costByYear  = {};
  entries.filter(e => e.type === 'carburant' && e.liters > 0).forEach(e => {
    const y = e.date ? new Date(e.date).getFullYear() : null;
    if (!y) return;
    if (!consoByYear[y]) { consoByYear[y] = { liters: 0, cost: 0 }; }
    consoByYear[y].liters += parseFloat(e.liters) || 0;
    consoByYear[y].cost   += parseFloat(e.cost)   || 0;
  });
  // Km parcourus par année (estimé via km des entrées carbu)
  const kmByYear = {};
  const sortedFuel = entries.filter(e => e.type === 'carburant' && e.mileage > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  sortedFuel.forEach((e, i) => {
    const y = new Date(e.date).getFullYear();
    if (i === 0) return;
    const prev = sortedFuel[i - 1];
    const km = (e.mileage || 0) - (prev.mileage || 0);
    if (km > 0) kmByYear[y] = (kmByYear[y] || 0) + km;
  });
  const consoYears = Object.keys(consoByYear).sort((a,b) => a - b);
  const maxLiters  = Math.max(...consoYears.map(y => consoByYear[y].liters), 1);
  const avgPricePerL = s.totalLiters > 0 ? s.totalFuel / s.totalLiters : 0;

  // Records carburant
  const fuelWithPpl = entries
    .filter(e => e.type === 'carburant' && e.liters > 0 && e.cost > 0)
    .map(e => ({ ...e, ppl: parseFloat(e.cost) / parseFloat(e.liters) }));
  const cheapest = fuelWithPpl.length ? fuelWithPpl.reduce((a, b) => a.ppl < b.ppl ? a : b) : null;
  const priciest = fuelWithPpl.length ? fuelWithPpl.reduce((a, b) => a.ppl > b.ppl ? a : b) : null;

  // ── Calculs échéances ──
  const deadlines = _computeDeadlines(v, s, entries);
  const deadlineTotal3m = deadlines
    .filter(d => d.monthsAway !== null && d.monthsAway <= 3)
    .reduce((sum, d) => sum + d.amount, 0);

  // ── Render barres par type (coût mensuel) ──
  const typeColors = {
    entretien:'var(--blue)', reparation:'var(--orange)', assurance:'var(--green)',
    taxe:'var(--purple)', controle:'var(--yellow)', pneus:'var(--muted2)',
    carburant:'var(--teal)', achat:'var(--red)', autre:'var(--muted)'
  };
  const monthlyBars = Object.entries(byTypeMontly)
    .filter(([, v]) => v > 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([type, mCost]) => {
      const t = TYPES[type] || TYPES.autre;
      const pct = (mCost / maxMonthly * 100).toFixed(1);
      return `<div class="bar-row">
        <div class="bar-label-ico">${t.ico} ${t.label}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${typeColors[type]||'var(--muted)'}"></div></div>
        <div class="bar-val">${fmtEur(mCost)}</div>
      </div>`;
    }).join('');

  // ── Render barres carburant par année ──
  const fuelBars = consoYears.map(y => {
    const pct = (consoByYear[y].liters / maxLiters * 100).toFixed(1);
    const isCurrentYear = parseInt(y) === now.getFullYear();
    return `<div class="bar-row">
      <div class="bar-label">${y}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:var(--teal);${isCurrentYear?'opacity:0.55':''}"></div></div>
      <div class="bar-val teal">${Math.round(consoByYear[y].liters)} L</div>
    </div>`;
  }).join('');

  const recordsHtml = (cheapest && priciest) ? `
    <div class="fuel-records">
      <div class="fuel-record green">
        <div class="fuel-record-ico">🏆</div>
        <div class="fuel-record-body">
          <div class="fuel-record-lbl">Moins cher</div>
          <div class="fuel-record-val">${cheapest.ppl.toFixed(3)}€/L</div>
          <div class="fuel-record-sub">${fmtDate(cheapest.date)}${cheapest.provider ? ' · '+cheapest.provider : ''}</div>
        </div>
      </div>
      <div class="fuel-record red">
        <div class="fuel-record-ico">📈</div>
        <div class="fuel-record-body">
          <div class="fuel-record-lbl">Plus cher</div>
          <div class="fuel-record-val">${priciest.ppl.toFixed(3)}€/L</div>
          <div class="fuel-record-sub">${fmtDate(priciest.date)}${priciest.provider ? ' · '+priciest.provider : ''}</div>
        </div>
      </div>
    </div>` : '';

  // ── Render échéances ──
  const deadlineRows = deadlines.map(d => {
    let badge, badgeCls;
    if (d.monthsAway === null)       { badge = d.badgeTxt; badgeCls = 'badge-muted'; }
    else if (d.monthsAway <= 1)      { badge = 'Ce mois';  badgeCls = 'badge-warn'; }
    else if (d.monthsAway <= 3)      { badge = `${d.monthsAway} mois`; badgeCls = 'badge-soon'; }
    else                             { badge = `${d.monthsAway} mois`; badgeCls = 'badge-muted'; }
    const urgent = d.monthsAway !== null && d.monthsAway <= 1;
    return `<div class="deadline-row${urgent?' deadline-urgent':''}">
      <div class="deadline-ico" style="background:${d.bg}">${d.ico}</div>
      <div class="deadline-body">
        <div class="deadline-title">${d.label}</div>
        <div class="deadline-sub">${d.sub}</div>
      </div>
      <div class="deadline-right">
        <div class="deadline-amount">${fmtEur(d.amount)}</div>
        <div class="deadline-badge ${badgeCls}">${badge}</div>
      </div>
    </div>`;
  }).join('');

  // ── Render répartition par type ──
  const total = s.totalOther + s.totalFuel;
  const typeRows = Object.entries(s.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, cost]) => {
      const t = TYPES[type] || TYPES.autre;
      const pct = total > 0 ? (cost / total * 100).toFixed(0) : 0;
      return `<div class="pie-row">
        <div class="pie-dot" style="background:${typeColors[type]||'var(--muted)'}"></div>
        <div class="pie-name">${t.ico} ${t.label}</div>
        <div class="pie-pct">${pct}% · ${fmtEur(cost)}</div>
      </div>`;
    }).join('');

  // ── Render année par année ──
  const years = Object.keys(s.byYear).sort((a, b) => b - a);
  const maxYr = Math.max(...Object.values(s.byYear), 1);
  const yearBars = years.map(y => `
    <div class="bar-row">
      <div class="bar-label">${y}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(s.byYear[y]/maxYr*100).toFixed(1)}%"></div></div>
      <div class="bar-val">${fmtEur(s.byYear[y])}</div>
    </div>`).join('');

  // ── Render courbe évolution (maquette 1) ──
  const SVG_W = 300; const SVG_H = 110; const PAD_L = 28; const PAD_B = 20; const PAD_T = 14;
  const plotW = SVG_W - PAD_L - 8; const plotH = SVG_H - PAD_B - PAD_T;
  const evoPoints = evoYears.map((y, i) => {
    const val = fraisOnlyByYearExtrap[y] || 0;
    const x = PAD_L + (i / Math.max(evoYears.length - 1, 1)) * plotW;
    const yPos = PAD_T + plotH - (val / maxFrais) * plotH;
    return { x, y: yPos, val, year: y, isCurrent: parseInt(y) === currentYear };
  });
  const polyline = evoPoints.map(p => `${p.x},${p.y}`).join(' ');
  const dotsSVG = evoPoints.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="${p.isCurrent ? 5 : 3.5}"
      fill="${p.isCurrent ? '#ff4757' : '#4d8eff'}" />
    <text x="${p.x}" y="${p.y - 6}" font-size="8" text-anchor="middle"
      fill="${p.isCurrent ? '#ff4757' : 'var(--muted2)'}" font-family="monospace">${fmtEur(p.val)}</text>
    <text x="${p.x}" y="${SVG_H - 5}" font-size="8" text-anchor="middle"
      fill="${p.isCurrent ? '#ff4757' : 'var(--muted2)'}">${p.year}</text>`).join('');
  const tendanceBadge = tendance === 'up'
    ? `<span class="evo-badge up">En hausse +${tendancePct}%</span>`
    : tendance === 'down'
    ? `<span class="evo-badge down">En baisse ${tendancePct}%</span>`
    : '';
  const tendanceMsg = tendance === 'up'
    ? `Les frais augmentent depuis ${fullYears[0]} · tendance à surveiller`
    : tendance === 'down'
    ? `Les frais diminuent depuis ${fullYears[0]} · bonne nouvelle !`
    : '';

  // ── Render tableau année par année (maquette 2, frais uniquement) ──
  const evoRows = evoYears.sort((a,b) => b - a).map(y => {
    const val = fraisOnlyByYearExtrap[y] || 0;
    const pct = evoPct[y];
    const isCurrent = parseInt(y) === currentYear;
    const barW = Math.round(val / maxFrais * 100);
    let badgeHtml = '';
    if (pct === null) badgeHtml = `<span class="evo-yr-badge muted">1ère année</span>`;
    else if (pct > 0)  badgeHtml = `<span class="evo-yr-badge up">+${pct}%</span>`;
    else               badgeHtml = `<span class="evo-yr-badge down">${pct}%</span>`;
    return `<div class="evo-yr-row${isCurrent?' evo-current':''}">
      <div class="evo-yr-label">${y}</div>
      <div style="flex:1;min-width:0">
        <div class="bar-track" style="height:6px">
          <div class="bar-fill" style="width:${barW}%;background:${isCurrent?'#ff4757':'#4d8eff'}"></div>
        </div>
        ${isCurrent ? `<div style="font-size:10px;color:var(--muted2);margin-top:2px">en cours · extrapolé sur 12 mois</div>` : ''}
      </div>
      <div class="evo-yr-right">
        <div class="evo-yr-val" style="color:${isCurrent?'#ff4757':'var(--text)'}">${fmtEur(val)}</div>
        ${badgeHtml}
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="stats-grid">

      <!-- Cartes résumé -->
      <div class="stat-card">
        <div class="stat-card-label">Frais hors carbu</div>
        <div class="stat-card-val">${fmtEur(s.totalOther)}</div>
        <div class="stat-card-sub">Hors achat et essence</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Carburant</div>
        <div class="stat-card-val teal">${fmtEur(s.totalFuel)}</div>
        <div class="stat-card-sub">${s.totalLiters ? Math.round(s.totalLiters)+' L enregistrés' : 'Aucun plein saisi'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Coût / km</div>
        <div class="stat-card-val">${s.costPerKm ? s.costPerKm.toFixed(2)+'€' : '—'}</div>
        <div class="stat-card-sub">Frais + carbu + achat<br>${s.kmDriven ? fmt(s.kmDriven)+' km parcourus' : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Coût total</div>
        <div class="stat-card-val">${fmtEur(s.totalAllInclPurchase)}</div>
        <div class="stat-card-sub">Tout inclus</div>
      </div>

      <!-- Évolution courbe -->
      ${evoYears.length >= 2 ? `
      <div class="stat-card full">
        <div class="stat-card-label" style="display:flex;align-items:center;gap:8px;justify-content:space-between">
          <span>Évolution des frais (hors carburant)</span>
          ${tendanceBadge}
        </div>
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" style="margin-top:8px;overflow:visible">
          <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T+plotH}" stroke="var(--border)" stroke-width="1"/>
          <line x1="${PAD_L}" y1="${PAD_T+plotH}" x2="${SVG_W-8}" y2="${PAD_T+plotH}" stroke="var(--border)" stroke-width="1"/>
          <line x1="${PAD_L}" y1="${PAD_T + plotH*0.33}" x2="${SVG_W-8}" y2="${PAD_T + plotH*0.33}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>
          <line x1="${PAD_L}" y1="${PAD_T + plotH*0.66}" x2="${SVG_W-8}" y2="${PAD_T + plotH*0.66}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>
          <polyline points="${polyline}" fill="none" stroke="#4d8eff" stroke-width="2" stroke-linejoin="round"/>
          ${dotsSVG}
        </svg>
        ${tendanceMsg ? `<div class="evo-msg">${tendanceMsg}</div>` : ''}
      </div>` : ''}

      <!-- Évolution année par année -->
      ${evoYears.length >= 1 ? `
      <div class="stat-card full">
        <div class="stat-card-label">Frais par année · hors carburant</div>
        <div class="evo-yr-list">${evoRows}</div>
      </div>` : ''}

      <!-- Coût mensuel moyen -->
      <div class="stat-card full">
        <div class="stat-card-label">Coût mensuel moyen</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:14px">
          <span class="stat-card-val" style="font-size:26px">${fmtEur(totalMonthly)}</span>
          <span class="stat-card-sub" style="margin:0">/ mois · hors achat · ${monthsOwned} mois</span>
        </div>
        <div class="bar-chart">${monthlyBars}</div>
      </div>

      <!-- Carburant -->
      <div class="stat-card full">
        <div class="stat-card-label">Tableau de bord carburant</div>
        <div class="fuel-summary-grid">
          <div class="fuel-kpi">
            <div class="fuel-kpi-val">${avgPricePerL > 0 ? avgPricePerL.toFixed(2)+'€' : '—'}</div>
            <div class="fuel-kpi-lbl">prix moy/L</div>
          </div>
          <div class="fuel-kpi">
            <div class="fuel-kpi-val">${s.totalLiters > 0 ? Math.round(s.totalLiters)+' L' : '—'}</div>
            <div class="fuel-kpi-lbl">total consommé</div>
          </div>
          <div class="fuel-kpi">
            <div class="fuel-kpi-val">${s.kmDriven > 0 && s.totalLiters > 0 ? (s.totalLiters / s.kmDriven * 100).toFixed(1)+'L' : '—'}</div>
            <div class="fuel-kpi-lbl">aux 100 km</div>
          </div>
        </div>
        <div style="margin-top:14px">
          <div class="stat-card-sub" style="margin-bottom:8px">Litres enregistrés par année</div>
          ${fuelBars}
        </div>
        ${recordsHtml ? `<div style="margin-top:12px"><div class="stat-card-sub" style="margin-bottom:8px">Records</div>${recordsHtml}</div>` : ''}
      </div>

      <!-- Échéances -->
      <div class="stat-card full">
        <div class="stat-card-label">Échéances à venir</div>
        <div class="deadlines-list">${deadlineRows}</div>
        ${deadlineTotal3m > 0 ? `
        <div class="deadline-total">
          <span class="stat-card-sub">Total prévu dans les 3 prochains mois</span>
          <span style="font-size:15px;font-weight:700;font-family:var(--mono);color:var(--text)">${fmtEur(deadlineTotal3m)}</span>
        </div>` : ''}
      </div>

      <!-- Dépenses par année -->
      <div class="stat-card full">
        <div class="stat-card-label">Dépenses par année</div>
        <div class="bar-chart">${yearBars}</div>
      </div>

      <!-- Répartition par type -->
      <div class="stat-card full">
        <div class="stat-card-label">Répartition par type</div>
        <div class="pie-legend">${typeRows}</div>
      </div>

    </div>`;
}

// ── Calcul des échéances prévisionnelles ────
function _computeDeadlines(vehicle, stats, entries) {
  const now = new Date();
  const deadlines = [];

  // Prochain entretien (basé sur km)
  if (stats.nextService) {
    const ns = stats.nextService;
    const avgKmPerMonth = stats.kmDriven > 0 && vehicle.purchaseDate
      ? stats.kmDriven / Math.max(1, (now.getFullYear() - new Date(vehicle.purchaseDate).getFullYear()) * 12 + now.getMonth() - new Date(vehicle.purchaseDate).getMonth())
      : 0;
    const monthsAway = avgKmPerMonth > 0 ? Math.round(ns.remaining / avgKmPerMonth) : null;
    const lastCost = entries.filter(e => e.type === 'entretien' && e.cost > 0).sort((a,b) => new Date(b.date)-new Date(a.date))[0]?.cost || 0;
    deadlines.push({
      ico:'🔧', label:'Prochain entretien',
      sub: ns.remaining <= 0 ? `Dépassé de ${fmt(Math.abs(ns.remaining))} km` : `Dans ${fmt(ns.remaining)} km`,
      amount: lastCost || 300,
      monthsAway: ns.remaining <= 0 ? 0 : monthsAway,
      badgeTxt: 'km inconnus',
      bg:'rgba(77,142,255,0.15)',
    });
  }

  // Assurance (annuelle, basée sur la dernière)
  const lastAssurance = entries.filter(e => e.type === 'assurance').sort((a,b) => new Date(b.date)-new Date(a.date))[0];
  if (lastAssurance) {
    const nextDate = new Date(lastAssurance.date);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    const monthsAway = Math.round((nextDate - now) / (1000 * 60 * 60 * 24 * 30));
    deadlines.push({
      ico:'📄', label:'Assurance annuelle',
      sub:`Renouvellement · ${nextDate.toLocaleDateString('fr-BE',{month:'long',year:'numeric'})}`,
      amount: lastAssurance.cost || 0,
      monthsAway: Math.max(0, monthsAway),
      badgeTxt:'',
      bg:'rgba(32,208,112,0.15)',
    });
  }

  // Taxe (annuelle, basée sur la dernière)
  const lastTaxe = entries.filter(e => e.type === 'taxe').sort((a,b) => new Date(b.date)-new Date(a.date))[0];
  if (lastTaxe) {
    const nextDate = new Date(lastTaxe.date);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    const monthsAway = Math.round((nextDate - now) / (1000 * 60 * 60 * 24 * 30));
    deadlines.push({
      ico:'🏛️', label:'Taxe annuelle',
      sub:`Renouvellement · ${nextDate.toLocaleDateString('fr-BE',{month:'long',year:'numeric'})}`,
      amount: lastTaxe.cost || 0,
      monthsAway: Math.max(0, monthsAway),
      badgeTxt:'',
      bg:'rgba(167,139,250,0.15)',
    });
  }

  // Contrôle technique (tous les 2 ans en Belgique)
  const lastControle = entries.filter(e => e.type === 'controle').sort((a,b) => new Date(b.date)-new Date(a.date))[0];
  if (lastControle) {
    const nextDate = new Date(lastControle.date);
    nextDate.setFullYear(nextDate.getFullYear() + 2);
    const monthsAway = Math.round((nextDate - now) / (1000 * 60 * 60 * 24 * 30));
    deadlines.push({
      ico:'✅', label:'Contrôle technique',
      sub:`Renouvellement · ${nextDate.toLocaleDateString('fr-BE',{month:'long',year:'numeric'})}`,
      amount: lastControle.cost || 0,
      monthsAway: Math.max(0, monthsAway),
      badgeTxt:'',
      bg:'rgba(251,191,36,0.15)',
    });
  }

  return deadlines.sort((a, b) => {
    if (a.monthsAway === null) return 1;
    if (b.monthsAway === null) return -1;
    return a.monthsAway - b.monthsAway;
  });
}

// ─── PHOTO UPLOAD ───────────────────────────
function triggerPhotoUpload(vehicleId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX) { h = h * MAX / w; w = MAX; }
        if (h > MAX) { w = w * MAX / h; h = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        await updateVehicle(vehicleId, { photo: canvas.toDataURL('image/jpeg', 0.75) });
        showToast('Photo mise à jour ✓');
        renderPage(State.currentPage);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ─── ENTRY FORM ─────────────────────────────
async function openEntryForm(entryId = null) {
  State.editingEntryId = entryId;
  const entry    = entryId ? await getEntry(entryId) : null;
  const vehicles = await getVehicles();
  let selType    = entry?.type || 'entretien';

  const typeGrid = Object.entries(TYPES).map(([k, t]) => {
    const isSel = selType === k;
    const selClass = isSel ? (k === 'carburant' ? 'selected-fuel' : 'selected') : '';
    return `<div class="type-btn ${selClass}" data-type="${k}" onclick="selectType(this,'${k}')">
      <div class="type-ico">${t.ico}</div>
      <span class="type-lbl">${t.label}</span>
    </div>`;
  }).join('');

  const vehicleOptions = vehicles.map(v =>
    `<option value="${v.id}" ${(entry?.vehicleId||State.activeVehicleId)===v.id?'selected':''}>${v.name}</option>`
  ).join('');

  document.getElementById('entry-modal-title').textContent = entry ? 'Modifier l\'entrée' : 'Nouvelle entrée';
  document.getElementById('entry-modal-body').innerHTML = `
    <input type="hidden" id="ef-type" value="${selType}">
    <div class="form-group">
      <label class="form-label">Type</label>
      <div class="type-grid">${typeGrid}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Véhicule</label>
      <select class="form-select" id="ef-vehicle">${vehicleOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" id="ef-date" value="${entry?.date||today()}">
      </div>
      <div class="form-group">
        <label class="form-label">Km au compteur</label>
        <input class="form-input" type="number" id="ef-mileage" placeholder="ex: 109800" value="${entry?.mileage||''}">
      </div>
    </div>
    <div id="fuel-section" style="display:${selType==='carburant'?'block':'none'}">
      <div class="fuel-form-section">
        <div class="fuel-section-title">⛽ Détails du plein</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Litres</label>
            <input class="form-input" type="number" id="ef-liters" step="0.01" placeholder="ex: 45.5"
              value="${entry?.liters||''}" oninput="updatePricePerLiter()">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Montant (€)</label>
            <input class="form-input" type="number" id="ef-fuel-cost" step="0.01" placeholder="ex: 72.00"
              value="${entry?.type==='carburant'?entry?.cost||'':''}" oninput="updatePricePerLiter()">
          </div>
        </div>
        <div class="form-group" style="margin-top:10px;margin-bottom:0">
          <label class="form-label">Prix / litre <span style="color:var(--teal);font-style:italic;text-transform:none">(calculé auto)</span></label>
          <div class="price-per-liter-display" id="price-per-liter"><span>—</span><span>automatique</span></div>
        </div>
      </div>
    </div>
    <div class="form-group" id="ef-desc-group">
      <label class="form-label">${selType==='carburant'?'Station / Notes':'Description'}</label>
      <input class="form-input" type="text" id="ef-desc"
        placeholder="${selType==='carburant'?'ex: Total Mouscron':'ex: Grand entretien'}"
        value="${entry?.description||''}">
    </div>
    <div id="ef-cost-group" style="display:${selType==='carburant'?'none':'block'}">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Coût (€)</label>
          <input class="form-input" type="number" id="ef-cost" step="0.01" placeholder="0"
            value="${entry?.type!=='carburant'?entry?.cost??'':''}">
        </div>
        <div class="form-group">
          <label class="form-label">Fournisseur</label>
          <input class="form-input" type="text" id="ef-provider" placeholder="ex: VDC Peruwelz"
            value="${entry?.provider||''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Facture / Référence</label>
        <input class="form-input" type="text" id="ef-invoice" placeholder="Numéro facture"
          value="${entry?.invoice||''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="ef-notes" placeholder="Remarques optionnelles...">${entry?.notes||''}</textarea>
    </div>
    <button class="btn ${selType==='carburant'?'btn-fuel':'btn-primary'}" id="ef-submit-btn" onclick="saveEntry()">
      ${entry ? '✓ Enregistrer les modifications' : selType==='carburant'?'⛽ Enregistrer le plein':'✓ Ajouter l\'entrée'}
    </button>
    ${entry ? `<div class="delete-zone"><button class="btn btn-danger" onclick="confirmDeleteEntry('${entry.id}')">🗑 Supprimer cette entrée</button></div>` : ''}`;

  if (selType === 'carburant') updatePricePerLiter();
  openModal('entry-modal');
}

window.selectType = function(el, type) {
  document.querySelectorAll('#entry-modal-body .type-btn').forEach(b => b.classList.remove('selected','selected-fuel'));
  el.classList.add(type === 'carburant' ? 'selected-fuel' : 'selected');
  document.getElementById('ef-type').value = type;
  const isFuel = type === 'carburant';
  document.getElementById('fuel-section').style.display  = isFuel ? 'block' : 'none';
  document.getElementById('ef-cost-group').style.display = isFuel ? 'none'  : 'block';
  const descLbl = document.querySelector('#ef-desc-group .form-label');
  const descInp = document.getElementById('ef-desc');
  descLbl.textContent = isFuel ? 'Station / Notes' : 'Description';
  descInp.placeholder = isFuel ? 'ex: Total Mouscron' : 'ex: Grand entretien';
  const btn = document.getElementById('ef-submit-btn');
  if (btn) {
    btn.className = 'btn ' + (isFuel ? 'btn-fuel' : 'btn-primary');
    btn.textContent = isFuel ? '⛽ Enregistrer le plein' : '✓ Ajouter l\'entrée';
  }
  if (isFuel) updatePricePerLiter();
};

window.updatePricePerLiter = function() {
  const liters = parseFloat(document.getElementById('ef-liters')?.value) || 0;
  const cost   = parseFloat(document.getElementById('ef-fuel-cost')?.value) || 0;
  const el     = document.getElementById('price-per-liter');
  if (!el) return;
  el.innerHTML = (liters > 0 && cost > 0)
    ? `<strong style="color:var(--teal);font-size:17px">${(cost/liters).toFixed(3)}€/L</strong><span>automatique</span>`
    : `<span>—</span><span>automatique</span>`;
};

async function saveEntry() {
  const type   = document.getElementById('ef-type').value;
  const isFuel = type === 'carburant';
  const cost   = isFuel
    ? parseFloat(document.getElementById('ef-fuel-cost')?.value) || 0
    : parseFloat(document.getElementById('ef-cost')?.value) || 0;
  const desc = document.getElementById('ef-desc').value.trim();
  if (!desc && !isFuel) { alert('La description est obligatoire.'); return; }

  const data = {
    vehicleId:   document.getElementById('ef-vehicle').value,
    type, cost,
    date:        document.getElementById('ef-date').value,
    mileage:     parseInt(document.getElementById('ef-mileage').value) || 0,
    description: desc || 'Plein de carburant',
    provider:    isFuel ? '' : (document.getElementById('ef-provider')?.value.trim()||''),
    invoice:     isFuel ? '' : (document.getElementById('ef-invoice')?.value.trim()||''),
    notes:       document.getElementById('ef-notes').value.trim(),
    liters:      isFuel ? (parseFloat(document.getElementById('ef-liters')?.value)||0) : 0,
  };

  showLoader(true);
  try {
    if (State.editingEntryId) {
      await updateEntry(State.editingEntryId, data);
      showToast('Entrée modifiée ✓');
    } else {
      await createEntry(data);
      showToast(isFuel ? 'Plein enregistré ⛽' : 'Entrée ajoutée ✓');
    }
  } finally {
    showLoader(false);
  }
  closeModal('entry-modal');
  renderPage(State.currentPage);
}

async function confirmDeleteEntry(id) {
  if (!confirm('Supprimer cette entrée ?')) return;
  showLoader(true);
  try { await deleteEntry(id); } finally { showLoader(false); }
  showToast('Entrée supprimée');
  closeModal('entry-modal');
  renderPage(State.currentPage);
}

// ─── VEHICLE FORM ───────────────────────────
async function openVehicleForm(vehicleId = null) {
  State.editingVehicleId = vehicleId;
  const v = vehicleId ? await getVehicle(vehicleId) : null;

  document.getElementById('vf-modal-title').textContent = v ? 'Modifier le véhicule' : 'Nouveau véhicule';
  document.getElementById('vf-modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Marque</label>
        <input class="form-input" type="text" id="vf-brand" placeholder="Peugeot" value="${v?.brand||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Nom court</label>
        <input class="form-input" type="text" id="vf-name" placeholder="308 SW" value="${v?.name||''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Modèle complet</label>
      <input class="form-input" type="text" id="vf-model" placeholder="308 SW 1.2 PureTech EAT8" value="${v?.model||''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Année</label>
        <input class="form-input" type="number" id="vf-year" placeholder="2019" value="${v?.year||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Carburant</label>
        <select class="form-select" id="vf-fuel">
          ${['Essence','Diesel','Hybride','Électrique','Autre'].map(f =>
            `<option ${(v?.fuel||'Essence')===f?'selected':''}>${f}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Plaque</label>
        <input class="form-input" type="text" id="vf-plate" placeholder="1-ABC-234" value="${v?.licensePlate||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Km actuels</label>
        <input class="form-input" type="number" id="vf-mileage" placeholder="0" value="${v?.mileage||''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date d'achat</label>
        <input class="form-input" type="date" id="vf-purchase-date" value="${v?.purchaseDate||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Km à l'achat</label>
        <input class="form-input" type="number" id="vf-purchase-mileage" placeholder="0" value="${v?.purchaseMileage||''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Prix d'achat (€)</label>
        <input class="form-input" type="number" id="vf-purchase-price" placeholder="0" value="${v?.purchasePrice||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Intervalle entretien (km)</label>
        <input class="form-input" type="number" id="vf-service-interval" placeholder="ex: 15000" value="${v?.serviceInterval||''}">
        <div class="form-hint">Km entre 2 entretiens</div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="vf-notes">${v?.notes||''}</textarea>
    </div>
    <button class="btn btn-primary" onclick="saveVehicle()">
      ${v ? '✓ Enregistrer' : '✓ Créer le véhicule'}
    </button>
    ${v ? `<div class="delete-zone"><button class="btn btn-danger" onclick="confirmDeleteVehicle('${v.id}')">🗑 Supprimer ce véhicule</button></div>` : ''}`;

  openModal('vehicle-modal');
}

async function saveVehicle() {
  const name = document.getElementById('vf-name').value.trim();
  if (!name) { alert('Le nom est obligatoire.'); return; }
  const data = {
    brand:           document.getElementById('vf-brand').value.trim(),
    name,
    model:           document.getElementById('vf-model').value.trim(),
    year:            parseInt(document.getElementById('vf-year').value) || null,
    fuel:            document.getElementById('vf-fuel').value,
    licensePlate:    document.getElementById('vf-plate').value.trim(),
    mileage:         parseInt(document.getElementById('vf-mileage').value) || 0,
    purchaseDate:    document.getElementById('vf-purchase-date').value,
    purchaseMileage: parseInt(document.getElementById('vf-purchase-mileage').value) || 0,
    purchasePrice:   parseFloat(document.getElementById('vf-purchase-price').value) || 0,
    serviceInterval: parseInt(document.getElementById('vf-service-interval').value) || '',
    notes:           document.getElementById('vf-notes').value.trim(),
  };

  showLoader(true);
  try {
    if (State.editingVehicleId) {
      await updateVehicle(State.editingVehicleId, data);
      showToast('Véhicule mis à jour ✓');
    } else {
      const vehicles = await getVehicles();
      const idx = vehicles.length % COLORS.length;
      const v = await createVehicle({ ...data, color: COLORS[idx], photo: null });
      State.activeVehicleId = v.id;
      showToast('Véhicule créé ✓');
    }
  } finally {
    showLoader(false);
  }
  closeModal('vehicle-modal');
  renderPage(State.currentPage);
}

async function confirmDeleteVehicle(id) {
  if (!confirm('Supprimer ce véhicule et toutes ses entrées ? Cette action est irréversible.')) return;
  showLoader(true);
  try { await deleteVehicle(id); } finally { showLoader(false); }
  const vehicles = await getVehicles();
  State.activeVehicleId = vehicles[0]?.id || null;
  showToast('Véhicule supprimé');
  closeModal('vehicle-modal');
  renderPage(State.currentPage);
}

// ─── COMPTE UTILISATEUR ─────────────────────
function showUserMenu() {
  const user = getCurrentUser();
  document.getElementById('user-modal-body').innerHTML = `
    <div class="user-info">
      <div class="user-avatar">${user?.photoURL ? `<img src="${user.photoURL}" width="56" height="56" style="border-radius:50%">` : '👤'}</div>
      <div class="user-name">${user?.displayName || 'Utilisateur'}</div>
      <div class="user-email">${user?.email || ''}</div>
    </div>
    <button class="btn btn-secondary" onclick="handleSignOut()" style="margin-top:20px">
      🚪 Se déconnecter
    </button>`;
  openModal('user-modal');
}

async function handleSignOut() {
  if (!confirm('Se déconnecter ?')) return;
  await signOutUser();
}

// ─── MODALS ─────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showLoader(true);

  onAuthReady(async user => {
    if (user) {
      // Connecté → afficher l'app
      document.getElementById('page-login').style.display = 'none';
      document.getElementById('bottom-nav').style.display = 'flex';
      showLoader(true);
      await seedDemoData();
      State.activeVehicleId = (await getVehicles())[0]?.id || null;
      showLoader(false);
      navigate('home');
    } else {
      // Non connecté → afficher login
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-login').classList.add('active');
      document.getElementById('page-login').style.display = '';
      document.getElementById('bottom-nav').style.display = 'none';
      showLoader(false);
    }
  });

  document.querySelectorAll('.nav-item[data-page]').forEach(item =>
    item.addEventListener('click', () => navigate(item.dataset.page))
  );
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); })
  );

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Mobile-Dev/service-worker.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nouvelle version prête → afficher la bannière
            document.getElementById('update-banner').classList.add('show');
            window._pendingWorker = newWorker;
          }
        });
      });
    }).catch(() => {});
  }
});

// ─── MISE À JOUR ────────────────────────────
function applyUpdate() {
  if (window._pendingWorker) {
    window._pendingWorker.postMessage('SKIP_WAITING');
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

// Exposer les fonctions au HTML
Object.assign(window, {
  signInWithGoogle, applyUpdate,
  openEntryForm, openVehicleForm, triggerPhotoUpload,
  navigate, closeModal, saveEntry, saveVehicle,
  confirmDeleteEntry, confirmDeleteVehicle, garageDetail,
  showUserMenu, handleSignOut,
});

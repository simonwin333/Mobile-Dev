/* ═══════════════════════════════════════════════
   Mobile Dev — app.js v3
═══════════════════════════════════════════════ */

// ─── STATE ──────────────────────────────────
const State = {
  currentPage:      'home',
  activeVehicleId:  null,
  historyFilter:    'all',
  editingEntryId:   null,
  editingVehicleId: null,
};

// ─── TYPES ─────────────────────────────────
// Carburant en 2e position pour être juste après "Tous" dans les filtres
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

function renderPage(p) {
  if (p === 'home')    renderHome();
  if (p === 'garage')  renderGarage();
  if (p === 'history') renderHistory();
  if (p === 'stats')   renderStats();
}

// ─── HOME ───────────────────────────────────
function renderHome() {
  const vehicles = DB.getVehicles();
  if (!State.activeVehicleId || !vehicles.find(v => v.id === State.activeVehicleId)) {
    State.activeVehicleId = vehicles[0]?.id || null;
  }

  // Pills — sans pill "+ Ajouter"
  const pillsWrap = document.getElementById('home-pills');
  pillsWrap.innerHTML = '';
  vehicles.forEach(v => {
    const pill = document.createElement('div');
    pill.className = 'v-pill' + (v.id === State.activeVehicleId ? ' active' : '');
    pill.innerHTML = `<span class="pill-dot" style="background:${v.color||'#4d8eff'}"></span>${v.name}`;
    pill.onclick = () => { State.activeVehicleId = v.id; renderHome(); };
    pillsWrap.appendChild(pill);
  });

  const vehicle = DB.getVehicle(State.activeVehicleId);
  if (!vehicle) {
    document.getElementById('home-panel').innerHTML =
      `<div class="empty-state"><div class="empty-ico">🚗</div><p>Aucun véhicule.<br>Rendez-vous dans <b>Garage</b> pour en ajouter un.</p></div>`;
    document.getElementById('home-next-service').innerHTML = '';
    document.getElementById('home-recent').innerHTML = '';
    return;
  }
  renderVehiclePanel(vehicle);
  renderNextService(vehicle);
  renderRecentEntries(vehicle);
}

function renderVehiclePanel(vehicle) {
  const stats   = DB.getVehicleStats(vehicle.id);
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

// ── Bannière prochain entretien ──────────────
function renderNextService(vehicle) {
  const stats = DB.getVehicleStats(vehicle.id);
  const wrap  = document.getElementById('home-next-service');

  // Bouton ajouter entrée (toujours présent, au-dessus ou en-dessous de la bannière)
  const addBtn = `<div class="v-action-full" onclick="openEntryForm()" style="margin:0 16px 16px;border-radius:14px;border:1px solid var(--border)">
    <span class="v-action-ico">➕</span>
    <span class="v-action-txt">Ajouter une entrée</span>
  </div>`;

  if (!vehicle.serviceInterval) {
    // Pas d'intervalle configuré
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

function renderRecentEntries(vehicle) {
  const entries = DB.getEntries(vehicle.id)
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
function renderHistory() {
  const vehicles = DB.getVehicles();
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

  // Filtres — Carburant en 2e position juste après "Tous"
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

  const vehicle = DB.getVehicle(State.activeVehicleId);
  const wrap = document.getElementById('history-timeline');
  wrap.innerHTML = '';
  if (!vehicle) { wrap.innerHTML = '<div class="empty-state"><p>Sélectionnez un véhicule</p></div>'; return; }

  let entries = DB.getEntries(vehicle.id).sort((a,b) => new Date(b.date) - new Date(a.date));
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

  // Prix/litre calculé discrètement si données disponibles
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
function renderGarage() {
  const vehicles = DB.getVehicles();
  const wrap = document.getElementById('garage-list');
  wrap.innerHTML = '';

  vehicles.forEach(v => {
    const stats   = DB.getVehicleStats(v.id);
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
  });

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
function renderStats() {
  const vehicles = DB.getVehicles();
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

  const v = DB.getVehicle(State.activeVehicleId);
  const wrap = document.getElementById('stats-content');
  if (!v) { wrap.innerHTML = ''; return; }

  const s = DB.getVehicleStats(v.id);
  const years  = Object.keys(s.byYear).sort((a,b) => b - a);
  const maxYr  = Math.max(...Object.values(s.byYear), 1);
  const yearBars = years.map(y => `
    <div class="bar-row">
      <div class="bar-label">${y}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(s.byYear[y]/maxYr*100).toFixed(1)}%"></div></div>
      <div class="bar-val">${fmtEur(s.byYear[y])}</div>
    </div>`).join('');

  const typeColors = {
    entretien:'var(--blue)', reparation:'var(--orange)', assurance:'var(--green)',
    taxe:'var(--purple)', controle:'var(--yellow)', pneus:'var(--muted2)',
    carburant:'var(--teal)', achat:'var(--red)', autre:'var(--muted)'
  };
  const total = s.totalOther + s.totalFuel;
  const typeRows = Object.entries(s.byType)
    .sort((a,b) => b[1] - a[1])
    .map(([type, cost]) => {
      const t = TYPES[type] || TYPES.autre;
      const pct = total > 0 ? (cost / total * 100).toFixed(0) : 0;
      return `<div class="pie-row">
        <div class="pie-dot" style="background:${typeColors[type]||'var(--muted)'}"></div>
        <div class="pie-name">${t.ico} ${t.label}</div>
        <div class="pie-pct">${pct}% · ${fmtEur(cost)}</div>
      </div>`;
    }).join('');

  wrap.innerHTML = `
    <div class="stats-grid">
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
      <div class="stat-card full">
        <div class="stat-card-label">Dépenses par année</div>
        <div class="bar-chart">${yearBars}</div>
      </div>
      <div class="stat-card full">
        <div class="stat-card-label">Répartition par type</div>
        <div class="pie-legend">${typeRows}</div>
      </div>
    </div>`;
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
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX) { h = h * MAX / w; w = MAX; }
        if (h > MAX) { w = w * MAX / h; h = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        DB.updateVehicle(vehicleId, { photo: canvas.toDataURL('image/jpeg', 0.75) });
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
function openEntryForm(entryId = null) {
  State.editingEntryId = entryId;
  const entry    = entryId ? DB.getEntry(entryId) : null;
  const vehicles = DB.getVehicles();
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

function saveEntry() {
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
    liters:      isFuel ? (parseFloat(document.getElementById('ef-liters')?.value)||0) : undefined,
  };

  if (State.editingEntryId) {
    DB.updateEntry(State.editingEntryId, data);
    showToast('Entrée modifiée ✓');
  } else {
    DB.createEntry(data);
    showToast(isFuel ? 'Plein enregistré ⛽' : 'Entrée ajoutée ✓');
  }
  closeModal('entry-modal');
  renderPage(State.currentPage);
}

function confirmDeleteEntry(id) {
  if (!confirm('Supprimer cette entrée ?')) return;
  DB.deleteEntry(id);
  showToast('Entrée supprimée');
  closeModal('entry-modal');
  renderPage(State.currentPage);
}

// ─── VEHICLE FORM — sans sélecteur de couleur ──
function openVehicleForm(vehicleId = null) {
  State.editingVehicleId = vehicleId;
  const v = vehicleId ? DB.getVehicle(vehicleId) : null;

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
        <div class="form-hint">Km entre 2 entretiens — affiche la prochaine échéance sur l'accueil</div>
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

function saveVehicle() {
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
  if (State.editingVehicleId) {
    DB.updateVehicle(State.editingVehicleId, data);
    showToast('Véhicule mis à jour ✓');
  } else {
    // Couleur auto parmi la palette selon l'index
    const idx = DB.getVehicles().length % COLORS.length;
    const v = DB.createVehicle({ ...data, color: COLORS[idx], photo: null });
    State.activeVehicleId = v.id;
    showToast('Véhicule créé ✓');
  }
  closeModal('vehicle-modal');
  renderPage(State.currentPage);
}

function confirmDeleteVehicle(id) {
  if (!confirm('Supprimer ce véhicule et toutes ses entrées ? Cette action est irréversible.')) return;
  DB.deleteVehicle(id);
  State.activeVehicleId = DB.getVehicles()[0]?.id || null;
  showToast('Véhicule supprimé');
  closeModal('vehicle-modal');
  renderPage(State.currentPage);
}

// ─── MODALS ─────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  DB.seedDemoData();
  State.activeVehicleId = DB.getVehicles()[0]?.id || null;

  document.querySelectorAll('.nav-item[data-page]').forEach(item =>
    item.addEventListener('click', () => navigate(item.dataset.page))
  );
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); })
  );
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
  navigate('home');
});

Object.assign(window, {
  openEntryForm, openVehicleForm, triggerPhotoUpload,
  navigate, closeModal, saveEntry, saveVehicle,
  confirmDeleteEntry, confirmDeleteVehicle, garageDetail,
});

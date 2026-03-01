/* ═══════════════════════════════════════════════
   Mobile Dev — app.js
   Architecture Firebase-ready (voir db.js)
═══════════════════════════════════════════════ */

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const State = {
  currentPage:     'home',
  activeVehicleId: null,
  historyFilter:   'all',
  editingEntryId:  null,
  editingVehicleId:null,
};

// ─────────────────────────────────────────────
// ENTRY TYPES
// ─────────────────────────────────────────────
const TYPES = {
  entretien:  { label: 'Entretien',  ico: '🔧', color: 'blue'   },
  reparation: { label: 'Réparation', ico: '🛠️',  color: 'orange' },
  assurance:  { label: 'Assurance',  ico: '📄', color: 'green'  },
  taxe:       { label: 'Taxe',       ico: '🏛️',  color: 'purple' },
  controle:   { label: 'Contrôle',   ico: '✅', color: 'yellow' },
  pneus:      { label: 'Pneus',      ico: '⚫', color: 'muted'  },
  achat:      { label: 'Achat',      ico: '🛒', color: 'red'    },
  autre:      { label: 'Autre',      ico: '📌', color: 'muted'  },
};

const COLORS = ['#4d8eff','#20d070','#ff7043','#a78bfa','#fbbf24','#ff4757','#00cec9','#fd79a8'];

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('fr-BE'); }
function fmtEur(n) { return (n ? fmt(Math.round(n)) : '0') + '€'; }
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('fr-BE', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function today() { return new Date().toISOString().slice(0,10); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  State.currentPage = page;
  renderPage(page);
}

function renderPage(page) {
  if (page === 'home')    renderHome();
  if (page === 'garage')  renderGarage();
  if (page === 'history') renderHistory();
  if (page === 'stats')   renderStats();
}

// ─────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────
function renderHome() {
  const vehicles = DB.getVehicles();

  // Vehicle selector pills
  const pillsWrap = document.getElementById('home-pills');
  pillsWrap.innerHTML = '';
  vehicles.forEach(v => {
    const pill = document.createElement('div');
    pill.className = 'v-pill' + (v.id === State.activeVehicleId ? ' active' : '');
    pill.innerHTML = `<span class="pill-dot" style="background:${v.color||'#4d8eff'}"></span>${v.name}`;
    pill.onclick = () => { State.activeVehicleId = v.id; renderHome(); };
    pillsWrap.appendChild(pill);
  });
  // Add pill
  const addPill = document.createElement('div');
  addPill.className = 'v-pill v-pill-add';
  addPill.innerHTML = '＋ Ajouter';
  addPill.onclick = openVehicleForm;
  pillsWrap.appendChild(addPill);

  // Ensure an active vehicle
  if (!State.activeVehicleId || !vehicles.find(v => v.id === State.activeVehicleId)) {
    State.activeVehicleId = vehicles[0]?.id || null;
  }

  const vehicle = DB.getVehicle(State.activeVehicleId);
  if (!vehicle) {
    document.getElementById('home-panel').innerHTML = `
      <div class="empty-state"><div class="empty-ico">🚗</div><p>Aucun véhicule.<br>Ajoutez-en un pour commencer !</p></div>`;
    return;
  }

  renderVehiclePanel(vehicle);
  renderRecentEntries(vehicle);
}

function renderVehiclePanel(vehicle) {
  const stats = DB.getVehicleStats(vehicle.id);
  const panel = document.getElementById('home-panel');

  const hasPhoto = !!vehicle.photo;
  const heroBg = hasPhoto
    ? `background-image: url('${vehicle.photo}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(160deg, #0d1f4500 0%, transparent);`;

  const glow = vehicle.color
    ? `radial-gradient(circle at 70% 50%, ${vehicle.color}30 0%, transparent 65%)`
    : `radial-gradient(circle at 70% 50%, rgba(77,142,255,0.2) 0%, transparent 65%)`;

  panel.innerHTML = `
    <div class="v-panel">
      <div class="v-hero ${hasPhoto ? 'has-photo' : ''}" id="v-hero-${vehicle.id}">
        <div class="v-hero-bg ${hasPhoto ? 'has-photo' : ''}" style="${heroBg}"></div>
        <div class="v-hero-overlay"></div>
        <div class="v-hero-glow" style="background:${glow}"></div>
        <div class="v-hero-emoji">🚗</div>
        <div class="v-hero-name">${vehicle.brand ? vehicle.brand + ' ' : ''}${vehicle.name}</div>
        <div class="v-hero-sub">${[vehicle.model, vehicle.year, vehicle.fuel].filter(Boolean).join(' · ')}</div>
        <div class="v-hero-photo-btn" onclick="triggerPhotoUpload('${vehicle.id}')">
          📷 ${hasPhoto ? 'Changer la photo' : 'Ajouter une photo'}
        </div>
      </div>
      <div class="v-stats-row">
        <div class="v-stat">
          <div class="v-stat-val">${vehicle.mileage ? fmt(vehicle.mileage) : '—'}</div>
          <div class="v-stat-lbl">km actuels</div>
        </div>
        <div class="v-stat">
          <div class="v-stat-val">${stats?.costPerKm ? stats.costPerKm.toFixed(2) + '€' : '—'}</div>
          <div class="v-stat-lbl">coût / km</div>
        </div>
        <div class="v-stat">
          <div class="v-stat-val">${stats ? fmtEur(stats.totalCost) : '—'}</div>
          <div class="v-stat-lbl">total frais</div>
        </div>
      </div>
      <div class="v-actions">
        <div class="v-action" onclick="openEntryForm()">
          <span class="v-action-ico">➕</span>
          <div>
            <div class="v-action-txt">Ajouter</div>
            <div class="v-action-sub">Nouvelle entrée</div>
          </div>
        </div>
        <div class="v-action" onclick="openVehicleForm('${vehicle.id}')">
          <span class="v-action-ico">✏️</span>
          <div>
            <div class="v-action-txt">Modifier</div>
            <div class="v-action-sub">Infos véhicule</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderRecentEntries(vehicle) {
  const entries = DB.getEntries(vehicle.id)
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const wrap = document.getElementById('home-recent');
  wrap.innerHTML = `<div class="sec-header"><span class="sec-title">Récent</span><span class="sec-link" onclick="navigate('history')">Tout voir →</span></div>`;

  if (entries.length === 0) {
    wrap.innerHTML += `<div class="empty-state"><div class="empty-ico">📋</div><p>Aucune entrée pour ce véhicule</p></div>`;
    return;
  }

  const tl = document.createElement('div');
  tl.className = 'timeline';
  entries.forEach(e => tl.appendChild(buildEntryEl(e)));
  wrap.appendChild(tl);
}

// ─────────────────────────────────────────────
// HISTORY PAGE
// ─────────────────────────────────────────────
function renderHistory() {
  const vehicles = DB.getVehicles();
  if (!State.activeVehicleId || !vehicles.find(v => v.id === State.activeVehicleId)) {
    State.activeVehicleId = vehicles[0]?.id || null;
  }

  // Pills
  const pillsWrap = document.getElementById('history-pills');
  pillsWrap.innerHTML = '';
  vehicles.forEach(v => {
    const pill = document.createElement('div');
    pill.className = 'v-pill' + (v.id === State.activeVehicleId ? ' active' : '');
    pill.innerHTML = `<span class="pill-dot" style="background:${v.color||'#4d8eff'}"></span>${v.name}`;
    pill.onclick = () => { State.activeVehicleId = v.id; renderHistory(); };
    pillsWrap.appendChild(pill);
  });

  // Filters
  const filterBar = document.getElementById('history-filters');
  filterBar.innerHTML = '';
  const filters = [{ key:'all', label:'Tous' }, ...Object.entries(TYPES).map(([k,v])=>({key:k, label:v.label}))];
  filters.forEach(f => {
    const pill = document.createElement('div');
    pill.className = 'fpill' + (State.historyFilter === f.key ? ' active' : '');
    pill.textContent = f.label;
    pill.onclick = () => { State.historyFilter = f.key; renderHistory(); };
    filterBar.appendChild(pill);
  });

  const vehicle = DB.getVehicle(State.activeVehicleId);
  const wrap = document.getElementById('history-timeline');
  wrap.innerHTML = '';

  if (!vehicle) {
    wrap.innerHTML = '<div class="empty-state"><p>Sélectionnez un véhicule</p></div>';
    return;
  }

  let entries = DB.getEntries(vehicle.id)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  if (State.historyFilter !== 'all') {
    entries = entries.filter(e => e.type === State.historyFilter);
  }

  if (entries.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-ico">📭</div><p>Aucune entrée</p></div>';
    return;
  }

  // Group by year
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
    byYear[year].forEach(e => tl.appendChild(buildEntryEl(e)));
  });
  wrap.appendChild(tl);
}

function buildEntryEl(entry) {
  const t = TYPES[entry.type] || TYPES.autre;
  const el = document.createElement('div');
  el.className = 't-entry';
  const costFree = !entry.cost || parseFloat(entry.cost) === 0;
  el.innerHTML = `
    <div class="t-dot ${entry.type}">${t.ico}</div>
    <div class="t-card" onclick="openEntryForm('${entry.id}')">
      <div class="t-top">
        <div class="t-desc">${entry.description || '—'}</div>
        <div class="t-cost ${costFree ? 'free' : ''}">${costFree ? 'Gratuit' : fmtEur(entry.cost)}</div>
      </div>
      <div class="t-meta">
        ${fmtDate(entry.date)}${entry.mileage ? ' · ' + fmt(entry.mileage) + ' km' : ''}
        ${entry.provider ? '<span class="t-provider">· ' + entry.provider + '</span>' : ''}
      </div>
    </div>`;
  return el;
}

// ─────────────────────────────────────────────
// GARAGE PAGE
// ─────────────────────────────────────────────
function renderGarage() {
  const vehicles = DB.getVehicles();
  const wrap = document.getElementById('garage-list');
  wrap.innerHTML = '';

  if (vehicles.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-ico">🏎️</div><p>Aucun véhicule.<br>Ajoutez-en un !</p></div>`;
    return;
  }

  vehicles.forEach(v => {
    const stats = DB.getVehicleStats(v.id);
    const card = document.createElement('div');
    card.className = 'garage-card';
    const hasPhoto = !!v.photo;
    const heroBg = hasPhoto
      ? `background-image:url('${v.photo}'); background-size:cover; background-position:center;`
      : `background: linear-gradient(135deg, ${v.color || '#1a3366'}22, ${v.color || '#4d8eff'}44);`;
    card.innerHTML = `
      <div class="garage-card-hero" style="${heroBg}">
        ${!hasPhoto ? '<span style="font-size:52px">🚗</span>' : ''}
      </div>
      <div class="garage-card-body">
        <div class="garage-card-name">${v.brand ? v.brand + ' ' : ''}${v.name}</div>
        <div class="garage-card-sub">${[v.model, v.year, v.fuel].filter(Boolean).join(' · ') || 'Infos à compléter'}</div>
        <div class="garage-card-stats">
          <div>
            <div class="gcs-val">${v.mileage ? fmt(v.mileage) + ' km' : '—'}</div>
            <div class="gcs-lbl">Kilométrage</div>
          </div>
          <div>
            <div class="gcs-val">${stats ? fmtEur(stats.totalCost) : '—'}</div>
            <div class="gcs-lbl">Total frais</div>
          </div>
          <div>
            <div class="gcs-val">${stats?.entryCount || 0}</div>
            <div class="gcs-lbl">Entrées</div>
          </div>
        </div>
      </div>`;
    card.onclick = () => { State.activeVehicleId = v.id; navigate('home'); };
    wrap.appendChild(card);
  });

  // Add vehicle button
  const addCard = document.createElement('div');
  addCard.className = 'garage-card';
  addCard.style.cssText = 'border-style: dashed; cursor: pointer;';
  addCard.innerHTML = `<div class="garage-card-hero" style="font-size:40px; background: var(--surface);">➕</div><div class="garage-card-body"><div class="garage-card-name">Ajouter un véhicule</div></div>`;
  addCard.onclick = openVehicleForm;
  wrap.appendChild(addCard);
}

// ─────────────────────────────────────────────
// STATS PAGE
// ─────────────────────────────────────────────
function renderStats() {
  const vehicle = DB.getVehicle(State.activeVehicleId);
  const vehicles = DB.getVehicles();
  if (!State.activeVehicleId || !vehicle) {
    State.activeVehicleId = vehicles[0]?.id || null;
  }

  // Pills
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

  const stats = DB.getVehicleStats(v.id);

  // By year chart
  const years = Object.keys(stats.byYear).sort((a,b) => b - a);
  const maxYear = Math.max(...Object.values(stats.byYear));
  const yearBars = years.map(y => `
    <div class="bar-row">
      <div class="bar-label">${y}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(stats.byYear[y]/maxYear*100).toFixed(1)}%"></div></div>
      <div class="bar-val">${fmtEur(stats.byYear[y])}</div>
    </div>`).join('');

  // By type
  const typeColors = { entretien:'var(--blue)', reparation:'var(--orange)', assurance:'var(--green)', taxe:'var(--purple)', controle:'var(--yellow)', pneus:'var(--muted2)', achat:'var(--red)', autre:'var(--muted)' };
  const typeRows = Object.entries(stats.byType)
    .sort((a,b) => b[1] - a[1])
    .map(([type, cost]) => {
      const t = TYPES[type] || TYPES.autre;
      const pct = stats.totalCost > 0 ? (cost / stats.totalCost * 100).toFixed(0) : 0;
      return `<div class="pie-row">
        <div class="pie-dot" style="background:${typeColors[type]||'var(--muted)'}"></div>
        <div class="pie-name">${t.ico} ${t.label}</div>
        <div class="pie-pct">${pct}% · ${fmtEur(cost)}</div>
      </div>`;
    }).join('');

  wrap.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-label">Total frais</div>
        <div class="stat-card-val">${fmtEur(stats.totalCost)}</div>
        <div class="stat-card-sub">Hors achat</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Coût / km</div>
        <div class="stat-card-val">${stats.costPerKm ? stats.costPerKm.toFixed(2) + '€' : '—'}</div>
        <div class="stat-card-sub">${stats.kmDriven ? fmt(stats.kmDriven) + ' km parcourus' : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Coût total</div>
        <div class="stat-card-val">${fmtEur(stats.totalWithPurchase)}</div>
        <div class="stat-card-sub">Achat inclus</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Entrées</div>
        <div class="stat-card-val">${stats.entryCount}</div>
        <div class="stat-card-sub">Opérations enregistrées</div>
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

// ─────────────────────────────────────────────
// PHOTO UPLOAD
// ─────────────────────────────────────────────
function triggerPhotoUpload(vehicleId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Resize + compress to base64
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX) { h = h * MAX / w; w = MAX; }
        if (h > MAX) { w = w * MAX / h; h = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        DB.updateVehicle(vehicleId, { photo: dataUrl });
        showToast('Photo mise à jour ✓');
        renderPage(State.currentPage);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ─────────────────────────────────────────────
// ENTRY FORM MODAL
// ─────────────────────────────────────────────
function openEntryForm(entryId = null) {
  State.editingEntryId = entryId;
  const entry = entryId ? DB.getEntry(entryId) : null;
  const vehicles = DB.getVehicles();

  let selectedType = entry?.type || 'entretien';

  const typeGrid = Object.entries(TYPES).map(([k,v]) =>
    `<div class="type-btn ${selectedType === k ? 'selected' : ''}" data-type="${k}" onclick="selectType(this,'${k}')">
      <div class="type-ico">${v.ico}</div>
      <span class="type-lbl">${v.label}</span>
    </div>`
  ).join('');

  const vehicleOptions = vehicles.map(v =>
    `<option value="${v.id}" ${(entry?.vehicleId || State.activeVehicleId) === v.id ? 'selected' : ''}>${v.name}</option>`
  ).join('');

  document.getElementById('entry-modal-title').textContent = entry ? 'Modifier l\'entrée' : 'Nouvelle entrée';
  document.getElementById('entry-modal-body').innerHTML = `
    <input type="hidden" id="ef-type" value="${selectedType}">
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
        <input class="form-input" type="date" id="ef-date" value="${entry?.date || today()}">
      </div>
      <div class="form-group">
        <label class="form-label">Kilométrage</label>
        <input class="form-input" type="number" id="ef-mileage" placeholder="ex: 45000" value="${entry?.mileage || ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-input" type="text" id="ef-desc" placeholder="ex: Grand entretien" value="${entry?.description || ''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Coût (€)</label>
        <input class="form-input" type="number" id="ef-cost" placeholder="0" step="0.01" value="${entry?.cost ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Fournisseur</label>
        <input class="form-input" type="text" id="ef-provider" placeholder="ex: VDC Peruwelz" value="${entry?.provider || ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Facture / Référence</label>
      <input class="form-input" type="text" id="ef-invoice" placeholder="Numéro facture" value="${entry?.invoice || ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="ef-notes" placeholder="Remarques optionnelles...">${entry?.notes || ''}</textarea>
    </div>
    <button class="btn btn-primary" onclick="saveEntry()">
      ${entry ? '✓ Enregistrer les modifications' : '✓ Ajouter l\'entrée'}
    </button>
    ${entry ? `<div class="delete-zone"><button class="btn btn-danger" onclick="deleteEntry('${entry.id}')">🗑 Supprimer cette entrée</button></div>` : ''}`;

  openModal('entry-modal');
}

window.selectType = function(el, type) {
  document.querySelectorAll('#entry-modal-body .type-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('ef-type').value = type;
};

function saveEntry() {
  const data = {
    vehicleId:   document.getElementById('ef-vehicle').value,
    type:        document.getElementById('ef-type').value,
    date:        document.getElementById('ef-date').value,
    mileage:     parseInt(document.getElementById('ef-mileage').value) || 0,
    description: document.getElementById('ef-desc').value.trim(),
    cost:        parseFloat(document.getElementById('ef-cost').value) || 0,
    provider:    document.getElementById('ef-provider').value.trim(),
    invoice:     document.getElementById('ef-invoice').value.trim(),
    notes:       document.getElementById('ef-notes').value.trim(),
  };
  if (!data.description) { alert('La description est obligatoire.'); return; }

  if (State.editingEntryId) {
    DB.updateEntry(State.editingEntryId, data);
    showToast('Entrée modifiée ✓');
  } else {
    DB.createEntry(data);
    showToast('Entrée ajoutée ✓');
  }
  closeModal('entry-modal');
  renderPage(State.currentPage);
}

function deleteEntry(id) {
  if (!confirm('Supprimer cette entrée ?')) return;
  DB.deleteEntry(id);
  showToast('Entrée supprimée');
  closeModal('entry-modal');
  renderPage(State.currentPage);
}

// ─────────────────────────────────────────────
// VEHICLE FORM MODAL
// ─────────────────────────────────────────────
function openVehicleForm(vehicleId = null) {
  State.editingVehicleId = vehicleId;
  const v = vehicleId ? DB.getVehicle(vehicleId) : null;

  const swatches = COLORS.map(c =>
    `<div class="color-swatch ${(v?.color || COLORS[0]) === c ? 'selected' : ''}"
      style="background:${c}" onclick="selectColor(this,'${c}')" data-color="${c}"></div>`
  ).join('');

  document.getElementById('vf-modal-title').textContent = v ? 'Modifier le véhicule' : 'Nouveau véhicule';
  document.getElementById('vf-modal-body').innerHTML = `
    <input type="hidden" id="vf-color" value="${v?.color || COLORS[0]}">
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Marque</label>
        <input class="form-input" type="text" id="vf-brand" placeholder="Peugeot" value="${v?.brand || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Nom court</label>
        <input class="form-input" type="text" id="vf-name" placeholder="308 SW" value="${v?.name || ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Modèle complet</label>
      <input class="form-input" type="text" id="vf-model" placeholder="308 SW 1.2 PureTech EAT8" value="${v?.model || ''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Année</label>
        <input class="form-input" type="number" id="vf-year" placeholder="2019" value="${v?.year || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Carburant</label>
        <select class="form-select" id="vf-fuel">
          ${['Essence','Diesel','Hybride','Électrique','Autre'].map(f =>
            `<option ${(v?.fuel||'Essence') === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Plaque</label>
        <input class="form-input" type="text" id="vf-plate" placeholder="1-ABC-234" value="${v?.licensePlate || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Km actuels</label>
        <input class="form-input" type="number" id="vf-mileage" placeholder="0" value="${v?.mileage || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date d'achat</label>
        <input class="form-input" type="date" id="vf-purchase-date" value="${v?.purchaseDate || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Km à l'achat</label>
        <input class="form-input" type="number" id="vf-purchase-mileage" placeholder="0" value="${v?.purchaseMileage || ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Prix d'achat (€)</label>
      <input class="form-input" type="number" id="vf-purchase-price" placeholder="0" value="${v?.purchasePrice || ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Couleur de la fiche</label>
      <div class="color-swatches">${swatches}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="vf-notes">${v?.notes || ''}</textarea>
    </div>
    <button class="btn btn-primary" onclick="saveVehicle()">
      ${v ? '✓ Enregistrer' : '✓ Créer le véhicule'}
    </button>
    ${v ? `<div class="delete-zone"><button class="btn btn-danger" onclick="deleteVehicle('${v.id}')">🗑 Supprimer ce véhicule</button></div>` : ''}`;

  openModal('vehicle-modal');
}

window.selectColor = function(el, color) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('vf-color').value = color;
};

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
    color:           document.getElementById('vf-color').value,
    notes:           document.getElementById('vf-notes').value.trim(),
  };

  if (State.editingVehicleId) {
    DB.updateVehicle(State.editingVehicleId, data);
    showToast('Véhicule mis à jour ✓');
  } else {
    const v = DB.createVehicle({ ...data, photo: null });
    State.activeVehicleId = v.id;
    showToast('Véhicule créé ✓');
  }
  closeModal('vehicle-modal');
  renderPage(State.currentPage);
}

function deleteVehicle(id) {
  if (!confirm('Supprimer ce véhicule et toutes ses entrées ? Cette action est irréversible.')) return;
  DB.deleteVehicle(id);
  State.activeVehicleId = DB.getVehicles()[0]?.id || null;
  showToast('Véhicule supprimé');
  closeModal('vehicle-modal');
  renderPage(State.currentPage);
}

// ─────────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Seed data from Excel if first launch
  DB.seedDemoData();

  // Set first vehicle active
  const vehicles = DB.getVehicles();
  State.activeVehicleId = vehicles[0]?.id || null;

  // Nav
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });
  document.querySelector('.nav-fab').addEventListener('click', openEntryForm);

  // Modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }

  // Initial render
  navigate('home');
});

// Expose to inline handlers
window.openEntryForm    = openEntryForm;
window.openVehicleForm  = openVehicleForm;
window.triggerPhotoUpload = triggerPhotoUpload;
window.navigate         = navigate;
window.closeModal       = closeModal;
window.saveEntry        = saveEntry;
window.saveVehicle      = saveVehicle;
window.deleteEntry      = deleteEntry;
window.deleteVehicle    = deleteVehicle;

/**
 * db.js — Couche données Mobile Dev v3
 *
 * ARCHITECTURE FIREBASE-READY
 * Nouveautés v3 :
 * - Véhicule : champ serviceInterval (km entre 2 entretiens)
 * - Entrée carburant historique 308 SW (7 986€ / 72 000 km)
 * - Couleur véhicule fixe par défaut (pas de sélecteur UI)
 */

const DB_VEHICLES_KEY = 'mobiledev_vehicles';
const DB_ENTRIES_KEY  = 'mobiledev_entries';

function _load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function _save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function _genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

const DB = {

  // ─── VÉHICULES ──────────────────────────────

  getVehicles() { return _load(DB_VEHICLES_KEY); },
  getVehicle(id) { return this.getVehicles().find(v => v.id === id) || null; },

  createVehicle(data) {
    const vehicles = this.getVehicles();
    const vehicle = { id: _genId(), createdAt: new Date().toISOString(), ...data };
    vehicles.push(vehicle);
    _save(DB_VEHICLES_KEY, vehicles);
    return vehicle;
  },

  updateVehicle(id, data) {
    const vehicles = this.getVehicles();
    const idx = vehicles.findIndex(v => v.id === id);
    if (idx === -1) return null;
    vehicles[idx] = { ...vehicles[idx], ...data, updatedAt: new Date().toISOString() };
    _save(DB_VEHICLES_KEY, vehicles);
    return vehicles[idx];
  },

  deleteVehicle(id) {
    _save(DB_VEHICLES_KEY, this.getVehicles().filter(v => v.id !== id));
    _save(DB_ENTRIES_KEY,  this.getEntries().filter(e => e.vehicleId !== id));
  },

  // ─── ENTRÉES ────────────────────────────────

  getEntries(vehicleId = null) {
    const all = _load(DB_ENTRIES_KEY);
    return vehicleId ? all.filter(e => e.vehicleId === vehicleId) : all;
  },

  getEntry(id) { return this.getEntries().find(e => e.id === id) || null; },

  createEntry(data) {
    const entries = this.getEntries();
    const entry = { id: _genId(), createdAt: new Date().toISOString(), ...data };
    entries.push(entry);
    _save(DB_ENTRIES_KEY, entries);
    this._syncVehicleMileage(data.vehicleId);
    return entry;
  },

  updateEntry(id, data) {
    const entries = this.getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const vehicleId = entries[idx].vehicleId;
    entries[idx] = { ...entries[idx], ...data, updatedAt: new Date().toISOString() };
    _save(DB_ENTRIES_KEY, entries);
    this._syncVehicleMileage(vehicleId);
    return entries[idx];
  },

  deleteEntry(id) {
    const entry = this.getEntry(id);
    if (!entry) return;
    _save(DB_ENTRIES_KEY, this.getEntries().filter(e => e.id !== id));
    this._syncVehicleMileage(entry.vehicleId);
  },

  // ─── STATS ──────────────────────────────────
  // Coût/km = (frais + carburant + prix achat) ÷ km parcourus

  getVehicleStats(vehicleId) {
    const vehicle = this.getVehicle(vehicleId);
    if (!vehicle) return null;
    const entries = this.getEntries(vehicleId);

    const fuelEntries  = entries.filter(e => e.type === 'carburant');
    const otherEntries = entries.filter(e => e.type !== 'carburant');

    const totalFuel    = fuelEntries.reduce((s, e)  => s + (parseFloat(e.cost)   || 0), 0);
    const totalOther   = otherEntries.reduce((s, e) => s + (parseFloat(e.cost)   || 0), 0);
    const totalLiters  = fuelEntries.reduce((s, e)  => s + (parseFloat(e.liters) || 0), 0);
    const purchasePrice = parseFloat(vehicle.purchasePrice) || 0;
    const totalAllInclPurchase = totalOther + totalFuel + purchasePrice;

    const kmDriven  = Math.max(0, (vehicle.mileage || 0) - (parseFloat(vehicle.purchaseMileage) || 0));
    const costPerKm = kmDriven > 0 ? totalAllInclPurchase / kmDriven : 0;

    // Dernier entretien (type entretien, date la plus récente)
    const serviceEntries = otherEntries
      .filter(e => e.type === 'entretien')
      .sort((a, b) => (b.mileage || 0) - (a.mileage || 0));
    const lastService = serviceEntries[0] || null;

    // Prochain entretien
    let nextService = null;
    if (lastService && vehicle.serviceInterval) {
      const nextKm = (lastService.mileage || 0) + parseInt(vehicle.serviceInterval);
      const remaining = nextKm - (vehicle.mileage || 0);
      nextService = { nextKm, remaining, lastKm: lastService.mileage, lastDate: lastService.date };
    }

    const byYear = {};
    entries.forEach(e => {
      const y = e.date ? new Date(e.date).getFullYear() : 'N/A';
      byYear[y] = (byYear[y] || 0) + (parseFloat(e.cost) || 0);
    });

    const byType = {};
    entries.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + (parseFloat(e.cost) || 0);
    });

    return {
      totalOther, totalFuel, totalLiters, purchasePrice,
      totalAllInclPurchase, kmDriven, costPerKm,
      lastService, nextService,
      byYear, byType,
      entryCount: entries.length,
      fuelCount:  fuelEntries.length,
    };
  },

  // ─── INTERNE ────────────────────────────────

  _syncVehicleMileage(vehicleId) {
    const entries = this.getEntries(vehicleId);
    if (!entries.length) return;
    const maxMileage = Math.max(...entries.map(e => parseInt(e.mileage) || 0));
    const vehicle = this.getVehicle(vehicleId);
    if (vehicle && maxMileage > (vehicle.mileage || 0)) {
      this.updateVehicle(vehicleId, { mileage: maxMileage });
    }
  },

  // ─── DONNÉES INITIALES ──────────────────────

  seedDemoData() {
    if (this.getVehicles().length > 0) return;

    const v1 = this.createVehicle({
      name:'308 SW', brand:'Peugeot', model:'308 SW 1.2 PureTech EAT8',
      year:2019, fuel:'Essence', licensePlate:'',
      mileage:109800, purchaseMileage:42500,
      purchaseDate:'2022-08-13', purchasePrice:21780,
      color:'#4d8eff', photo:null, notes:'',
      serviceInterval: 15000, // km entre 2 entretiens
    });

    [
      // Carburant historique global 2022-2025
      { date:'2022-08-13', mileage:42500, type:'carburant', description:'Carburant historique 2022–2025', cost:7986, liters:0, provider:'' },
      // Frais
      { date:'2022-08-13', mileage:42500, type:'achat',      description:'Taxe mise en circulation',                        cost:495,  provider:'Taxe',           invoice:'' },
      { date:'2022-08-13', mileage:42500, type:'assurance',  description:'Assurance annuelle',                              cost:320,  provider:'Yuzzu',          invoice:'' },
      { date:'2023-03-29', mileage:43000, type:'reparation', description:'Cosse électrique mal serrée (garantie)',           cost:0,    provider:'VDC Mouscron',   invoice:'' },
      { date:'2023-03-28', mileage:40000, type:'assurance',  description:'Assurance annuelle',                              cost:634,  provider:'Yuzzu',          invoice:'FA' },
      { date:'2023-04-01', mileage:41000, type:'taxe',       description:'Taxe annuelle',                                   cost:220,  provider:'Taxe',           invoice:'' },
      { date:'2023-07-05', mileage:57400, type:'entretien',  description:'Grand entretien (soufflet cardan, bielette stab)', cost:540,  provider:'VDC Peruwelz',   invoice:'' },
      { date:'2023-07-06', mileage:57500, type:'controle',   description:'Contrôle technique',                              cost:57,   provider:'CT Gislenghien', invoice:'' },
      { date:'2023-08-28', mileage:62000, type:'pneus',      description:'Pneus Landsail 225/40/18 92W x4',                 cost:300,  provider:'PneuOnline',     invoice:'FA-pneu' },
      { date:'2023-12-06', mileage:68000, type:'pneus',      description:'Changement des 4 pneus (pose)',                   cost:50,   provider:'Larivière',      invoice:'' },
      { date:'2024-03-28', mileage:74000, type:'assurance',  description:'Assurance annuelle',                              cost:674,  provider:'Yuzzu',          invoice:'FA' },
      { date:'2024-03-29', mileage:74800, type:'reparation', description:'Soudure jante + voile',                           cost:130,  provider:'SV Service',     invoice:'' },
      { date:'2024-04-01', mileage:75000, type:'taxe',       description:'Taxe annuelle',                                   cost:220,  provider:'Taxe',           invoice:'' },
      { date:'2024-04-02', mileage:75115, type:'controle',   description:'Contrôle technique (retard)',                     cost:112,  provider:'CT Tournai',     invoice:'' },
      { date:'2024-06-05', mileage:77000, type:'entretien',  description:'Petit entretien',                                 cost:217,  provider:'VDC Peruwelz',   invoice:'' },
      { date:'2024-06-15', mileage:77900, type:'reparation', description:'Courroie distribution (garantie)',                cost:0,    provider:'VDC Peruwelz',   invoice:'' },
      { date:'2024-10-04', mileage:85000, type:'taxe',       description:'Taxe annuelle',                                   cost:238,  provider:'Taxe',           invoice:'' },
      { date:'2024-11-14', mileage:88200, type:'entretien',  description:'Achat bidon huile 2,5L',                          cost:56,   provider:'VDC Peruwelz',   invoice:'' },
      { date:'2024-11-27', mileage:89500, type:'reparation', description:'Dépannage Lille',                                 cost:620,  provider:'',               invoice:'' },
      { date:'2024-12-11', mileage:89500, type:'reparation', description:'Remplacement déshuileur + rotule barre stab',     cost:568,  provider:'VDC Peruwelz',   invoice:'' },
      { date:'2025-03-28', mileage:97300, type:'entretien',  description:'Grand entretien',                                 cost:523,  provider:'VDC Peruwelz',   invoice:'' },
      { date:'2025-04-08', mileage:99850, type:'assurance',  description:'Assurance annuelle',                              cost:694,  provider:'Yuzzu',          invoice:'' },
      { date:'2025-07-02', mileage:102000,type:'reparation', description:'Réparation pneu AV G (fuite - vis)',              cost:20,   provider:'J. Morel',       invoice:'' },
      { date:'2025-07-23', mileage:81400, type:'controle',   description:'Contrôle technique',                              cost:56,   provider:'CT Gislenghien', invoice:'' },
      { date:'2025-12-04', mileage:109800,type:'entretien',  description:'Petit entretien (disques + plaquettes AV)',       cost:579,  provider:'VDC Peruwelz',   invoice:'' },
    ].forEach(e => this.createEntry({ vehicleId: v1.id, ...e }));

    this.createVehicle({ name:'Voiture 2', brand:'', model:'', year:null, fuel:'', licensePlate:'', mileage:0, purchaseMileage:0, purchaseDate:'', purchasePrice:0, color:'#20d070', photo:null, notes:'À compléter', serviceInterval:'' });
    this.createVehicle({ name:'Moto',      brand:'', model:'', year:null, fuel:'', licensePlate:'', mileage:0, purchaseMileage:0, purchaseDate:'', purchasePrice:0, color:'#ff7043', photo:null, notes:'À compléter', serviceInterval:'' });
  }
};

/**
 * db.js — Couche données Mobile Dev
 * 
 * ARCHITECTURE FIREBASE-READY :
 * Toute la logique de données passe par ce fichier.
 * Pour migrer vers Firebase, remplacer les fonctions ci-dessous
 * par des appels Firestore — le reste de l'app ne change pas.
 * 
 * Structure des données :
 * - vehicles[]  : liste des véhicules
 * - entries[]   : toutes les entrées (liées à un véhicule par vehicleId)
 * 
 * Véhicule : { id, name, brand, model, year, fuel, licensePlate, mileage, purchaseDate, purchasePrice, photo, color, notes, createdAt }
 * Entrée   : { id, vehicleId, date, mileage, type, description, cost, provider, invoice, notes, createdAt }
 */

// ─────────────────────────────────────────────
// SECTION À REMPLACER POUR FIREBASE
// ─────────────────────────────────────────────

const DB_VEHICLES_KEY = 'mobiledev_vehicles';
const DB_ENTRIES_KEY  = 'mobiledev_entries';

function _load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function _save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─────────────────────────────────────────────
// VÉHICULES
// ─────────────────────────────────────────────

const DB = {

  // Retourne tous les véhicules
  getVehicles() {
    return _load(DB_VEHICLES_KEY);
  },

  // Retourne un véhicule par id
  getVehicle(id) {
    return this.getVehicles().find(v => v.id === id) || null;
  },

  // Crée un véhicule, retourne l'objet créé
  createVehicle(data) {
    const vehicles = this.getVehicles();
    const vehicle = { id: _genId(), createdAt: new Date().toISOString(), ...data };
    vehicles.push(vehicle);
    _save(DB_VEHICLES_KEY, vehicles);
    return vehicle;
  },

  // Met à jour un véhicule
  updateVehicle(id, data) {
    const vehicles = this.getVehicles();
    const idx = vehicles.findIndex(v => v.id === id);
    if (idx === -1) return null;
    vehicles[idx] = { ...vehicles[idx], ...data, updatedAt: new Date().toISOString() };
    _save(DB_VEHICLES_KEY, vehicles);
    return vehicles[idx];
  },

  // Supprime un véhicule et toutes ses entrées
  deleteVehicle(id) {
    const vehicles = this.getVehicles().filter(v => v.id !== id);
    _save(DB_VEHICLES_KEY, vehicles);
    const entries = this.getEntries().filter(e => e.vehicleId !== id);
    _save(DB_ENTRIES_KEY, entries);
  },

  // ─────────────────────────────────────────────
  // ENTRÉES
  // ─────────────────────────────────────────────

  // Toutes les entrées (optionnel: filtrées par vehicleId)
  getEntries(vehicleId = null) {
    const all = _load(DB_ENTRIES_KEY);
    return vehicleId ? all.filter(e => e.vehicleId === vehicleId) : all;
  },

  // Une entrée par id
  getEntry(id) {
    return this.getEntries().find(e => e.id === id) || null;
  },

  // Crée une entrée
  createEntry(data) {
    const entries = this.getEntries();
    const entry = { id: _genId(), createdAt: new Date().toISOString(), ...data };
    entries.push(entry);
    _save(DB_ENTRIES_KEY, entries);

    // Met à jour le kilométrage du véhicule si l'entrée est plus récente
    this._syncVehicleMileage(data.vehicleId);
    return entry;
  },

  // Met à jour une entrée
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

  // Supprime une entrée
  deleteEntry(id) {
    const entry = this.getEntry(id);
    if (!entry) return;
    const entries = this.getEntries().filter(e => e.id !== id);
    _save(DB_ENTRIES_KEY, entries);
    this._syncVehicleMileage(entry.vehicleId);
  },

  // ─────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────

  getVehicleStats(vehicleId) {
    const vehicle = this.getVehicle(vehicleId);
    if (!vehicle) return null;
    const entries = this.getEntries(vehicleId);

    const totalCost = entries.reduce((s, e) => s + (parseFloat(e.cost) || 0), 0);
    const purchasePrice = parseFloat(vehicle.purchasePrice) || 0;
    const totalWithPurchase = totalCost + purchasePrice;

    const kmDriven = (vehicle.mileage || 0) - (parseFloat(vehicle.purchaseMileage) || 0);
    const costPerKm = kmDriven > 0 ? totalCost / kmDriven : 0;

    // Dépenses par année
    const byYear = {};
    entries.forEach(e => {
      const y = e.date ? new Date(e.date).getFullYear() : 'N/A';
      byYear[y] = (byYear[y] || 0) + (parseFloat(e.cost) || 0);
    });

    // Dépenses par type
    const byType = {};
    entries.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + (parseFloat(e.cost) || 0);
    });

    return { totalCost, purchasePrice, totalWithPurchase, kmDriven, costPerKm, byYear, byType, entryCount: entries.length };
  },

  // ─────────────────────────────────────────────
  // INTERNE
  // ─────────────────────────────────────────────

  _syncVehicleMileage(vehicleId) {
    const entries = this.getEntries(vehicleId);
    if (entries.length === 0) return;
    const maxMileage = Math.max(...entries.map(e => parseInt(e.mileage) || 0));
    const vehicle = this.getVehicle(vehicleId);
    if (vehicle && maxMileage > (vehicle.mileage || 0)) {
      this.updateVehicle(vehicleId, { mileage: maxMileage });
    }
  },

  // ─────────────────────────────────────────────
  // IMPORT depuis Excel (données initiales)
  // ─────────────────────────────────────────────

  seedDemoData() {
    if (this.getVehicles().length > 0) return; // ne pas écraser si déjà des données

    const v1 = this.createVehicle({
      name: '308 SW',
      brand: 'Peugeot',
      model: '308 SW 1.2 PureTech EAT8',
      year: 2019,
      fuel: 'Essence',
      licensePlate: '',
      mileage: 109800,
      purchaseMileage: 42500,
      purchaseDate: '2022-08-13',
      purchasePrice: 21780,
      color: '#4d8eff',
      photo: null,
      notes: ''
    });

    const entries1 = [
      { date:'2022-08-13', mileage:42500, type:'achat',      description:'Taxe mise en circulation',             cost:495,  provider:'Taxe',          invoice:'' },
      { date:'2022-08-13', mileage:42500, type:'assurance',  description:'Assurance annuelle',                   cost:320,  provider:'Yuzzu',         invoice:'' },
      { date:'2023-03-29', mileage:43000, type:'reparation', description:'Cosse électrique mal serrée (garantie)',cost:0,   provider:'VDC Mouscron',  invoice:'' },
      { date:'2023-03-28', mileage:40000, type:'assurance',  description:'Assurance annuelle',                   cost:634,  provider:'Yuzzu',         invoice:'FA' },
      { date:'2023-04-01', mileage:41000, type:'taxe',       description:'Taxe annuelle',                        cost:220,  provider:'Taxe',          invoice:'' },
      { date:'2023-07-05', mileage:57400, type:'entretien',  description:'Grand entretien (soufflet cardan, bielette barre stab)', cost:540, provider:'VDC Peruwelz', invoice:'' },
      { date:'2023-07-06', mileage:57500, type:'controle',   description:'Contrôle technique',                   cost:57,   provider:'CT Gislenghien',invoice:'' },
      { date:'2023-08-28', mileage:62000, type:'pneus',      description:'Pneus Landsail 225/40/18 92W x4',      cost:300,  provider:'PneuOnline',    invoice:'FA-pneu' },
      { date:'2023-12-06', mileage:68000, type:'pneus',      description:'Changement des 4 pneus (pose)',        cost:50,   provider:'Larivière',     invoice:'' },
      { date:'2024-03-28', mileage:74000, type:'assurance',  description:'Assurance annuelle',                   cost:674,  provider:'Yuzzu',         invoice:'FA' },
      { date:'2024-03-29', mileage:74800, type:'reparation', description:'Soudure jante + voile',                cost:130,  provider:'SV Service',    invoice:'' },
      { date:'2024-04-01', mileage:75000, type:'taxe',       description:'Taxe annuelle',                        cost:220,  provider:'Taxe',          invoice:'' },
      { date:'2024-04-02', mileage:75115, type:'controle',   description:'Contrôle technique (retard)',          cost:112,  provider:'CT Tournai',    invoice:'' },
      { date:'2024-06-05', mileage:77000, type:'entretien',  description:'Petit entretien',                      cost:217,  provider:'VDC Peruwelz',  invoice:'' },
      { date:'2024-06-15', mileage:77900, type:'reparation', description:'Courroie distribution (garantie)',     cost:0,    provider:'VDC Peruwelz',  invoice:'' },
      { date:'2024-10-04', mileage:85000, type:'taxe',       description:'Taxe annuelle',                        cost:238,  provider:'Taxe',          invoice:'' },
      { date:'2024-11-14', mileage:88200, type:'entretien',  description:'Achat bidon huile 2,5L',               cost:56,   provider:'VDC Peruwelz',  invoice:'' },
      { date:'2024-11-27', mileage:89500, type:'reparation', description:'Dépannage Lille',                      cost:620,  provider:'',              invoice:'' },
      { date:'2024-12-11', mileage:89500, type:'reparation', description:'Remplacement déshuileur + rotule barre stab', cost:568, provider:'VDC Peruwelz', invoice:'' },
      { date:'2025-03-28', mileage:97300, type:'entretien',  description:'Grand entretien',                      cost:523,  provider:'VDC Peruwelz',  invoice:'' },
      { date:'2025-04-08', mileage:99850, type:'assurance',  description:'Assurance annuelle',                   cost:694,  provider:'Yuzzu',         invoice:'' },
      { date:'2025-07-02', mileage:102000,type:'reparation', description:'Réparation pneu AV G (fuite - vis)',   cost:20,   provider:'J. Morel',      invoice:'' },
      { date:'2025-07-23', mileage:81400, type:'controle',   description:'Contrôle technique',                   cost:56,   provider:'CT Gislenghien',invoice:'' },
      { date:'2025-12-04', mileage:109800,type:'entretien',  description:'Petit entretien (disques + plaquettes AV)', cost:579, provider:'VDC Peruwelz', invoice:'' },
    ];

    entries1.forEach(e => this.createEntry({ vehicleId: v1.id, ...e }));

    // Véhicule 2 — placeholder
    this.createVehicle({
      name: 'Voiture 2',
      brand: '',
      model: '',
      year: null,
      fuel: '',
      licensePlate: '',
      mileage: 0,
      purchaseMileage: 0,
      purchaseDate: '',
      purchasePrice: 0,
      color: '#20d070',
      photo: null,
      notes: 'À compléter'
    });

    // Véhicule 3 — placeholder moto
    this.createVehicle({
      name: 'Moto',
      brand: '',
      model: '',
      year: null,
      fuel: '',
      licensePlate: '',
      mileage: 0,
      purchaseMileage: 0,
      purchaseDate: '',
      purchasePrice: 0,
      color: '#ff7043',
      photo: null,
      notes: 'À compléter'
    });
  }
};

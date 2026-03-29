/**
 * db.js — Couche données Mobile Dev v4
 * Firebase Firestore + Auth Google
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── CONFIG FIREBASE ────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCU6_pfYBTTRH64hgRYhWIxcC-yt45vBNA",
  authDomain:        "mobiledev-4858b.firebaseapp.com",
  projectId:         "mobiledev-4858b",
  storageBucket:     "mobiledev-4858b.firebasestorage.app",
  messagingSenderId: "801990963332",
  appId:             "1:801990963332:web:391abefb8201e74268d2d1",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);

// ─── AUTH ────────────────────────────────────
let currentUser = null;

export function getCurrentUser() { return currentUser; }

export function onAuthReady(callback) {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    callback(user);
  });
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error('Erreur connexion Google', e);
    alert('Erreur de connexion. Réessaie.');
  }
}

export async function signOutUser() {
  await signOut(auth);
}

// ─── HELPERS ────────────────────────────────
function _genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function _uid() {
  if (!currentUser) throw new Error('Non connecté');
  return currentUser.uid;
}

function _vehiclesCol() { return collection(db, 'users', _uid(), 'vehicles'); }
function _entriesCol()  { return collection(db, 'users', _uid(), 'entries');  }

// ─── VÉHICULES ──────────────────────────────

export async function getVehicles() {
  const snap = await getDocs(_vehiclesCol());
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getVehicle(id) {
  const snap = await getDoc(doc(_vehiclesCol(), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createVehicle(data) {
  const id = _genId();
  const vehicle = { createdAt: new Date().toISOString(), ...data };
  await setDoc(doc(_vehiclesCol(), id), vehicle);
  return { id, ...vehicle };
}

export async function updateVehicle(id, data) {
  await updateDoc(doc(_vehiclesCol(), id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteVehicle(id) {
  await deleteDoc(doc(_vehiclesCol(), id));
  // Supprimer toutes les entrées liées
  const snap = await getDocs(query(_entriesCol(), where('vehicleId', '==', id)));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ─── ENTRÉES ────────────────────────────────

export async function getEntries(vehicleId = null) {
  let q = vehicleId
    ? query(_entriesCol(), where('vehicleId', '==', vehicleId))
    : _entriesCol();
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getEntry(id) {
  const snap = await getDoc(doc(_entriesCol(), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createEntry(data) {
  const id = _genId();
  const entry = { createdAt: new Date().toISOString(), ...data };
  await setDoc(doc(_entriesCol(), id), entry);
  await _syncVehicleMileage(data.vehicleId);
  return { id, ...entry };
}

export async function updateEntry(id, data) {
  const snap = await getDoc(doc(_entriesCol(), id));
  if (!snap.exists()) return null;
  const vehicleId = snap.data().vehicleId;
  await updateDoc(doc(_entriesCol(), id), { ...data, updatedAt: new Date().toISOString() });
  await _syncVehicleMileage(vehicleId);
}

export async function deleteEntry(id) {
  const snap = await getDoc(doc(_entriesCol(), id));
  if (!snap.exists()) return;
  const vehicleId = snap.data().vehicleId;
  await deleteDoc(doc(_entriesCol(), id));
  await _syncVehicleMileage(vehicleId);
}

// ─── STATS ──────────────────────────────────

export async function getVehicleStats(vehicleId) {
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) return null;
  const entries = await getEntries(vehicleId);

  const fuelEntries  = entries.filter(e => e.type === 'carburant');
  const otherEntries = entries.filter(e => e.type !== 'carburant');

  const totalFuel    = fuelEntries.reduce((s, e)  => s + (parseFloat(e.cost)   || 0), 0);
  const totalOther   = otherEntries.reduce((s, e) => s + (parseFloat(e.cost)   || 0), 0);
  const totalLiters  = fuelEntries.reduce((s, e)  => s + (parseFloat(e.liters) || 0), 0);
  const purchasePrice = parseFloat(vehicle.purchasePrice) || 0;
  const totalAllInclPurchase = totalOther + totalFuel + purchasePrice;

  const kmDriven  = Math.max(0, (vehicle.mileage || 0) - (parseFloat(vehicle.purchaseMileage) || 0));
  const costPerKm = kmDriven > 0 ? totalAllInclPurchase / kmDriven : 0;

  const serviceEntries = otherEntries
    .filter(e => e.type === 'entretien')
    .sort((a, b) => (b.mileage || 0) - (a.mileage || 0));
  const lastService = serviceEntries[0] || null;

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
}

// ─── INTERNE ────────────────────────────────

async function _syncVehicleMileage(vehicleId) {
  const entries = await getEntries(vehicleId);
  if (!entries.length) return;
  const maxMileage = Math.max(...entries.map(e => parseInt(e.mileage) || 0));
  const vehicle = await getVehicle(vehicleId);
  if (vehicle && maxMileage > (vehicle.mileage || 0)) {
    await updateVehicle(vehicleId, { mileage: maxMileage });
  }
}

// ─── DONNÉES INITIALES (première connexion) ─

export async function seedDemoData() {
  const vehicles = await getVehicles();
  if (vehicles.length > 0) return;

  const v1 = await createVehicle({
    name:'308 SW', brand:'Peugeot', model:'308 SW 1.2 PureTech EAT8',
    year:2019, fuel:'Essence', licensePlate:'',
    mileage:109800, purchaseMileage:42500,
    purchaseDate:'2022-08-13', purchasePrice:21780,
    color:'#4d8eff', photo:null, notes:'',
    serviceInterval: 15000,
  });

  const entries = [
    { date:'2022-12-31', mileage:45600,  type:'carburant', description:'Carburant 2022 (août–déc)', cost:374,  liters:202.2,  provider:'Historique' },
    { date:'2023-12-31', mileage:68000,  type:'carburant', description:'Carburant 2023',            cost:2449, liters:1423.8, provider:'Historique' },
    { date:'2024-12-31', mileage:89500,  type:'carburant', description:'Carburant 2024',            cost:2342, liters:1419.4, provider:'Historique' },
    { date:'2025-12-31', mileage:109800, type:'carburant', description:'Carburant 2025',            cost:2379, liters:1505.7, provider:'Historique' },
    { date:'2026-03-01', mileage:109800, type:'carburant', description:'Carburant 2026 (à ce jour)',cost:442,  liters:285.2,  provider:'Historique' },
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
  ];

  for (const e of entries) {
    await createEntry({ vehicleId: v1.id, ...e });
  }

  await createVehicle({ name:'Voiture 2', brand:'', model:'', year:null, fuel:'', licensePlate:'', mileage:0, purchaseMileage:0, purchaseDate:'', purchasePrice:0, color:'#20d070', photo:null, notes:'À compléter', serviceInterval:'' });
  await createVehicle({ name:'Moto',      brand:'', model:'', year:null, fuel:'', licensePlate:'', mileage:0, purchaseMileage:0, purchaseDate:'', purchasePrice:0, color:'#ff7043', photo:null, notes:'À compléter', serviceInterval:'' });
}

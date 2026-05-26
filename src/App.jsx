/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { Database, ClipboardPaste, Calculator, CheckCircle, AlertCircle, Info, Table, UserPlus, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Fallback config untuk keamanan build Vercel
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Deteksi environment (Canvas vs Vercel)
const isCanvas = typeof __firebase_config !== 'undefined';

const getFirebaseConfig = () => {
  if (isCanvas) {
    return JSON.parse(__firebase_config);
  }
  return firebaseConfig; // SUDAH DIPERBAIKI DI SINI
};

const app = initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);

// Inisialisasi Analytics
const initAnalytics = () => {
  if (typeof window !== 'undefined' && !isCanvas) {
    try { 
      return getAnalytics(app); 
    } catch (e) { 
      console.warn("Analytics error:", e);
      return null; 
    }
  }
  return null;
};
const analytics = initAnalytics();

export default function App() {
  const [activeTab, setActiveTab] = useState('database');
  const [user, setUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  const [personnel, setPersonnel] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});
  const [monthlyData, setMonthlyData] = useState({});
  const [newEmp, setNewEmp] = useState({ nama: '', area: 'C', role: 'SO' });
  const [selectedRoleContext, setSelectedRoleContext] = useState('SO');
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [selectedIndicator, setSelectedIndicator] = useState('obs');
  const [pasteText, setPasteText] = useState('');

  // STATE BARU: Untuk fitur Edit dan Hapus (Modal)
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ nama: '', area: '', role: '' });
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nama: '' });

  // Menggunakan ID murni agar tidak terblokir oleh aturan keamanan Firestore
  const getAppId = () => typeof __app_id !== 'undefined' ? __app_id : 'bufn2-kpi-app';

  const weeks = [
    { id: 'w1', label: 'Minggu 1' }, { id: 'w2', label: 'Minggu 2' },
    { id: 'w3', label: 'Minggu 3' }, { id: 'w4', label: 'Minggu 4' }, { id: 'w5', label: 'Minggu 5' }
  ];

  const soCategories = [
    { key: 'obs', label: 'Observasi', target: 200, isTargeted: true },
    { key: 'iden', label: 'Identifikasi Bahaya', target: 16, isTargeted: true },
    { key: 'st', label: 'Safety Talk', target: 8, isTargeted: true },
    { key: 'ss', label: 'Safety Sharing', target: 28, isTargeted: true },
    { key: 'si', label: 'Safety Inspection', target: null, isTargeted: false },
    { key: 'ps', label: 'Pelatihan Safety (Internal)', target: null, isTargeted: false }
  ];

  const wfsoCategories = [
    { key: 'obs', label: 'Observasi', target: 140, isTargeted: true },
    { key: 'iden', label: 'Identifikasi Bahaya', target: 12, isTargeted: true },
    { key: 'ste', label: 'Safety Training (External)', target: 8, isTargeted: true },
    { key: 'st', label: 'Safety Talk', target: 8, isTargeted: true },
    { key: 'ss', label: 'Safety Sharing', target: 20, isTargeted: true },
    { key: 'si', label: 'Safety Inspection', target: null, isTargeted: false },
    { key: 'ps', label: 'Pelatihan Safety (Internal)', target: null, isTargeted: false }
  ];

  const getActiveCategories = (role) => role === 'SO' ? soCategories : wfsoCategories;

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth err", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const appId = getAppId();
    
    try {
      const unsubPersonnel = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'personnel'), 
        (s) => { const d = []; s.forEach(doc => d.push(doc.data())); setPersonnel(d); },
        (e) => console.error("Error Personnel:", e)
      );
      
      const unsubWeekly = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'weeklyData'), 
        (s) => { const d = {}; s.forEach(doc => { d[doc.id] = doc.data(); }); setWeeklyData(d); },
        (e) => console.error("Error Weekly:", e)
      );
      
      const unsubMonthly = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'monthlyData'), 
        (s) => { const d = {}; s.forEach(doc => { d[doc.id] = doc.data(); }); setMonthlyData(d); setIsDbReady(true); },
        (e) => console.error("Error Monthly:", e)
      );
      
      return () => { unsubPersonnel(); unsubWeekly(); unsubMonthly(); };
    } catch (err) {
      console.error("Firestore Exception:", err);
    }
  }, [user]);

  const handleAddPersonnel = async (e) => {
    e.preventDefault();
    if (!newEmp.nama.trim()) return;
    
    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'personnel', newId);
    
    await setDoc(docRef, { ...newEmp, id: newId });
    setNewEmp({ nama: '', area: 'C', role: 'SO' });
  };

  // FUNGSI BARU: Logika Edit
  const handleEditClick = (Karyawan) => {
    setEditingId(Karyawan.id);
    setEditFormData({ nama: Karyawan.nama, area: Karyawan.area, role: Karyawan.role });
  };

  const handleSaveEdit = async () => {
    if (!editFormData.nama.trim()) return;
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'personnel', editingId);
    await setDoc(docRef, editFormData, { merge: true });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  // FUNGSI BARU: Logika Hapus dengan Modal
  const requestDelete = (id, nama) => {
    setDeleteModal({ show: true, id, nama });
  };

  const confirmDelete = async () => {
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'personnel', deleteModal.id);
    await deleteDoc(docRef);
    setDeleteModal({ show: false, id: null, nama: '' });
  };

  const handleProcessPaste = async () => {
    if (!pasteText.trim()) {
      alert('Silahkan masukkan teks data terlebih dahulu.');
      return;
    }

    const lines = pasteText.split('\n');
    let successCount = 0;
    let failedNames = [];
    const updates = {};

    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim()).filter(p => p !== '');
      if (parts.length < 2) return;

      let namaPaste = parts[0];
      let nilai = 0;

      const isAreaColumn = ['C', 'E', 'F'].includes(parts[1].toUpperCase());
      if (isAreaColumn && parts.length >= 3) {
        nilai = parseFloat(parts[2].replace(',', '.')) || 0;
      } else {
        nilai = parseFloat(parts[1].replace(',', '.')) || 0;
      }

      const emp = personnel.find(p => p.nama.toLowerCase() === namaPaste.toLowerCase() && p.role === selectedRoleContext);

      if (emp) {
        if (!updates[emp.id]) updates[emp.id] = {};
        if (!updates[emp.id][selectedWeek]) updates[emp.id][selectedWeek] = {};
        updates[emp.id][selectedWeek][selectedIndicator] = nilai;
        successCount++;
      } else {
        failedNames.push(namaPaste);
      }
    });

    for (const empId of Object.keys(updates)) {
      const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'weeklyData', empId);
      await setDoc(docRef, updates[empId], { merge: true });
    }

    setPasteText('');
    let msg = `Berhasil memproses & memasukkan ${successCount} data capaian!`;
    if (failedNames.length > 0) {
      msg += `\n\nPERINGATAN: Ada baris ditolak karena nama tidak terdaftar/berbeda Role:\n- ${Array.from(new Set(failedNames)).slice(0, 5).join('\n- ')}`;
    }
    alert(msg);
  };

  const handleMonthlyInput = (empId, field, value) => {
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'monthlyData', empId);
    setDoc(docRef, { [field]: value }, { merge: true });
  };

  const getAccumulatedData = (empId, role) => {
    const empData = weeklyData[empId] || {};
    const total = {};
    const cats = getActiveCategories(role);
    cats.forEach(c => total[c.key] = 0);
    Object.values(empData).forEach(weekData => {
      cats.forEach(c => { total[c.key] += (weekData[c.key] || 0); });
    });
    return total;
  };

  const calculateGrade = (skorAkhir, kepatuhan, keterangan) => {
    const ket = (keterangan || "").toLowerCase();
    if (ket.includes("ijin") || ket.includes("cuti")) return "C";
    if (skorAkhir >= 170 && kepatuhan === 100) return "A";
    if (skorAkhir >= 141 && skorAkhir <= 169 && kepatuhan === 100) return "B";
    if (skorAkhir >= 100 && skorAkhir <= 140 && kepatuhan === 100) return "C";
    return "D";
  };

  const filteredPersonnel = personnel.filter(p => p.role === selectedRoleContext);

  if (!isDbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-emerald-700">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-semibold tracking-wider">Menghubungkan ke Database Cloud...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-12 relative">
      <header className="bg-emerald-800 text-white p-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CheckCircle size={36} className="text-emerald-300" />
            <div>
              <h1 className="text-2xl font-bold tracking-wide">KPI HSE BUFN 2</h1>
              <p className="text-emerald-200 text-sm mt-0.5">Firebase Cloud Connected</p>
            </div>
          </div>
          <div className="bg-emerald-900 px-4 py-2 rounded-lg border border-emerald-700 text-xs">
            Status: <span className="font-bold text-green-400">ONLINE</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-6 px-4">
        <div className="flex flex-wrap space-x-1 border-b border-slate-300 mb-6">
          <button onClick={() => setActiveTab('database')} className={`px-5 py-3 font-semibold rounded-t-lg transition-colors ${activeTab === 'database' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}>Database</button>
          <button onClick={() => setActiveTab('input')} className={`px-5 py-3 font-semibold rounded-t-lg transition-colors ${activeTab === 'input' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}>Input</button>
          <button onClick={() => setActiveTab('laporan')} className={`px-5 py-3 font-semibold rounded-t-lg transition-colors ${activeTab === 'laporan' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}>Laporan</button>
        </div>

        {/* TAB DATABASE */}
        {activeTab === 'database' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Tambah Karyawan</h2>
            <form onSubmit={handleAddPersonnel} className="flex flex-wrap gap-4 items-end mb-8">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Nama Karyawan</label>
                <input type="text" required className="border border-slate-300 rounded p-2 focus:ring-emerald-500" value={newEmp.nama} onChange={e => setNewEmp({...newEmp, nama: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Area</label>
                <select className="border border-slate-300 rounded p-2" value={newEmp.area} onChange={e => setNewEmp({...newEmp, area: e.target.value})}>
                  <option value="C">Smelter C</option><option value="E">Smelter E</option><option value="F">Smelter F</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Role</label>
                <select className="border border-slate-300 rounded p-2" value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})}>
                  <option value="SO">Safety Officer</option><option value="WFSO">Wakil Foreman</option>
                </select>
              </div>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded">Tambah Karyawan</button>
            </form>

            <h2 className="text-xl font-bold text-slate-800 mb-4">Daftar Karyawan</h2>
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100">
                <tr><th className="p-3 border-b">Nama</th><th className="p-3 border-b">Area</th><th className="p-3 border-b">Role</th><th className="p-3 border-b text-center">Aksi</th></tr>
              </thead>
              <tbody>
                {personnel.map(p => (
                  <tr key={p.id} className="border-b hover:bg-slate-50">
                    {/* MODE EDIT JIKA ID COCOK */}
                    {editingId === p.id ? (
                      <>
                        <td className="p-2">
                          <input type="text" className="border rounded p-1 w-full" value={editFormData.nama} onChange={(e) => setEditFormData({...editFormData, nama: e.target.value})} />
                        </td>
                        <td className="p-2">
                          <select className="border rounded p-1" value={editFormData.area} onChange={(e) => setEditFormData({...editFormData, area: e.target.value})}>
                            <option value="C">Area C</option><option value="E">Area E</option><option value="F">Area F</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select className="border rounded p-1" value={editFormData.role} onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}>
                            <option value="SO">Safety Officer</option><option value="WFSO">Wakil Foreman</option>
                          </select>
                        </td>
                        <td className="p-2 text-center space-x-2">
                          <button onClick={handleSaveEdit} className="text-white bg-emerald-600 px-3 py-1 rounded font-bold text-xs">Simpan</button>
                          <button onClick={cancelEdit} className="text-slate-600 bg-slate-200 px-3 py-1 rounded font-bold text-xs">Batal</button>
                        </td>
                      </>
                    ) : (
                      // TAMPILAN NORMAL
                      <>
                        <td className="p-3">{p.nama}</td>
                        <td className="p-3 font-bold text-slate-500">{p.area}</td>
                        <td className="p-3">{p.role === 'SO' ? 'Safety Officer' : 'Wakil Foreman'}</td>
                        <td className="p-3 text-center space-x-3">
                          <button onClick={() => handleEditClick(p)} className="text-blue-500 hover:text-blue-700" title="Edit">
                            <Edit size={18}/>
                          </button>
                          <button onClick={() => requestDelete(p.id, p.nama)} className="text-red-500 hover:text-red-700" title="Hapus">
                            <Trash2 size={18}/>
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CONTROLS (Input & Laporan) */}
        {(activeTab === 'input' || activeTab === 'laporan') && (
          <div className="mb-4 bg-white p-4 rounded-lg shadow-sm flex items-center gap-4 border border-slate-200">
            <span className="font-bold text-slate-700">Filter Jabatan:</span>
            <button onClick={() => setSelectedRoleContext('SO')} className={`px-4 py-1.5 rounded font-bold ${selectedRoleContext === 'SO' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500'}`}>Safety Officer</button>
            <button onClick={() => setSelectedRoleContext('WFSO')} className={`px-4 py-1.5 rounded font-bold ${selectedRoleContext === 'WFSO' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-500'}`}>Wakil Foreman</button>
          </div>
        )}

        {/* TAB INPUT */}
        {activeTab === 'input' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-bold mb-4">Paste Data Mingguan</h2>
                  <select className="border p-2 mb-2 w-full rounded" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
                    {weeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                  </select>
                  <select className="border p-2 mb-4 w-full rounded" value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>
                    {getActiveCategories(selectedRoleContext).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <textarea className="w-full border p-3 h-48 rounded bg-slate-50 text-sm font-mono" placeholder="Nama [Tab] Nilai" value={pasteText} onChange={(e) => setPasteText(e.target.value)}></textarea>
                  <button onClick={handleProcessPaste} className="w-full bg-emerald-600 text-white font-bold py-3 mt-3 rounded">Proses Data</button>
                </div>
                <div>
                  <h2 className="font-bold mb-4">Preview Data ({selectedRoleContext})</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr><th className="p-2 text-left">Nama</th>{getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-2">{c.label}</th>)}</tr>
                      </thead>
                      <tbody>
                        {filteredPersonnel.map(p => {
                          const wData = weeklyData[p.id]?.[selectedWeek] || {};
                          return (
                            <tr key={p.id} className="border-b">
                              <td className="p-2">{p.nama}</td>
                              {getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-2 text-center">{wData[c.key] || '-'}</td>)}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* TAB LAPORAN */}
        {activeTab === 'laporan' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
             <h2 className="font-bold text-xl mb-4">Rekap Laporan {selectedRoleContext === 'SO' ? 'Safety Officer' : 'Wakil Foreman'}</h2>
             <table className="w-full text-xs border-collapse whitespace-nowrap">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="p-3 text-left">Nama</th>
                    <th className="p-3">Area</th> {/* KOLOM AREA DITAMBAHKAN */}
                    {getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-3">{c.label}</th>)}
                    <th className="p-3 bg-slate-700">Skor Awal</th>
                    <th className="p-3 bg-slate-700">+ Poin</th>
                    <th className="p-3 bg-slate-700">Pelanggaran</th>
                    <th className="p-3 bg-slate-700">Penalti</th>
                    <th className="p-3 bg-emerald-900">Kepatuhan</th>
                    <th className="p-3 bg-emerald-900">Ket.</th>
                    <th className="p-3 bg-emerald-700">SKOR AKHIR</th>
                    <th className="p-3 bg-emerald-600">NILAI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonnel.map(p => {
                    const acc = getAccumulatedData(p.id, selectedRoleContext);
                    const um = monthlyData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' };
                    let sAwal = 100, tPoin = 0, penalti = -(um.pelanggaran * 5), sAkhir = 0;
                    
                    if (selectedRoleContext === 'SO') {
                      sAwal = 100 - ( (acc.obs>=200?0:(200-acc.obs)/200*25) + (acc.iden>=16?0:(16-acc.iden)/16*25) + (acc.st>=8?0:(8-acc.st)/8*25) + (acc.ss>=28?0:(28-acc.ss)/28*25) );
                      tPoin = (acc.si||0) + (acc.ps||0) + parseInt(um.kepatuhan);
                    } else {
                      sAwal = 100 - ( (acc.obs>=140?0:(140-acc.obs)/140*20) + (acc.iden>=12?0:(12-acc.iden)/12*20) + (acc.ste>=8?0:(8-acc.ste)/8*20) + (acc.st>=8?0:(8-acc.st)/8*20) + (acc.ss>=20?0:(20-acc.ss)/20*20) );
                      tPoin = (acc.si||0) + (acc.ps||0) + parseInt(um.kepatuhan);
                    }
                    if(sAwal < 0) sAwal = 0;
                    sAkhir = sAwal + tPoin + penalti;
                    const grade = calculateGrade(sAkhir, parseInt(um.kepatuhan), um.keterangan);

                    return (
                      <tr key={p.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-bold">{p.nama}</td>
                        <td className="p-3 text-center font-bold text-slate-500 bg-slate-50/50">{p.area}</td> {/* DATA AREA DITAMBAHKAN */}
                        {getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-3 text-center border-l">{acc[c.key]||0}</td>)}
                        <td className="p-3 text-center border-l bg-slate-50">{sAwal.toFixed(1)}</td>
                        <td className="p-3 text-center bg-slate-50">{tPoin}</td>
                        <td className="p-2 text-center bg-red-50/30 border-l"><input type="number" className="w-12 border p-1" value={um.pelanggaran} onChange={e=>handleMonthlyInput(p.id, 'pelanggaran', e.target.value)}/></td>
                        <td className="p-3 text-center text-red-600 bg-red-50/30">{penalti}</td>
                        <td className="p-2 text-center border-l bg-emerald-50/30">
                          <select className="border p-1" value={um.kepatuhan} onChange={e=>handleMonthlyInput(p.id, 'kepatuhan', e.target.value)}>
                            <option value="25">25</option><option value="50">50</option><option value="75">75</option><option value="100">100</option>
                          </select>
                        </td>
                        <td className="p-2 bg-emerald-50/30"><input type="text" className="w-20 border p-1 text-xs" placeholder="Cuti/Ijin" value={um.keterangan} onChange={e=>handleMonthlyInput(p.id, 'keterangan', e.target.value)}/></td>
                        <td className="p-3 text-center font-bold text-emerald-800 bg-emerald-100/50">{sAkhir.toFixed(1)}</td>
                        <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-white font-bold ${grade==='A'?'bg-green-500':grade==='B'?'bg-lime-500':grade==='C'?'bg-yellow-500':'bg-red-500'}`}>{grade}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
             </table>
          </div>
        )}
      </main>

      {/* MODAL HAPUS KUSTOM */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 p-3 rounded-full mb-4">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Karyawan?</h3>
              <p className="text-slate-600 mb-6 text-sm">
                Apakah Anda yakin ingin menghapus <b>{deleteModal.nama}</b>? Semua data mingguan dan bulanan Karyawan ini juga akan hilang dari laporan.
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setDeleteModal({ show: false, id: null, nama: '' })} 
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmDelete} 
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

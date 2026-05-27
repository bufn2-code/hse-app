/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { Database, ClipboardPaste, Calculator, CheckCircle, Table, Trash2, Edit, AlertTriangle, Download, Search, LayoutDashboard, Calendar, TrendingDown } from 'lucide-react';
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

const isCanvas = typeof __firebase_config !== 'undefined';

const getFirebaseConfig = () => {
  if (isCanvas) return JSON.parse(__firebase_config);
  return firebaseConfig; 
};

const app = initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);

const initAnalytics = () => {
  if (typeof window !== 'undefined' && !isCanvas) {
    try { return getAnalytics(app); } catch (e) { return null; }
  } return null;
};
const analytics = initAnalytics();

export default function App() {
  // STATE NAVIGASI & PERIODE
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState('2026-05'); // Default Bulan
  
  // STATE DATA
  const [user, setUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  const [personnel, setPersonnel] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});
  const [monthlyData, setMonthlyData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // STATE INPUT & FORM
  const [newEmp, setNewEmp] = useState({ nama: '', area: 'C', role: 'SO' });
  const [selectedRoleContext, setSelectedRoleContext] = useState('SO');
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [selectedIndicator, setSelectedIndicator] = useState('obs');
  const [pasteText, setPasteText] = useState('');

  // STATE MODAL
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ nama: '', area: '', role: '' });
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nama: '' });

  const getAppId = () => typeof __app_id !== 'undefined' ? __app_id : 'bufn2-kpi-app';
  const areaList = ['C', 'E', 'F']; 

  const periodList = [
    { id: '2026-04', label: 'April 2026' },
    { id: '2026-05', label: 'Mei 2026' },
    { id: '2026-06', label: 'Juni 2026' },
    { id: '2026-07', label: 'Juli 2026' },
    { id: '2026-08', label: 'Agustus 2026' },
  ];

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

  // FIREBASE AUTH
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

  // FIREBASE REALTIME LISTENERS
  useEffect(() => {
    if (!user) return;
    const appId = getAppId();
    setIsDbReady(false);
    
    try {
      // 1. Personnel bersifat Global (Tidak terpengaruh Periode)
      const unsubPersonnel = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'personnel'), 
        (s) => { const d = []; s.forEach(doc => d.push(doc.data())); setPersonnel(d); },
        (e) => console.error("Error Personnel:", e)
      );
      
      // 2. Data Mingguan bergantung pada Periode
      const unsubWeekly = onSnapshot(collection(db, 'artifacts', appId, 'public', 'periode', selectedPeriod, 'weeklyData'), 
        (s) => { const d = {}; s.forEach(doc => { d[doc.id] = doc.data(); }); setWeeklyData(d); },
        (e) => console.error("Error Weekly:", e)
      );
      
      // 3. Data Bulanan bergantung pada Periode
      const unsubMonthly = onSnapshot(collection(db, 'artifacts', appId, 'public', 'periode', selectedPeriod, 'monthlyData'), 
        (s) => { const d = {}; s.forEach(doc => { d[doc.id] = doc.data(); }); setMonthlyData(d); setIsDbReady(true); },
        (e) => console.error("Error Monthly:", e)
      );
      
      return () => { unsubPersonnel(); unsubWeekly(); unsubMonthly(); };
    } catch (err) {
      console.error("Firestore Exception:", err);
    }
  }, [user, selectedPeriod]);

  // LOGIKA DATABASE KARYAWAN
  const handleAddPersonnel = async (e) => {
    e.preventDefault();
    if (!newEmp.nama.trim()) return;
    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'personnel', newId);
    await setDoc(docRef, { ...newEmp, id: newId });
    setNewEmp({ nama: '', area: 'C', role: 'SO' });
  };

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

  const confirmDelete = async () => {
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'personnel', deleteModal.id);
    await deleteDoc(docRef);
    setDeleteModal({ show: false, id: null, nama: '' });
  };

  // LOGIKA PASTE DATA MINGGUAN
  const handleProcessPaste = async () => {
    if (!pasteText.trim()) { alert('Silahkan masukkan teks data terlebih dahulu.'); return; }
    const lines = pasteText.split('\n');
    let successCount = 0; let failedNames = []; const updates = {};

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
      // Simpan ke collection berdasarkan Periode Aktif
      const docRef = doc(db, 'artifacts', getAppId(), 'public', 'periode', selectedPeriod, 'weeklyData', empId);
      await setDoc(docRef, updates[empId], { merge: true });
    }
    setPasteText('');
    let msg = `Berhasil memproses & memasukkan ${successCount} data capaian!`;
    if (failedNames.length > 0) {
      msg += `\n\nPERINGATAN: Ada baris ditolak karena nama tidak terdaftar/berbeda Role:\n- ${Array.from(new Set(failedNames)).slice(0, 5).join('\n- ')}`;
    }
    alert(msg);
  };

  // LOGIKA UPDATE MANUAL LAPORAN
  const handleMonthlyInput = (empId, field, value) => {
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'periode', selectedPeriod, 'monthlyData', empId);
    setDoc(docRef, { [field]: value }, { merge: true });
  };

  // KALKULASI DATA
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

  const getDefisitTarget = () => {
    let defisit = [];
    const activePersonnel = personnel.filter(p => p.role === selectedRoleContext);
    
    activePersonnel.forEach(p => {
      const acc = getAccumulatedData(p.id, p.role);
      const targetedCats = getActiveCategories(p.role).filter(c => c.isTargeted);
      
      targetedCats.forEach(c => {
        const tercapai = acc[c.key] || 0;
        if (tercapai < c.target) {
          defisit.push({
            id: p.id + c.key,
            nama: p.nama,
            area: p.area,
            indikator: c.label,
            tercapai: tercapai,
            target: c.target,
            kurang: c.target - tercapai
          });
        }
      });
    });
    // Urutkan berdasarkan yang kekurangannya paling banyak
    return defisit.sort((a, b) => b.kurang - a.kurang);
  };

  const exportToExcel = (area, personnelList) => {
    const cats = getActiveCategories(selectedRoleContext);
    let csvContent = "Nama,Area,";
    cats.forEach(c => csvContent += `"${c.label}",`);
    csvContent += "Skor Awal,+ Poin,Pelanggaran,Penalti,Kepatuhan,Keterangan,Skor Akhir,Nilai\n";

    personnelList.forEach(p => {
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

      let row = `"${p.nama}","${p.area}",`;
      cats.forEach(c => row += `"${acc[c.key]||0}",`);
      row += `"${sAwal.toFixed(1)}","${tPoin}","${um.pelanggaran}","${penalti}","${um.kepatuhan}","${um.keterangan}","${sAkhir.toFixed(1)}","${grade}"\n`;
      csvContent += row;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_KPI_${selectedRoleContext}_Area_${area}_${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPersonnel = personnel.filter(p => p.role === selectedRoleContext);
  
  // Filter pencarian untuk Tab Database
  const searchResult = personnel.filter(p => p.nama.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!isDbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-emerald-700">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-semibold tracking-wider">Mempersiapkan Data Bulan Ini...</span>
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
          
          <div className="flex items-center gap-3">
            <div className="bg-emerald-900 px-4 py-2 rounded-lg border border-emerald-700 flex items-center gap-2">
              <Calendar size={16} className="text-emerald-300"/>
              <select className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                {periodList.map(per => <option key={per.id} value={per.id} className="text-slate-800">{per.label}</option>)}
              </select>
            </div>
            <div className="bg-emerald-900 px-4 py-2 rounded-lg border border-emerald-700 text-xs">
              Status: <span className="font-bold text-green-400">ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-6 px-4">
        {/* NAVIGASI TAB */}
        <div className="flex flex-wrap space-x-1 border-b border-slate-300 mb-6">
          <button onClick={() => setActiveTab('dashboard')} className={`px-5 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setActiveTab('database')} className={`px-5 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'database' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><Database size={18}/> Database</button>
          <button onClick={() => setActiveTab('input')} className={`px-5 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'input' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><ClipboardPaste size={18}/> Input</button>
          <button onClick={() => setActiveTab('laporan')} className={`px-5 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'laporan' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><Table size={18}/> Laporan</button>
        </div>

        {/* CONTROLS PER-JABATAN (Kecuali Database) */}
        {(activeTab === 'input' || activeTab === 'laporan' || activeTab === 'dashboard') && (
          <div className="mb-4 bg-white p-4 rounded-lg shadow-sm flex items-center gap-4 border border-slate-200">
            <span className="font-bold text-slate-700">Tampilkan Data Untuk:</span>
            <button onClick={() => setSelectedRoleContext('SO')} className={`px-4 py-1.5 rounded font-bold transition-all ${selectedRoleContext === 'SO' ? 'bg-emerald-100 text-emerald-800 shadow' : 'text-slate-500 hover:bg-slate-100'}`}>Safety Officer</button>
            <button onClick={() => setSelectedRoleContext('WFSO')} className={`px-4 py-1.5 rounded font-bold transition-all ${selectedRoleContext === 'WFSO' ? 'bg-indigo-100 text-indigo-800 shadow' : 'text-slate-500 hover:bg-slate-100'}`}>Wakil Foreman</button>
          </div>
        )}

        {/* TAB DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                <TrendingDown className="text-red-500" size={28} />
                <h2 className="text-xl font-bold text-slate-800">Pemantauan Defisit Target ({selectedRoleContext === 'SO' ? 'Safety Officer' : 'Wakil Foreman'})</h2>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg text-sm mb-6 flex items-start gap-3">
                <Info className="shrink-0 mt-0.5 text-orange-500" size={18}/>
                <p>Tabel ini menunjukkan karyawan yang pencapaiannya <b>masih di bawah target</b> pada bulan <b>{periodList.find(p=>p.id===selectedPeriod)?.label}</b>. Gunakan data ini untuk menegur atau mengingatkan karyawan terkait.</p>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-slate-200 rounded-lg shadow-inner">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-white sticky top-0 z-10">
                    <tr>
                      <th className="p-3">Nama Karyawan</th>
                      <th className="p-3 text-center">Area</th>
                      <th className="p-3">Indikator</th>
                      <th className="p-3 text-center bg-slate-700">Tercapai</th>
                      <th className="p-3 text-center bg-slate-700">Target</th>
                      <th className="p-3 text-center bg-red-600">Kekurangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getDefisitTarget().length === 0 ? (
                      <tr><td colSpan="6" className="p-6 text-center text-slate-500 font-bold bg-slate-50">🎉 Luar biasa! Semua karyawan sudah mencapai target bulan ini.</td></tr>
                    ) : (
                      getDefisitTarget().map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-700">{item.nama}</td>
                          <td className="p-3 text-center font-bold text-slate-500">{item.area}</td>
                          <td className="p-3 font-medium">{item.indikator}</td>
                          <td className="p-3 text-center">{item.tercapai}</td>
                          <td className="p-3 text-center">{item.target}</td>
                          <td className="p-3 text-center font-bold text-red-600 bg-red-50/50"> - {item.kurang}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB DATABASE */}
        {activeTab === 'database' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">
              <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Tambah Karyawan</h2>
              <form onSubmit={handleAddPersonnel} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Nama Lengkap</label>
                  <input type="text" required className="w-full border border-slate-300 rounded p-2 focus:ring-emerald-500" value={newEmp.nama} onChange={e => setNewEmp({...newEmp, nama: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Area Penugasan</label>
                  <select className="w-full border border-slate-300 rounded p-2" value={newEmp.area} onChange={e => setNewEmp({...newEmp, area: e.target.value})}>
                    <option value="C">Smelter C</option><option value="E">Smelter E</option><option value="F">Smelter F</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Role / Jabatan</label>
                  <select className="w-full border border-slate-300 rounded p-2" value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})}>
                    <option value="SO">Safety Officer</option><option value="WFSO">Wakil Foreman</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded mt-2 shadow">Simpan Karyawan</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b pb-4">
                <h2 className="text-xl font-bold text-slate-800">Daftar Karyawan Global</h2>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                  <input type="text" placeholder="Cari nama karyawan..." className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full md:w-64 focus:ring-emerald-500 focus:border-emerald-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                </div>
              </div>
              
              <div className="overflow-y-auto max-h-[500px] border border-slate-200 rounded-lg shadow-inner">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                    <tr><th className="p-3">Nama Karyawan</th><th className="p-3 text-center">Area</th><th className="p-3 text-center">Role</th><th className="p-3 text-center">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {searchResult.length === 0 ? (
                      <tr><td colSpan="4" className="text-center p-6 text-slate-500">Karyawan tidak ditemukan.</td></tr>
                    ) : (
                      searchResult.map(p => (
                        <tr key={p.id} className="border-b hover:bg-slate-50 last:border-b-0">
                          {editingId === p.id ? (
                            <>
                              <td className="p-2"><input type="text" className="border rounded p-1 w-full text-sm" value={editFormData.nama} onChange={(e) => setEditFormData({...editFormData, nama: e.target.value})} /></td>
                              <td className="p-2 text-center">
                                <select className="border rounded p-1 text-sm" value={editFormData.area} onChange={(e) => setEditFormData({...editFormData, area: e.target.value})}>
                                  <option value="C">Area C</option><option value="E">Area E</option><option value="F">Area F</option>
                                </select>
                              </td>
                              <td className="p-2 text-center">
                                <select className="border rounded p-1 text-sm" value={editFormData.role} onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}>
                                  <option value="SO">Safety Officer</option><option value="WFSO">Wakil Foreman</option>
                                </select>
                              </td>
                              <td className="p-2 text-center space-x-2 whitespace-nowrap">
                                <button onClick={handleSaveEdit} className="text-white bg-emerald-600 px-3 py-1.5 rounded font-bold text-xs shadow-sm">Simpan</button>
                                <button onClick={() => setEditingId(null)} className="text-slate-600 bg-slate-200 px-3 py-1.5 rounded font-bold text-xs">Batal</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-medium text-slate-700">{p.nama}</td>
                              <td className="p-3 text-center font-bold text-slate-500">{p.area}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${p.role === 'SO' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                  {p.role === 'SO' ? 'Safety Officer' : 'Wakil Foreman'}
                                </span>
                              </td>
                              <td className="p-3 text-center space-x-3">
                                <button onClick={() => handleEditClick(p)} className="text-blue-500 hover:text-blue-700 transition-colors" title="Edit"><Edit size={18}/></button>
                                <button onClick={() => { setDeleteModal({ show: true, id: p.id, nama: p.nama }); }} className="text-red-500 hover:text-red-700 transition-colors" title="Hapus"><Trash2 size={18}/></button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB INPUT */}
        {activeTab === 'input' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 h-fit">
                  <h2 className="font-bold text-lg mb-4 text-slate-800 border-b pb-2">Paste Data Mingguan</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Pilih Minggu</label>
                      <select className="border border-slate-300 p-2 w-full rounded focus:ring-emerald-500" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
                        {weeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Pilih Indikator</label>
                      <select className="border border-slate-300 p-2 w-full rounded focus:ring-emerald-500" value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>
                        {getActiveCategories(selectedRoleContext).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Data Teks (Format Excel)</label>
                  <textarea className="w-full border border-slate-300 p-3 h-48 rounded bg-white text-sm font-mono focus:ring-emerald-500 focus:border-emerald-500 shadow-inner" placeholder="Paste data excel di sini..." value={pasteText} onChange={(e) => setPasteText(e.target.value)}></textarea>
                  <button onClick={handleProcessPaste} className="w-full bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-bold py-3 mt-4 rounded shadow-md">Simpan ke Database</button>
                </div>

                <div>
                  <h2 className="font-bold text-lg mb-4 text-slate-800">Preview Area ({selectedRoleContext === 'SO' ? 'Safety Officer' : 'Wakil Foreman'})</h2>
                  {areaList.map(area => {
                    const areaPersonnel = filteredPersonnel.filter(p => p.area === area);
                    if (areaPersonnel.length === 0) return null;
                    return (
                      <div key={area} className="mb-6">
                        <div className="bg-slate-200 px-3 py-2 rounded-t-lg font-bold text-slate-700 text-sm flex items-center gap-2">
                          <CheckCircle size={16} className="text-emerald-600"/> Area {area}
                        </div>
                        <div className="overflow-x-auto border border-t-0 rounded-b-lg border-slate-200">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b">
                              <tr><th className="p-2 text-left">Nama</th>{getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-2 text-center">{c.label}</th>)}</tr>
                            </thead>
                            <tbody>
                              {areaPersonnel.map(p => {
                                const wData = weeklyData[p.id]?.[selectedWeek] || {};
                                return (
                                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50">
                                    <td className="p-2 font-medium">{p.nama}</td>
                                    {getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-2 text-center text-slate-600">{wData[c.key] || '-'}</td>)}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
             </div>
          </div>
        )}

        {/* TAB LAPORAN */}
        {activeTab === 'laporan' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-slate-200 gap-4">
               <div>
                 <h2 className="font-bold text-2xl text-slate-800">Rekap Laporan KPI</h2>
                 <p className="text-slate-500 text-sm">Periode: <b>{periodList.find(p=>p.id===selectedPeriod)?.label}</b> | Jabatan: <b>{selectedRoleContext === 'SO' ? 'Safety Officer' : 'Wakil Foreman'}</b></p>
               </div>
             </div>
             
             {areaList.map(area => {
                const areaPersonnel = filteredPersonnel.filter(p => p.area === area);
                if (areaPersonnel.length === 0) return null;

                return (
                  <div key={area} className="mb-10 overflow-x-auto shadow-sm rounded-lg">
                    <div className="flex justify-between items-center bg-slate-800 text-white px-4 py-3 rounded-t-lg">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Table size={20} className="text-emerald-400" /> Area {area}
                      </h3>
                      <button onClick={() => exportToExcel(area, areaPersonnel)} className="bg-emerald-600 hover:bg-emerald-500 transition-colors text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 shadow">
                        <Download size={14} /> Export Excel
                      </button>
                    </div>
                    <table className="w-full text-xs border-collapse whitespace-nowrap border-x border-b border-slate-300">
                      <thead className="bg-slate-700 text-white">
                        <tr>
                          <th className="p-3 text-left">Nama Lengkap</th>
                          <th className="p-3 text-center">Area</th>
                          {getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-3 text-center border-l border-slate-600">{c.label}</th>)}
                          <th className="p-3 text-center bg-slate-600 border-l border-slate-500">Skor Awal</th>
                          <th className="p-3 text-center bg-slate-600">+ Poin</th>
                          <th className="p-3 text-center bg-slate-600">Pelanggaran</th>
                          <th className="p-3 text-center bg-slate-600">Penalti</th>
                          <th className="p-3 text-center bg-emerald-800 border-l border-emerald-700">Kepatuhan</th>
                          <th className="p-3 text-center bg-emerald-800">Ket. Tambahan</th>
                          <th className="p-3 text-center bg-emerald-700 border-l border-emerald-600">SKOR AKHIR</th>
                          <th className="p-3 text-center bg-emerald-600 border-l border-emerald-500">NILAI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaPersonnel.map(p => {
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
                            <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50 last:border-0">
                              <td className="p-3 font-bold text-slate-700">{p.nama}</td>
                              <td className="p-3 text-center font-bold text-slate-500 bg-slate-50/50">{p.area}</td>
                              {getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-3 text-center border-l border-slate-200 font-medium">{acc[c.key]||0}</td>)}
                              <td className="p-3 text-center border-l border-slate-200 bg-slate-50 font-bold">{sAwal.toFixed(1)}</td>
                              <td className="p-3 text-center bg-slate-50 font-bold text-emerald-600">+{tPoin}</td>
                              <td className="p-2 text-center bg-red-50/30 border-l border-slate-200"><input type="number" className="w-14 border border-slate-300 p-1.5 rounded focus:ring-red-500 text-center" value={um.pelanggaran} onChange={e=>handleMonthlyInput(p.id, 'pelanggaran', e.target.value)}/></td>
                              <td className="p-3 text-center text-red-600 font-bold bg-red-50/30">{penalti}</td>
                              <td className="p-2 text-center border-l border-slate-200 bg-emerald-50/30">
                                <select className="border border-slate-300 p-1.5 rounded bg-white w-full focus:ring-emerald-500" value={um.kepatuhan} onChange={e=>handleMonthlyInput(p.id, 'kepatuhan', e.target.value)}>
                                  <option value="25">25</option><option value="50">50</option><option value="75">75</option><option value="100">100</option>
                                </select>
                              </td>
                              <td className="p-2 bg-emerald-50/30"><input type="text" className="w-24 border border-slate-300 p-1.5 text-xs rounded focus:ring-emerald-500" placeholder="Cuti/Ijin" value={um.keterangan} onChange={e=>handleMonthlyInput(p.id, 'keterangan', e.target.value)}/></td>
                              <td className="p-3 text-center font-bold text-lg text-emerald-800 bg-emerald-100/50 border-l border-emerald-200">{sAkhir.toFixed(1)}</td>
                              <td className="p-3 text-center border-l border-emerald-200 bg-emerald-50/50"><span className={`px-3 py-1.5 rounded shadow-sm text-white font-black text-sm tracking-wider ${grade==='A'?'bg-green-500':grade==='B'?'bg-lime-500':grade==='C'?'bg-yellow-500':'bg-red-500'}`}>{grade}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
             })}
          </div>
        )}
      </main>

      {/* MODAL HAPUS KUSTOM */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 p-3 rounded-full mb-4">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Karyawan?</h3>
              <p className="text-slate-600 mb-6 text-sm">Apakah Anda yakin ingin menghapus <b>{deleteModal.nama}</b>? Karyawan ini akan dihapus secara permanen dari sistem.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteModal({ show: false, id: null, nama: '' })} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">Batal</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

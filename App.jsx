import React, { useState, useEffect } from 'react';
import { Database, ClipboardPaste, Calculator, CheckCircle, AlertCircle, Info, Table, UserPlus, Trash2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// =====================================================================
// KONFIGURASI FIREBASE (UNTUK DEPLOY VERCEL)
// =====================================================================
const fallbackConfig = {
  apiKey: "AIzaSyAtEdHjdmC_MzMkb8Nmt07LU45xaYUsTg4",
  authDomain: "kpi-safety-officer.firebaseapp.com",
  projectId: "kpi-safety-officer",
  storageBucket: "kpi-safety-officer.firebasestorage.app",
  messagingSenderId: "741875026274",
  appId: "1:741875026274:web:cd11cd36a8da1b99cec43b",
  measurementId: "G-58FEWCV5NR"
};

// Deteksi environment (Canvas vs Vercel)
const isCanvasEnvironment = typeof __firebase_config !== 'undefined';
const firebaseConfig = isCanvasEnvironment ? JSON.parse(__firebase_config) : fallbackConfig;
const app = initializeApp(firebaseConfig);

let analytics;
// Mencegah error 'App not found' dengan tidak memuat Analytics di environment testing Canvas
if (!isCanvasEnvironment) {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Analytics disembunyikan di environment terbatas");
  }
}

const auth = getAuth(app);
const db = getFirestore(app);

const getAppId = () => typeof __app_id !== 'undefined' ? __app_id : 'bufn2-kpi-app';

export default function App() {
  const [activeTab, setActiveTab] = useState('database');
  const [user, setUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  
  // --- STATE DATA (Semua dikosongkan) ---
  const [personnel, setPersonnel] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});
  const [monthlyData, setMonthlyData] = useState({});
  const [newEmp, setNewEmp] = useState({ nama: '', area: 'C', role: 'SO' });

  // --- INPUT STATE ---
  const [selectedRoleContext, setSelectedRoleContext] = useState('SO'); 
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [selectedIndicator, setSelectedIndicator] = useState('obs');
  const [pasteText, setPasteText] = useState('');

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

  // =====================================================================
  // INIT FIREBASE AUTH & LISTENER
  // =====================================================================
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const appId = getAppId();
    const personnelRef = collection(db, 'artifacts', appId, 'public', 'data', 'personnel');
    const weeklyRef = collection(db, 'artifacts', appId, 'public', 'data', 'weeklyData');
    const monthlyRef = collection(db, 'artifacts', appId, 'public', 'data', 'monthlyData');

    const unsubPersonnel = onSnapshot(personnelRef, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push(doc.data()));
      setPersonnel(data);
    }, (err) => console.error("Error reading personnel:", err));

    const unsubWeekly = onSnapshot(weeklyRef, (snapshot) => {
      const data = {};
      snapshot.forEach(doc => { data[doc.id] = doc.data(); });
      setWeeklyData(data);
    }, (err) => console.error("Error reading weeklyData:", err));

    const unsubMonthly = onSnapshot(monthlyRef, (snapshot) => {
      const data = {};
      snapshot.forEach(doc => { data[doc.id] = doc.data(); });
      setMonthlyData(data);
      setIsDbReady(true);
    }, (err) => console.error("Error reading monthlyData:", err));

    return () => { unsubPersonnel(); unsubWeekly(); unsubMonthly(); }
  }, [user]);


  // =====================================================================
  // DATABASE HANDLERS (WRITE TO FIREBASE)
  // =====================================================================
  const handleAddPersonnel = async (e) => {
    e.preventDefault();
    if (!newEmp.nama.trim()) return;
    
    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'personnel', newId);
    
    await setDoc(docRef, { ...newEmp, id: newId });
    setNewEmp({ nama: '', area: 'C', role: 'SO' });
  };

  const handleDeletePersonnel = async (id) => {
    if (confirm('Hapus pegawai ini dari database? Semua datanya juga akan hilang dari laporan.')) {
      const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'personnel', id);
      await deleteDoc(docRef);
    }
  };

  const handleProcessPaste = async () => {
    if (!pasteText.trim()) {
      alert('Silahkan masukkan teks data terlebih dahulu.');
      return;
    }

    const lines = pasteText.split('\n');
    let successCount = 0;
    let failedNames = [];
    const updates = {}; // empId -> updated week data

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

    // Simpan ke Firestore
    for (const empId of Object.keys(updates)) {
      const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'weeklyData', empId);
      await setDoc(docRef, updates[empId], { merge: true });
    }

    setPasteText('');
    let msg = `Berhasil memproses & memasukkan ${successCount} data capaian!`;
    if (failedNames.length > 0) {
      msg += `\n\nPERINGATAN: Ada ${failedNames.length} baris ditolak karena nama tidak terdaftar/berbeda Role:\n- ${Array.from(new Set(failedNames)).slice(0, 5).join('\n- ')}`;
      if (failedNames.length > 5) msg += `\n...dan nama lainnya.`;
    }
    alert(msg);
  };

  const handleMonthlyInput = (empId, field, value) => {
    const docRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'monthlyData', empId);
    setDoc(docRef, { [field]: value }, { merge: true });
  };


  // =====================================================================
  // PERHITUNGAN AKUMULASI DAN KPI
  // =====================================================================
  const getAccumulatedData = (empId, role) => {
    const empData = weeklyData[empId] || {};
    const total = {};
    const cats = getActiveCategories(role);
    
    cats.forEach(c => total[c.key] = 0);

    Object.values(empData).forEach(weekData => {
      cats.forEach(c => {
        total[c.key] += (weekData[c.key] || 0);
      });
    });
    return total;
  };

  const calculateGrade = (skorAkhir, kepatuhan, keterangan) => {
    const ket = (keterangan || "").toLowerCase();
    const isCutiOrIjin = ket.includes("ijin") || ket.includes("cuti");

    if (skorAkhir >= 170 && kepatuhan === 100) return "A";
    if (skorAkhir >= 141 && skorAkhir <= 169 && kepatuhan === 100) return "B";
    if (skorAkhir >= 100 && skorAkhir <= 140 && kepatuhan === 100) return "C";
    if (isCutiOrIjin) return "C";
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
          <span className="font-semibold tracking-wider">Menghubungkan ke Database...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-12">
      <header className="bg-emerald-800 text-white p-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CheckCircle size={36} className="text-emerald-300" />
            <div>
              <h1 className="text-2xl font-bold tracking-wide">Sistem KPI Otomatis HSE BUFN 2</h1>
              <p className="text-emerald-200 text-sm mt-0.5">Cloud Database Aktif (Tersimpan Otomatis)</p>
            </div>
          </div>
          <div className="bg-emerald-900 px-4 py-2 rounded-lg border border-emerald-700 text-xs">
            Status DB: <span className="font-bold text-green-400">Online 🟢</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-6 px-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap space-x-1 border-b border-slate-300 mb-6">
          <button 
            onClick={() => setActiveTab('database')}
            className={`flex items-center space-x-2 px-5 py-3 font-semibold rounded-t-lg transition-colors ${activeTab === 'database' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            <Database size={18} /> <span>1. Database Pegawai</span>
          </button>
          <button 
            onClick={() => setActiveTab('input')}
            className={`flex items-center space-x-2 px-5 py-3 font-semibold rounded-t-lg transition-colors ${activeTab === 'input' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            <ClipboardPaste size={18} /> <span>2. Input Mingguan</span>
          </button>
          <button 
            onClick={() => setActiveTab('laporan')}
            className={`flex items-center space-x-2 px-5 py-3 font-semibold rounded-t-lg transition-colors ${activeTab === 'laporan' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-l border-r border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            <Calculator size={18} /> <span>3. Laporan & Hasil Akhir</span>
          </button>
        </div>

        {/* TAB 1: DATABASE PEGAWAI */}
        {activeTab === 'database' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center mb-4 pb-2 border-b border-slate-100">
              <Database className="mr-2 text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-800">Master Data Pegawai (Tersimpan di Cloud)</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Input Pegawai */}
              <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 h-fit">
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center"><UserPlus size={18} className="mr-2"/> Tambah Pegawai</h3>
                <form onSubmit={handleAddPersonnel}>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                    <input 
                      type="text" 
                      required 
                      className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-emerald-500 outline-none" 
                      placeholder="Contoh: Hardi Harun" 
                      value={newEmp.nama} 
                      onChange={e => setNewEmp({...newEmp, nama: e.target.value})} 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Area / Smelter</label>
                    <select 
                      className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-emerald-500 bg-white" 
                      value={newEmp.area} 
                      onChange={e => setNewEmp({...newEmp, area: e.target.value})}
                    >
                      <option value="C">Area C</option>
                      <option value="E">Area E</option>
                      <option value="F">Area F</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jabatan (Role)</label>
                    <select 
                      className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-emerald-500 bg-white" 
                      value={newEmp.role} 
                      onChange={e => setNewEmp({...newEmp, role: e.target.value})}
                    >
                      <option value="SO">Safety Officer (SO)</option>
                      <option value="WFSO">Wakil Foreman SO (WFSO)</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded transition-colors shadow-sm">
                    Daftarkan Pegawai
                  </button>
                </form>
              </div>

              {/* Tabel Daftar Pegawai */}
              <div className="lg:col-span-2">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-700">Pegawai Terdaftar ({personnel.length})</h3>
                  <div className="text-xs bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-100 flex items-center">
                    <Info size={14} className="mr-1"/> Urutan & nama laporan akan mengikuti tabel database ini
                  </div>
                </div>
                <div className="overflow-y-auto max-h-96 border border-slate-200 rounded-lg shadow-inner">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 sticky top-0 text-slate-600 border-b">
                      <tr>
                        <th className="py-2.5 px-4">Nama</th>
                        <th className="py-2.5 px-4 text-center">Area</th>
                        <th className="py-2.5 px-4">Jabatan</th>
                        <th className="py-2.5 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {personnel.length === 0 ? (
                        <tr><td colSpan="4" className="text-center py-6 text-slate-400 italic">Database Kosong. Silahkan tambahkan pegawai.</td></tr>
                      ) : (
                        personnel.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-4 font-medium text-slate-700">{p.nama}</td>
                            <td className="py-2.5 px-4 text-center"><span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">{p.area}</span></td>
                            <td className="py-2.5 px-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.role === 'SO' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                {p.role === 'SO' ? 'Safety Officer' : 'Wakil Foreman'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button 
                                onClick={() => handleDeletePersonnel(p.id)} 
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                title="Hapus Pegawai"
                              >
                                <Trash2 size={16}/>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS UNTUK TAB INPUT & LAPORAN */}
        {(activeTab === 'input' || activeTab === 'laporan') && (
          <div className="mb-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-slate-700 text-sm">Pilih Jabatan Kerja:</span>
              <div className="flex bg-slate-100 rounded-md p-1 border border-slate-200">
                <button 
                  onClick={() => setSelectedRoleContext('SO')} 
                  className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors ${selectedRoleContext === 'SO' ? 'bg-white shadow-sm text-emerald-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Safety Officer (SO)
                </button>
                <button 
                  onClick={() => setSelectedRoleContext('WFSO')} 
                  className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors ${selectedRoleContext === 'WFSO' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200' : 'text-slate-500 hover:text-indigo-800'}`}
                >
                  Wakil Foreman SO (WFSO)
                </button>
              </div>
            </div>
            <div className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md">
              Terfilter: {filteredPersonnel.length} Pegawai Terdaftar ({selectedRoleContext})
            </div>
          </div>
        )}

        {/* TAB 2: INPUT SMART PASTE */}
        {activeTab === 'input' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-600">
              <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center">
                <ClipboardPaste size={18} className="mr-2 text-emerald-600" />
                Smart Paste Mingguan
              </h2>
              
              <div className="mb-3">
                <label className="block text-sm font-semibold text-slate-700 mb-1">1. Pilih Periode Minggu:</label>
                <select 
                  className="w-full border border-slate-300 rounded-md p-2 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium" 
                  value={selectedWeek} 
                  onChange={(e) => setSelectedWeek(e.target.value)}
                >
                  {weeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">2. Pilih Indikator:</label>
                <select 
                  className="w-full border border-slate-300 rounded-md p-2 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium" 
                  value={selectedIndicator} 
                  onChange={(e) => setSelectedIndicator(e.target.value)}
                >
                  {getActiveCategories(selectedRoleContext).map(c => (
                    <option key={c.key} value={c.key}>{c.label} {c.target ? `(Target: ${c.target})` : '(Tanpa Target)'}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-semibold text-slate-700">3. Paste dari Excel:</label>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Format: Nama [Tab] Nilai</span>
                </div>
                <textarea 
                  className="w-full border border-slate-300 rounded-md p-3 h-48 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
                  placeholder="Contoh salin dari Excel:&#10;Hardi Harun	25&#10;Titus Salakay	C	12&#10;Rahmat Hidayat	15"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                ></textarea>
                <p className="text-[10px] text-red-500 mt-1 flex items-start leading-relaxed">
                  <AlertCircle size={12} className="mr-1 flex-shrink-0 mt-0.5" /> 
                  Hanya nama yang ada di database dengan role "{selectedRoleContext}" yang akan terproses.
                </p>
              </div>

              <button 
                onClick={handleProcessPaste} 
                className={`w-full text-white font-bold py-3 rounded-md shadow transition-colors flex justify-center items-center gap-2 ${selectedRoleContext === 'SO' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                <ClipboardPaste size={18}/> Simpan ke Database
              </button>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  <Table className="mr-2 text-slate-500" size={20}/> 
                  Data Sementara ({weeks.find(w => w.id === selectedWeek).label})
                </h2>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold">
                  Status: {selectedRoleContext}
                </span>
              </div>
              
              {filteredPersonnel.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <p className="text-sm">Tidak ada pegawai {selectedRoleContext} terdaftar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 shadow-sm">
                      <tr>
                        <th className="py-2.5 px-3 text-left font-semibold text-slate-700">Nama Pegawai</th>
                        <th className="py-2.5 px-2 text-center font-semibold text-slate-700">Area</th>
                        {getActiveCategories(selectedRoleContext).map(c => (
                          <th key={c.key} className={`py-2.5 px-2 text-center font-bold ${selectedIndicator === c.key ? 'bg-emerald-50 text-emerald-800 border-b-2 border-emerald-500' : 'text-slate-600'}`}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPersonnel.map((p) => {
                        const pData = weeklyData[p.id]?.[selectedWeek] || {};
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2 px-3 font-medium text-slate-700">{p.nama}</td>
                            <td className="py-2 px-2 text-center"><span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">{p.area}</span></td>
                            {getActiveCategories(selectedRoleContext).map(c => {
                              const value = pData[c.key];
                              return (
                                <td key={c.key} className={`py-2 px-2 text-center ${selectedIndicator === c.key ? 'bg-emerald-50/30 font-bold text-emerald-800' : 'text-slate-500'}`}>
                                  {value !== undefined ? value : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LAPORAN AKHIR */}
        {activeTab === 'laporan' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="border-b pb-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                  Laporan Akhir Bulanan: 
                  <span className={`ml-2 text-xs px-3 py-1 rounded font-bold ${selectedRoleContext === 'SO' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                    {selectedRoleContext === 'SO' ? 'Safety Officer' : 'Wakil Foreman'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">Capaian akumulatif otomatis dihitung dari Minggu 1 - Minggu 5 dan di-sinkronisasi ke Firebase.</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-800 text-white border-b border-slate-700">
                    <th className="py-3.5 px-4 text-left font-semibold sticky left-0 bg-slate-900 z-10 border-r border-slate-700">Nama Pegawai</th>
                    <th className="py-3.5 px-2 text-center font-semibold border-r border-slate-700">Area</th>
                    
                    {getActiveCategories(selectedRoleContext).map(c => (
                      <th key={c.key} className="py-2.5 px-3 text-center border-r border-slate-700">
                        <span className="text-[10px] text-slate-400 font-normal">Total</span><br/>
                        {c.label}
                        {c.target && <span className="block text-[9px] text-emerald-400 mt-0.5">Target: {c.target}</span>}
                      </th>
                    ))}

                    <th className="py-3.5 px-3 text-center bg-slate-700 border-r border-slate-600 font-bold text-emerald-300">
                      {selectedRoleContext === 'SO' ? 'Skor Awal (P4)' : 'Skor Awal (R4)'}
                    </th>
                    <th className="py-3.5 px-3 text-center bg-slate-700 border-r border-slate-600">
                      {selectedRoleContext === 'SO' ? 'Tmbhn Poin (Q4)' : 'Tmbhn Poin (S4)'}
                    </th>
                    <th className="py-3.5 px-3 text-center bg-slate-700 border-r border-slate-600">
                      Pelanggaran
                    </th>
                    <th className="py-3.5 px-3 text-center bg-slate-700 border-r border-slate-600">
                      {selectedRoleContext === 'SO' ? 'Penalti (R4)' : 'Penalti (T4)'}
                    </th>
                    <th className="py-3.5 px-3 text-center bg-emerald-900 border-r border-emerald-800">
                      Kepatuhan %
                    </th>
                    <th className="py-3.5 px-3 text-left bg-emerald-900 border-r border-emerald-800 w-28">
                      Keterangan (U4/W4)
                    </th>
                    <th className="py-3.5 px-5 text-center bg-emerald-700 font-bold text-sm">SKOR AKHIR</th>
                    <th className="py-3.5 px-5 text-center bg-emerald-600 font-bold text-sm">NILAI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredPersonnel.length === 0 ? (
                    <tr><td colSpan={20} className="py-8 text-center text-slate-400 italic">Belum ada pegawai terdaftar untuk jabatan ini.</td></tr>
                  ) : (
                    filteredPersonnel.map((p) => {
                      const acc = getAccumulatedData(p.id, selectedRoleContext);
                      
                      const userMonthly = monthlyData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' };
                      const kepatuhanManual = userMonthly.kepatuhan !== undefined ? parseInt(userMonthly.kepatuhan) : 75;
                      const totalPelanggaran = userMonthly.pelanggaran !== undefined ? parseInt(userMonthly.pelanggaran) : 0;
                      const keterangan = userMonthly.keterangan || "";

                      let skorAwal = 100;
                      let tambahanPoin = 0;
                      let penaltiPoin = -(totalPelanggaran * 5);
                      let skorAkhir = 0;

                      if (selectedRoleContext === 'SO') {
                        const obsPenalty = acc.obs >= 200 ? 0 : ((200 - acc.obs) / 200) * 25;
                        const idenPenalty = acc.iden >= 16 ? 0 : ((16 - acc.iden) / 16) * 25;
                        const stPenalty = acc.st >= 8 ? 0 : ((8 - acc.st) / 8) * 25;
                        const ssPenalty = acc.ss >= 28 ? 0 : ((28 - acc.ss) / 28) * 25;

                        skorAwal = (acc.obs >= 200 && acc.iden >= 16 && acc.st >= 8 && acc.ss >= 28) 
                          ? 100 
                          : 100 - (obsPenalty + idenPenalty + stPenalty + ssPenalty);
                        if (skorAwal < 0) skorAwal = 0;

                        tambahanPoin = (acc.si || 0) + (acc.ps || 0) + kepatuhanManual;
                        skorAkhir = skorAwal + tambahanPoin + penaltiPoin;

                      } else {
                        const obsPenalty = acc.obs >= 140 ? 0 : ((140 - acc.obs) / 140) * 20;
                        const idenPenalty = acc.iden >= 12 ? 0 : ((12 - acc.iden) / 12) * 20;
                        const stePenalty = acc.ste >= 8 ? 0 : ((8 - acc.ste) / 8) * 20;
                        const stPenalty = acc.st >= 8 ? 0 : ((8 - acc.st) / 8) * 20;
                        const ssPenalty = acc.ss >= 20 ? 0 : ((20 - acc.ss) / 20) * 20;

                        skorAwal = (acc.obs >= 140 && acc.iden >= 12 && acc.ste >= 8 && acc.st >= 8 && acc.ss >= 20)
                          ? 100
                          : 100 - (obsPenalty + idenPenalty + stePenalty + stPenalty + ssPenalty);
                        if (skorAwal < 0) skorAwal = 0;

                        tambahanPoin = (acc.si || 0) + (acc.ps || 0) + kepatuhanManual;
                        skorAkhir = skorAwal + tambahanPoin + penaltiPoin;
                      }

                      const grade = calculateGrade(skorAkhir, kepatuhanManual, keterangan);

                      let gradeBadgeColor = 'bg-slate-200 text-slate-800';
                      if (grade === 'A') gradeBadgeColor = 'bg-green-500 text-white shadow-md shadow-green-200';
                      if (grade === 'B') gradeBadgeColor = 'bg-lime-400 text-slate-800 shadow-md shadow-lime-100';
                      if (grade === 'C') gradeBadgeColor = 'bg-yellow-400 text-slate-800 shadow-md shadow-yellow-100';
                      if (grade === 'D') gradeBadgeColor = 'bg-red-500 text-white shadow-md shadow-red-200';

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800 sticky left-0 bg-white border-r border-slate-200 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            {p.nama}
                          </td>
                          <td className="py-3 px-2 text-center border-r font-mono font-bold text-slate-500 bg-slate-50/30">
                            {p.area}
                          </td>
                          
                          {getActiveCategories(selectedRoleContext).map(c => {
                            const val = acc[c.key] || 0;
                            return (
                              <td key={c.key} className="py-3 px-3 text-center border-r border-slate-100">
                                {val > 0 ? (
                                  <span className="font-semibold text-slate-800">{val}</span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="py-3 px-3 text-center border-r border-slate-100 bg-slate-50/50 font-bold text-slate-800">
                            {skorAwal.toFixed(1)}
                          </td>
                          <td className="py-3 px-3 text-center border-r border-slate-100 bg-slate-50/50 font-semibold text-emerald-700">
                            {tambahanPoin}
                          </td>
                          <td className="py-1 px-2 text-center border-r border-slate-100 bg-red-50/20">
                            <input 
                              type="number"
                              min="0"
                              className="w-14 border border-slate-300 rounded p-1 text-center font-bold focus:ring-2 focus:ring-red-400 focus:outline-none"
                              value={totalPelanggaran}
                              onChange={(e) => handleMonthlyInput(p.id, 'pelanggaran', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center border-r border-slate-100 font-bold text-red-600 bg-red-50/30">
                            {penaltiPoin}
                          </td>
                          <td className="py-1 px-2 text-center border-r border-slate-100 bg-emerald-50/10">
                            <select
                              className="border border-emerald-300 rounded p-1 text-center font-semibold bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none text-xs"
                              value={kepatuhanManual}
                              onChange={(e) => handleMonthlyInput(p.id, 'kepatuhan', parseInt(e.target.value))}
                            >
                              <option value="25">25</option>
                              <option value="50">50</option>
                              <option value="75">75</option>
                              <option value="100">100</option>
                            </select>
                          </td>
                          <td className="py-1 px-2 text-center border-r border-slate-100 bg-emerald-50/10">
                            <input 
                              type="text"
                              className="w-full border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-emerald-400 focus:outline-none text-xs"
                              placeholder="Cuti / Ijin / dll"
                              value={keterangan}
                              onChange={(e) => handleMonthlyInput(p.id, 'keterangan', e.target.value)}
                            />
                          </td>
                          <td className="py-3 px-3 text-center border-r border-slate-200 font-bold text-emerald-800 text-sm bg-emerald-50/20">
                            {skorAkhir.toFixed(1)}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <span className={`inline-block w-9 h-9 leading-9 rounded-full font-bold text-sm ${gradeBadgeColor}`}>
                              {grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Panel Aturan Formula */}
            <div className="mt-6 bg-slate-50 border border-slate-200 p-5 rounded-lg">
              <h4 className="font-bold text-slate-700 mb-2 flex items-center text-sm"><Info size={16} className="mr-2 text-indigo-500"/> Informasi Formula Perhitungan (Sinkronasi Cloud):</h4>
              <p className="text-xs text-slate-600">Semua perubahan pada tabel (input pelanggaran, dropdown kepatuhan, & keterangan) akan langsung tersimpan secara otomatis tanpa perlu menekan tombol simpan.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
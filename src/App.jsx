/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { Database, ClipboardPaste, CheckCircle, Table, Trash2, Edit, AlertTriangle, Download, Search, LayoutDashboard, Calendar, TrendingDown, Info, Settings, Plus, Save, XCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isCanvas = typeof __firebase_config !== 'undefined';
const getFirebaseConfig = () => isCanvas ? JSON.parse(__firebase_config) : firebaseConfig; 
const app = initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);

// DEFAULT MASTER DATA
const defaultSettings = {
  areas: ['Smelter C', 'Smelter E', 'Smelter F'], 
  roles: [
    { id: 'SO', name: 'Safety Officer' },
    { id: 'WFSO', name: 'Wakil Foreman' }
  ],
  categories: {
    SO: [
      { key: 'obs', label: 'Observasi', target: 200, isTargeted: true },
      { key: 'iden', label: 'Identifikasi Bahaya', target: 16, isTargeted: true },
      { key: 'st', label: 'Safety Talk', target: 8, isTargeted: true },
      { key: 'ss', label: 'Safety Sharing', target: 28, isTargeted: true },
      { key: 'si', label: 'Safety Inspection', target: 0, isTargeted: false },
      { key: 'ps', label: 'Pelatihan Safety (Internal)', target: 0, isTargeted: false }
    ],
    WFSO: [
      { key: 'obs', label: 'Observasi', target: 140, isTargeted: true },
      { key: 'iden', label: 'Identifikasi Bahaya', target: 12, isTargeted: true },
      { key: 'ste', label: 'Safety Training (External)', target: 8, isTargeted: true },
      { key: 'st', label: 'Safety Talk', target: 8, isTargeted: true },
      { key: 'ss', label: 'Safety Sharing', target: 20, isTargeted: true },
      { key: 'si', label: 'Safety Inspection', target: 0, isTargeted: false },
      { key: 'ps', label: 'Pelatihan Safety (Internal)', target: 0, isTargeted: false }
    ]
  }
};

export default function App() {
  const getCurrentMonth = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  };
  
  // STATE NOTIFIKASI CANTIK (TOAST)
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  
  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentMonth()); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  
  const [personnel, setPersonnel] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});
  const [monthlyData, setMonthlyData] = useState({});
  const [masterData, setMasterData] = useState(defaultSettings); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [newEmp, setNewEmp] = useState({ nama: '', area: '', role: '' });
  const [selectedRoleContext, setSelectedRoleContext] = useState('SO');
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [selectedIndicator, setSelectedIndicator] = useState('obs');
  const [pasteText, setPasteText] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ nama: '', area: '', role: '' });
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nama: '' });
  
  const [newArea, setNewArea] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatTarget, setNewCatTarget] = useState(0);
  const [newCatType, setNewCatType] = useState('target'); 
  const [newCatRole, setNewCatRole] = useState('SO');

  const getAppId = () => typeof __app_id !== 'undefined' ? __app_id : 'bufn2-kpi-app';
  const getActiveCategories = (roleId) => masterData.categories[roleId] || [];

  const weeks = [
    { id: 'w1', label: 'Minggu 1' }, { id: 'w2', label: 'Minggu 2' },
    { id: 'w3', label: 'Minggu 3' }, { id: 'w4', label: 'Minggu 4' }, { id: 'w5', label: 'Minggu 5' }
  ];

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error(err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const appId = getAppId();
    setIsDbReady(false);
    
    const unsubs = [];

    // PERBAIKAN ALAMAT FIREBASE (Genap/Ganjil yang Tepat)
    // Aturan: collection = 3 segment, doc = 4 segment.
    try {
      // SETTINGS (4 Segment: artifacts / {appId} / settings / master)
      const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'settings', 'master'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!data.categories) data.categories = defaultSettings.categories;
          setMasterData(data);
          
          setNewEmp(prev => ({
            ...prev, 
            area: prev.area || data.areas?.[0] || '', 
            role: prev.role || data.roles?.[0]?.id || ''
          }));
          if(!newCatRole && data.roles?.[0]?.id) setNewCatRole(data.roles[0].id);
        } else {
          setDoc(doc(db, 'artifacts', appId, 'settings', 'master'), defaultSettings).catch(err => console.error(err));
        }
      }, (err) => { 
        console.error("Setting Error:", err); 
        showToast("Gagal memuat pengaturan database.", "error");
      });
      unsubs.push(unsubSettings);

      // PERSONNEL (3 Segment: artifacts / {appId} / personnel)
      const unsubPersonnel = onSnapshot(collection(db, 'artifacts', appId, 'personnel'), 
        (s) => { 
          const d = []; 
          s.forEach(doc => { 
            const data = doc.data();
            if (data && data.nama) d.push(data); 
          }); 
          setPersonnel(d); 
        },
        (err) => console.error("Personnel Error:", err)
      );
      unsubs.push(unsubPersonnel);
      
      // WEEKLY (3 Segment)
      const unsubWeekly = onSnapshot(collection(db, 'artifacts', appId, `weekly_${selectedPeriod}`), 
        (s) => { const d = {}; s.forEach(doc => { d[doc.id] = doc.data(); }); setWeeklyData(d); }
      );
      unsubs.push(unsubWeekly);
      
      // MONTHLY (3 Segment)
      const unsubMonthly = onSnapshot(collection(db, 'artifacts', appId, `monthly_${selectedPeriod}`), 
        (s) => { const d = {}; s.forEach(doc => { d[doc.id] = doc.data(); }); setMonthlyData(d); setIsDbReady(true); },
        (err) => { console.error("Monthly Error:", err); setIsDbReady(true); }
      );
      unsubs.push(unsubMonthly);
      
    } catch (err) {
      console.error("Init Error:", err); 
      setIsDbReady(true);
      showToast("Terjadi kesalahan sistem saat memuat data.", "error");
    }

    return () => { unsubs.forEach(u => u()); };
  }, [user, selectedPeriod]);

  // --- LOGIKA MASTER DATA ---
  const saveMasterData = async (newData) => {
    try {
      await setDoc(doc(db, 'artifacts', getAppId(), 'settings', 'master'), newData);
      showToast("Pengaturan berhasil disimpan!");
    } catch (error) {
      showToast("Gagal menyimpan pengaturan: " + error.message, "error");
    }
  };

  const handleAddArea = () => {
    if(!newArea.trim()) return;
    const formattedArea = newArea.trim().replace(/\b\w/g, l => l.toUpperCase());
    if(masterData.areas.includes(formattedArea)) return showToast("Smelter sudah ada!", "error");
    saveMasterData({ ...masterData, areas: [...masterData.areas, formattedArea] });
    setNewArea('');
  };

  const handleDeleteArea = (areaTarget) => {
    saveMasterData({ ...masterData, areas: masterData.areas.filter(a => a !== areaTarget) });
  };

  const handleUpdateCategory = (roleId, catIndex, field, value) => {
    const updatedCategories = { ...masterData.categories };
    if (field === 'target') updatedCategories[roleId][catIndex].target = Number(value);
    if (field === 'label') updatedCategories[roleId][catIndex].label = value;
    if (field === 'isTargeted') {
      updatedCategories[roleId][catIndex].isTargeted = value;
      if (!value) updatedCategories[roleId][catIndex].target = 0;
    }
    saveMasterData({ ...masterData, categories: updatedCategories });
  };

  const handleDeleteCategory = (roleId, catIndex) => {
    const updatedCategories = { ...masterData.categories };
    updatedCategories[roleId].splice(catIndex, 1);
    saveMasterData({ ...masterData, categories: updatedCategories });
  };

  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return showToast("Nama indikator tidak boleh kosong", "error");
    const updatedCategories = { ...masterData.categories };
    const newKey = 'cat_' + Date.now();
    
    if (!updatedCategories[newCatRole]) updatedCategories[newCatRole] = [];
    updatedCategories[newCatRole].push({
      key: newKey,
      label: newCatLabel,
      target: newCatType === 'target' ? Number(newCatTarget) : 0,
      isTargeted: newCatType === 'target'
    });
    
    saveMasterData({ ...masterData, categories: updatedCategories });
    setNewCatLabel(''); setNewCatTarget(0);
  };

  // --- LOGIKA DATABASE KARYAWAN ---
  const handleAddPersonnel = async (e) => {
    e.preventDefault();
    if (!newEmp.nama.trim()) return;
    try {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      await setDoc(doc(db, 'artifacts', getAppId(), 'personnel', newId), { ...newEmp, id: newId });
      setNewEmp({ ...newEmp, nama: '' });
      showToast("Karyawan berhasil ditambahkan!");
    } catch (error) {
      showToast("Gagal menambah karyawan: " + error.message, "error");
    }
  };

  const handleEditClick = (Karyawan) => {
    setEditingId(Karyawan.id);
    setEditFormData({ nama: Karyawan.nama, area: Karyawan.area, role: Karyawan.role });
  };

  const handleSaveEdit = async () => {
    if (!editFormData.nama.trim()) return;
    try {
      await setDoc(doc(db, 'artifacts', getAppId(), 'personnel', editingId), editFormData, { merge: true });
      setEditingId(null);
      showToast("Data karyawan diperbarui!");
    } catch (error) {
      showToast("Gagal mengubah data: " + error.message, "error");
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'artifacts', getAppId(), 'personnel', deleteModal.id));
      setDeleteModal({ show: false, id: null, nama: '' });
      showToast("Karyawan telah dihapus!");
    } catch (error) {
      showToast("Gagal menghapus karyawan: " + error.message, "error");
    }
  };

  // --- LOGIKA INPUT NILAI ---
  const handleProcessPaste = async () => {
    if (!pasteText.trim()) return showToast('Masukkan teks data terlebih dahulu.', 'error');
    const lines = pasteText.split('\n');
    let successCount = 0; let failedNames = []; const updates = {};

    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim()).filter(p => p !== '');
      if (parts.length < 2) return;

      let namaPaste = parts[0];
      const isAreaColumn = masterData.areas.some(a => a.toLowerCase() === (parts[1] || '').toLowerCase());
      
      let nilai = 0;
      if (isAreaColumn && parts.length >= 3) {
        nilai = parseFloat(parts[2].replace(',', '.')) || 0;
      } else {
        nilai = parseFloat(parts[1]?.replace(',', '.')) || 0;
      }

      const emp = personnel.find(p => p.nama.toLowerCase() === namaPaste.toLowerCase() && p.role === selectedRoleContext);
      if (emp) {
        if (!updates[emp.id]) updates[emp.id] = {};
        if (!updates[emp.id][selectedWeek]) updates[emp.id][selectedWeek] = {};
        updates[emp.id][selectedWeek][selectedIndicator] = nilai;
        successCount++;
      } else { failedNames.push(namaPaste); }
    });

    try {
      for (const empId of Object.keys(updates)) {
        await setDoc(doc(db, 'artifacts', getAppId(), `weekly_${selectedPeriod}`, empId), updates[empId], { merge: true });
      }
      setPasteText('');
      showToast(`Berhasil menyimpan ${successCount} data!`);
      if(failedNames.length > 0) {
        setTimeout(() => showToast(`Gagal: ${failedNames.slice(0, 2).join(', ')} (Nama salah)`, "error"), 4000);
      }
    } catch (error) {
      showToast("Gagal menyimpan nilai: " + error.message, "error");
    }
  };

  const handleMonthlyInput = async (empId, field, value) => {
    try {
      await setDoc(doc(db, 'artifacts', getAppId(), `monthly_${selectedPeriod}`, empId), { [field]: value }, { merge: true });
    } catch (error) {
      showToast("Gagal update laporan: " + error.message, "error");
    }
  };

  const getAccumulatedData = (empId, role) => {
    const empData = weeklyData[empId] || {};
    const total = {};
    getActiveCategories(role).forEach(c => total[c.key] = 0);
    Object.values(empData).forEach(weekData => {
      getActiveCategories(role).forEach(c => { total[c.key] += (weekData[c.key] || 0); });
    });
    return total;
  };

  const calculateScore = (acc, um, roleId) => {
    const cats = getActiveCategories(roleId);
    const targetedCats = cats.filter(c => c.isTargeted);
    const weightPerCat = targetedCats.length > 0 ? (100 / targetedCats.length) : 0; 

    let sAwal = targetedCats.length > 0 ? 100 : 0;
    targetedCats.forEach(c => {
      const val = acc[c.key] || 0;
      if (val < c.target) {
        const shortfall = (c.target - val) / c.target;
        sAwal -= (shortfall * weightPerCat);
      }
    });
    if(sAwal < 0) sAwal = 0;

    let tPoin = parseInt(um.kepatuhan) || 75;
    cats.filter(c => !c.isTargeted).forEach(c => tPoin += (acc[c.key] || 0)); 

    const penalti = -((parseInt(um.pelanggaran) || 0) * 5);
    const sAkhir = sAwal + tPoin + penalti;
    
    let grade = 'D';
    const ket = (um.keterangan || "").toLowerCase();
    if (ket.includes("ijin") || ket.includes("cuti")) grade = "C";
    else if (sAkhir >= 170 && um.kepatuhan == 100) grade = "A";
    else if (sAkhir >= 141 && um.kepatuhan == 100) grade = "B";
    else if (sAkhir >= 100 && um.kepatuhan == 100) grade = "C";

    return { sAwal, tPoin, penalti, sAkhir, grade };
  };

  const getDefisitTarget = () => {
    let defisit = [];
    personnel.filter(p => p.role === selectedRoleContext).forEach(p => {
      const acc = getAccumulatedData(p.id, p.role);
      getActiveCategories(p.role).filter(c => c.isTargeted).forEach(c => {
        const tercapai = acc[c.key] || 0;
        if (tercapai < c.target) {
          defisit.push({ id: p.id + c.key, nama: p.nama, area: p.area, indikator: c.label, tercapai, target: c.target, kurang: c.target - tercapai });
        }
      });
    });
    return defisit.sort((a, b) => b.kurang - a.kurang);
  };

  const exportToExcel = (area, personnelList) => {
    const cats = getActiveCategories(selectedRoleContext);
    let csvContent = "Nama,Smelter/Area,";
    cats.forEach(c => csvContent += `"${c.label}",`);
    csvContent += "Skor Awal,+ Poin,Pelanggaran,Penalti,Kepatuhan,Keterangan,Skor Akhir,Nilai\n";

    personnelList.forEach(p => {
      const acc = getAccumulatedData(p.id, p.role);
      const um = monthlyData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' };
      const calc = calculateScore(acc, um, p.role);

      let row = `"${p.nama}","${p.area}",`;
      cats.forEach(c => row += `"${acc[c.key]||0}",`);
      row += `"${calc.sAwal.toFixed(1)}","${calc.tPoin}","${um.pelanggaran||0}","${calc.penalti}","${um.kepatuhan||75}","${um.keterangan||''}","${calc.sAkhir.toFixed(1)}","${calc.grade}"\n`;
      csvContent += row;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_KPI_${selectedRoleContext}_${area}_${selectedPeriod}.csv`;
    link.click();
  };

  const getActiveAreasForView = (personnelList) => {
    const areas = [...masterData.areas];
    const hasUnlisted = personnelList.some(p => !masterData.areas.includes(p.area));
    if (hasUnlisted) areas.push('Area Tidak Dikenal (Perlu Diupdate)');
    return areas;
  };

  const filteredPersonnel = personnel.filter(p => p.role === selectedRoleContext);
  const searchResult = personnel.filter(p => (p.nama || '').toLowerCase().includes(searchQuery.toLowerCase()));

  if (!isDbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-emerald-700">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span className="font-semibold tracking-wider">Memuat Database...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-12 relative overflow-hidden">
      
      {/* TOAST NOTIFICATION (UI Cantik) */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-medium transition-all duration-300 transform translate-y-0 opacity-100 ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle size={24} /> : <CheckCircle size={24} />}
          <p>{toast.msg}</p>
        </div>
      )}

      <header className="bg-emerald-800 text-white p-5 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CheckCircle size={36} className="text-emerald-300" />
            <div>
              <h1 className="text-2xl font-bold tracking-wide">KPI HSE BUFN 2</h1>
              <p className="text-emerald-200 text-sm mt-0.5">Sistem Pengelolaan Dinamis</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-emerald-900 px-4 py-2 rounded-lg border border-emerald-700 flex items-center gap-2 shadow-inner">
              <Calendar size={16} className="text-emerald-300"/>
              <input type="month" className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer custom-month-input" 
                value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} />
            </div>
            <div className="bg-emerald-900 px-4 py-2 rounded-lg border border-emerald-700 text-xs text-green-400 font-bold shadow-inner">ONLINE</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-6 px-4">
        {/* NAVIGASI TAB */}
        <div className="flex flex-wrap space-x-1 border-b border-slate-300 mb-6">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setActiveTab('database')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'database' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><Database size={18}/> Karyawan</button>
          <button onClick={() => setActiveTab('input')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'input' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><ClipboardPaste size={18}/> Input Nilai</button>
          <button onClick={() => setActiveTab('laporan')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'laporan' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><Table size={18}/> Laporan</button>
          <button onClick={() => setActiveTab('pengaturan')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ml-auto ${activeTab === 'pengaturan' ? 'bg-slate-800 text-white border-t-2 border-emerald-500 shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}><Settings size={18}/> Pengaturan</button>
        </div>

        {/* ROLE FILTER */}
        {['input', 'laporan', 'dashboard'].includes(activeTab) && (
          <div className="mb-4 bg-white p-4 rounded-lg shadow-sm flex flex-wrap items-center gap-3 border border-slate-200">
            <span className="font-bold text-slate-700 mr-2">Tampilkan Data Untuk:</span>
            {masterData.roles.map(r => (
              <button key={r.id} onClick={() => setSelectedRoleContext(r.id)} 
                className={`px-4 py-1.5 rounded font-bold transition-all ${selectedRoleContext === r.id ? 'bg-emerald-100 text-emerald-800 shadow border border-emerald-200' : 'text-slate-500 hover:bg-slate-100'}`}>
                {r.name}
              </button>
            ))}
          </div>
        )}

        {/* --- TAB DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                <TrendingDown className="text-red-500" size={28} />
                <h2 className="text-xl font-bold text-slate-800">Defisit Target ({masterData.roles.find(r=>r.id===selectedRoleContext)?.name}) - {selectedPeriod}</h2>
              </div>
              
              <div className="overflow-x-auto max-h-[500px] border border-slate-200 rounded-lg shadow-inner">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-white sticky top-0 z-10">
                    <tr><th className="p-3">Nama Karyawan</th><th className="p-3 text-center">Smelter/Area</th><th className="p-3">Indikator</th><th className="p-3 text-center bg-slate-700">Tercapai</th><th className="p-3 text-center bg-slate-700">Target</th><th className="p-3 text-center bg-red-600">Kekurangan</th></tr>
                  </thead>
                  <tbody>
                    {getDefisitTarget().length === 0 ? (
                      <tr><td colSpan="6" className="p-10 text-center text-slate-500 font-bold bg-slate-50 border-dashed border border-slate-300">🎉 Semua karyawan memenuhi target bulan ini.</td></tr>
                    ) : (
                      getDefisitTarget().map((item) => (
                        <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-700">{item.nama}</td><td className="p-3 text-center font-bold text-slate-500">{item.area}</td><td className="p-3 font-medium">{item.indikator}</td><td className="p-3 text-center">{item.tercapai}</td><td className="p-3 text-center">{item.target}</td><td className="p-3 text-center font-bold text-red-600 bg-red-50/50"> - {item.kurang}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB DATABASE KARYAWAN --- */}
        {activeTab === 'database' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">
              <h2 className="text-lg font-bold mb-4 pb-2 border-b">Tambah Karyawan</h2>
              <form onSubmit={handleAddPersonnel} className="space-y-4">
                <div><label className="block text-sm text-slate-600 mb-1">Nama Lengkap</label><input type="text" required className="w-full border p-2 rounded" value={newEmp.nama} onChange={e => setNewEmp({...newEmp, nama: e.target.value})} /></div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Pilih Smelter / Area</label>
                  <select className="w-full border p-2 rounded" value={newEmp.area} onChange={e => setNewEmp({...newEmp, area: e.target.value})}>
                    {masterData.areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Role / Jabatan</label>
                  <select className="w-full border p-2 rounded" value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})}>
                    {masterData.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-bold py-2 rounded shadow">Simpan Karyawan</button>
              </form>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
              <div className="flex justify-between items-center mb-4 border-b pb-4">
                <h2 className="text-lg font-bold">Daftar Karyawan Global</h2>
                <div className="relative"><Search size={16} className="absolute left-2 top-2.5 text-slate-400" /><input type="text" placeholder="Cari nama..." className="pl-8 pr-2 py-1.5 border rounded text-sm w-48 focus:ring-emerald-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
              </div>
              <div className="overflow-y-auto max-h-[500px] border rounded shadow-inner">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 sticky top-0 z-10"><tr className="shadow-sm"><th className="p-3">Nama</th><th className="p-3 text-center">Smelter / Area</th><th className="p-3 text-center">Role</th><th className="p-3 text-center">Aksi</th></tr></thead>
                  <tbody>
                    {searchResult.length === 0 ? (
                      <tr><td colSpan="4" className="text-center p-10 text-slate-500 border border-dashed bg-slate-50">Karyawan tidak ditemukan.</td></tr>
                    ) : (
                      searchResult.map(p => {
                        const isAreaUnknown = !masterData.areas.includes(p.area);
                        return (
                        <tr key={p.id} className={`border-b hover:bg-slate-50 ${isAreaUnknown ? 'bg-red-50' : ''}`}>
                          {editingId === p.id ? (
                            <>
                              <td className="p-2"><input type="text" className="border p-1 w-full text-sm rounded focus:ring-emerald-500" value={editFormData.nama} onChange={(e) => setEditFormData({...editFormData, nama: e.target.value})} /></td>
                              <td className="p-2 text-center"><select className="border p-1 text-sm rounded focus:ring-emerald-500" value={editFormData.area} onChange={(e) => setEditFormData({...editFormData, area: e.target.value})}>{masterData.areas.map(a => <option key={a} value={a}>{a}</option>)}</select></td>
                              <td className="p-2 text-center"><select className="border p-1 text-sm rounded focus:ring-emerald-500" value={editFormData.role} onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}>{masterData.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                              <td className="p-2 text-center space-x-2 whitespace-nowrap"><button onClick={handleSaveEdit} className="text-white bg-emerald-600 px-3 py-1.5 rounded font-bold text-xs shadow">Simpan</button><button onClick={() => setEditingId(null)} className="bg-slate-200 px-3 py-1.5 rounded font-bold text-xs">Batal</button></td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-medium">{p.nama}</td>
                              <td className="p-3 text-center font-bold text-slate-500">
                                {p.area} {isAreaUnknown && <span className="text-red-500 text-xs block mt-1">(Perlu Diupdate)</span>}
                              </td>
                              <td className="p-3 text-center"><span className="px-3 py-1 bg-slate-200 rounded-full text-xs font-bold">{masterData.roles.find(r=>r.id===p.role)?.name || p.role}</span></td>
                              <td className="p-3 text-center space-x-4"><button onClick={() => handleEditClick(p)} className="text-blue-500 hover:text-blue-700"><Edit size={18}/></button><button onClick={() => setDeleteModal({ show: true, id: p.id, nama: p.nama })} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button></td>
                            </>
                          )}
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB INPUT NILAI --- */}
        {activeTab === 'input' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-50 p-6 rounded-lg border h-fit">
                  <h2 className="font-bold text-lg mb-4 border-b pb-2">Paste Data Excel</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <select className="border p-2 w-full rounded focus:ring-emerald-500" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>{weeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
                    <select className="border p-2 w-full rounded focus:ring-emerald-500" value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>{getActiveCategories(selectedRoleContext).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                  </div>
                  <textarea className="w-full border p-3 h-48 rounded text-sm font-mono focus:ring-emerald-500" placeholder="Nama [Tab] Nilai" value={pasteText} onChange={(e) => setPasteText(e.target.value)}></textarea>
                  <button onClick={handleProcessPaste} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 mt-4 rounded shadow">Proses & Simpan</button>
                </div>
                <div>
                  <h2 className="font-bold text-lg mb-4">Preview ({masterData.roles.find(r=>r.id===selectedRoleContext)?.name})</h2>
                  
                  {getActiveAreasForView(filteredPersonnel).length === 0 && (
                     <div className="text-center p-10 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500">
                        Belum ada karyawan terdaftar untuk jabatan ini.
                     </div>
                  )}

                  {getActiveAreasForView(filteredPersonnel).map(area => {
                    const isUnknown = area.includes('Tidak Dikenal');
                    const areaPersonnel = filteredPersonnel.filter(p => isUnknown ? !masterData.areas.includes(p.area) : p.area === area);
                    
                    if (areaPersonnel.length === 0) return null;
                    return (
                      <div key={area} className="mb-4">
                        <div className={`px-3 py-1.5 rounded-t-lg font-bold text-sm ${isUnknown ? 'bg-red-200 text-red-800' : 'bg-slate-200 text-slate-700'}`}>{area}</div>
                        <div className="overflow-x-auto border border-t-0 rounded-b-lg">
                          <table className="w-full text-xs"><thead className="bg-slate-50 border-b"><tr><th className="p-2 text-left">Nama</th>{getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-2 text-center">{c.label}</th>)}</tr></thead>
                            <tbody>{areaPersonnel.map(p => (<tr key={p.id} className="border-b"><td className="p-2">{p.nama}</td>{getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-2 text-center">{weeklyData[p.id]?.[selectedWeek]?.[c.key] || '-'}</td>)}</tr>))}</tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
             </div>
          </div>
        )}

        {/* --- TAB LAPORAN --- */}
        {activeTab === 'laporan' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="mb-6 pb-4 border-b border-slate-200"><h2 className="font-bold text-2xl">Laporan KPI - {selectedPeriod}</h2></div>
             
             {getActiveAreasForView(filteredPersonnel).length === 0 && (
                <div className="text-center p-10 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 font-bold">
                   Belum ada karyawan untuk ditampilkan.
                </div>
             )}

             {getActiveAreasForView(filteredPersonnel).map(area => {
                const isUnknown = area.includes('Tidak Dikenal');
                const areaPersonnel = filteredPersonnel.filter(p => isUnknown ? !masterData.areas.includes(p.area) : p.area === area);
                if (areaPersonnel.length === 0) return null;
                
                return (
                  <div key={area} className="mb-10 overflow-x-auto shadow-sm rounded-lg">
                    <div className={`flex justify-between items-center text-white px-4 py-3 rounded-t-lg ${isUnknown ? 'bg-red-800' : 'bg-slate-800'}`}>
                      <h3 className="font-bold text-lg flex items-center gap-2"><Table size={18} className="text-emerald-400" /> {area}</h3>
                      <button onClick={() => exportToExcel(area, areaPersonnel)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2"><Download size={14} /> Export</button>
                    </div>
                    <table className="w-full text-xs border-collapse whitespace-nowrap border-x border-b border-slate-300">
                      <thead className="bg-slate-700 text-white">
                        <tr>
                          <th className="p-3 text-left">Nama Lengkap</th><th className="p-3 text-center">Smelter/Area</th>
                          {getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-3 border-l border-slate-600">{c.label}</th>)}
                          <th className="p-3 bg-slate-600 border-l border-slate-500">Skor Awal</th><th className="p-3 bg-slate-600">+ Poin</th><th className="p-3 bg-slate-600">Pelanggaran</th><th className="p-3 bg-slate-600">Penalti</th><th className="p-3 bg-emerald-800 border-l border-emerald-700">Kepatuhan</th><th className="p-3 bg-emerald-800">Ket.</th><th className="p-3 bg-emerald-700 border-l border-emerald-600">SKOR AKHIR</th><th className="p-3 bg-emerald-600 border-l border-emerald-500">NILAI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaPersonnel.map(p => {
                          const acc = getAccumulatedData(p.id, p.role);
                          const um = monthlyData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' };
                          const calc = calculateScore(acc, um, p.role);

                          return (
                            <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-700">{p.nama}</td><td className="p-3 text-center font-bold text-slate-500 bg-slate-50/50">{p.area}</td>
                              {getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-3 text-center border-l border-slate-200 font-medium">{acc[c.key]||0}</td>)}
                              <td className="p-3 text-center border-l border-slate-200 bg-slate-50 font-bold">{calc.sAwal.toFixed(1)}</td>
                              <td className="p-3 text-center bg-slate-50 font-bold text-emerald-600">+{calc.tPoin}</td>
                              <td className="p-2 text-center bg-red-50/30 border-l border-slate-200"><input type="number" className="w-14 border p-1 rounded text-center focus:ring-red-500" value={um.pelanggaran} onChange={e=>handleMonthlyInput(p.id, 'pelanggaran', e.target.value)}/></td>
                              <td className="p-3 text-center text-red-600 font-bold bg-red-50/30">{calc.penalti}</td>
                              <td className="p-2 text-center border-l border-slate-200 bg-emerald-50/30"><select className="border p-1.5 rounded w-full focus:ring-emerald-500" value={um.kepatuhan} onChange={e=>handleMonthlyInput(p.id, 'kepatuhan', e.target.value)}><option value="25">25</option><option value="50">50</option><option value="75">75</option><option value="100">100</option></select></td>
                              <td className="p-2 bg-emerald-50/30"><input type="text" className="w-24 border p-1.5 text-xs rounded focus:ring-emerald-500" placeholder="Cuti/Ijin" value={um.keterangan} onChange={e=>handleMonthlyInput(p.id, 'keterangan', e.target.value)}/></td>
                              <td className="p-3 text-center font-bold text-lg text-emerald-800 bg-emerald-100/50 border-l border-emerald-200">{calc.sAkhir.toFixed(1)}</td>
                              <td className="p-3 text-center border-l border-emerald-200 bg-emerald-50/50"><span className={`px-3 py-1.5 rounded text-white font-black tracking-wider ${calc.grade==='A'?'bg-green-500':calc.grade==='B'?'bg-lime-500':calc.grade==='C'?'bg-yellow-500':'bg-red-500'}`}>{calc.grade}</span></td>
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

        {/* --- TAB PENGATURAN (MASTER DATA) --- */}
        {activeTab === 'pengaturan' && (
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 text-slate-200">
            <h2 className="font-bold text-2xl mb-2 text-white flex items-center gap-2"><Settings /> Pengaturan Sistem (Master Data)</h2>
            <p className="text-sm text-slate-400 mb-8 border-b border-slate-700 pb-4">Setiap perubahan di sini akan otomatis mengubah seluruh struktur tabel, form, dan rumus penilaian di aplikasi secara instan.</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* KOLOM KIRI: AREA */}
              <div className="bg-slate-900 p-5 rounded-lg border border-slate-700 h-fit lg:col-span-1">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">Manajemen Smelter / Area</h3>
                <div className="flex gap-2 mb-4">
                  <input type="text" placeholder="Misal: Smelter G" className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:ring-emerald-500" value={newArea} onChange={e=>setNewArea(e.target.value)} />
                  <button onClick={handleAddArea} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-white font-bold text-sm"><Plus size={16}/></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {masterData.areas.map(area => (
                    <div key={area} className="bg-slate-700 px-3 py-1.5 rounded flex items-center gap-2 text-sm font-bold text-emerald-300">
                      {area} <button onClick={() => handleDeleteArea(area)} className="text-red-400 hover:text-red-300"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* KOLOM KANAN: INDIKATOR */}
              <div className="bg-slate-900 p-5 rounded-lg border border-slate-700 lg:col-span-2">
                <h3 className="font-bold text-white mb-4">Manajemen Indikator (KPI)</h3>
                <div className="grid grid-cols-1 gap-6 mb-8">
                  {masterData.roles.map(r => (
                    <div key={r.id} className="bg-slate-800 p-4 rounded border border-slate-600">
                      <h4 className="font-bold text-emerald-400 mb-4 border-b border-slate-700 pb-2 flex justify-between items-center">
                        <span>Indikator {r.name}</span>
                      </h4>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm mb-4">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-700">
                              <th className="pb-2">Nama Indikator</th><th className="pb-2 text-center">Tipe</th><th className="pb-2 text-center">Target (Angka)</th><th className="pb-2 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {masterData.categories[r.id]?.map((cat, index) => (
                              <tr key={cat.key} className="border-b border-slate-700/50">
                                <td className="py-2"><input type="text" className="bg-slate-700 border border-slate-600 rounded p-1 w-full text-white text-xs" value={cat.label} onChange={(e) => handleUpdateCategory(r.id, index, 'label', e.target.value)} /></td>
                                <td className="py-2 px-2 text-center">
                                  <select className="bg-slate-700 border border-slate-600 rounded p-1 text-white text-xs" value={cat.isTargeted} onChange={(e) => handleUpdateCategory(r.id, index, 'isTargeted', e.target.value === 'true')}>
                                    <option value="true">Target Utama</option><option value="false">Extra Poin</option>
                                  </select>
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input type="number" disabled={!cat.isTargeted} className={`w-16 bg-slate-700 border border-slate-600 rounded p-1 text-center text-xs font-bold text-white ${!cat.isTargeted && 'opacity-50'}`} value={cat.target} onChange={(e) => handleUpdateCategory(r.id, index, 'target', e.target.value)} />
                                </td>
                                <td className="py-2 text-center"><button onClick={() => handleDeleteCategory(r.id, index)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={16}/></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>

                {/* FORM TAMBAH INDIKATOR BARU */}
                <div className="bg-slate-800 p-4 rounded border border-emerald-700/50 shadow-inner">
                  <h4 className="font-bold text-white mb-3 text-sm flex items-center gap-2"><Plus size={16} className="text-emerald-400"/> Tambah Indikator Baru</h4>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[150px]"><label className="block text-xs text-slate-400 mb-1">Pilih Jabatan</label>
                      <select className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white text-sm" value={newCatRole} onChange={e=>setNewCatRole(e.target.value)}>
                        {masterData.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[150px]"><label className="block text-xs text-slate-400 mb-1">Nama Indikator</label><input type="text" placeholder="Misal: Patroli" className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white text-sm" value={newCatLabel} onChange={e=>setNewCatLabel(e.target.value)} /></div>
                    <div className="w-32"><label className="block text-xs text-slate-400 mb-1">Tipe</label>
                      <select className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white text-sm" value={newCatType} onChange={e=>setNewCatType(e.target.value)}>
                        <option value="target">Target Utama</option><option value="extra">Extra Poin</option>
                      </select>
                    </div>
                    {newCatType === 'target' && (
                      <div className="w-24"><label className="block text-xs text-slate-400 mb-1">Target</label><input type="number" className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white text-sm font-bold" value={newCatTarget} onChange={e=>setNewCatTarget(e.target.value)} /></div>
                    )}
                    <button onClick={handleAddCategory} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-white font-bold text-sm h-[38px] shadow transition-colors">Simpan</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL HAPUS KARYAWAN */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-slate-900/75 flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 transform transition-all">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 p-3 rounded-full mb-4"><AlertTriangle size={32} className="text-red-600" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Karyawan?</h3>
              <p className="text-slate-600 mb-6 text-sm">Apakah Anda yakin ingin menghapus <b>{deleteModal.nama}</b> secara permanen?</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteModal({ show: false, id: null, nama: '' })} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 transition-colors font-bold rounded-lg text-slate-700">Batal</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 transition-colors text-white font-bold rounded-lg">Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

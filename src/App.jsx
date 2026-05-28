/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ClipboardPaste, 
  CheckCircle, 
  Table, 
  Trash2, 
  Edit, 
  AlertTriangle, 
  Download, 
  Search, 
  LayoutDashboard, 
  Calendar, 
  TrendingDown, 
  Settings, 
  Plus, 
  XCircle, 
  Award, 
  Medal, 
  UserCheck,
  Lock,
  User,
  LogOut
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';

// =====================================================
// KONFIGURASI FIREBASE CLOUD
// =====================================================
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

// MASTER DATA DEFAULT
const defaultSettings = {
  areas: ['Smelter C', 'Smelter E', 'Smelter F'], 
  roles: [
    { id: 'SO', name: 'Safety Officer' },
    { id: 'WFSO', name: 'Wakil Foreman' },
    { id: 'Foreman', name: 'Foreman' },
    { id: 'Admin', name: 'Admin Sistem' }
  ],
  categories: {
    SO: [
      { key: 'obs', label: 'Observasi', target: 200, isTargeted: true },
      { key: 'iden', label: 'Identifikasi Bahaya', target: 16, isTargeted: true },
      { key: 'st', label: 'Safety Talk', target: 8, isTargeted: true },
      { key: 'ss', label: 'Safety Sharing', target: 28, isTargeted: true },
      { key: 'si', label: 'Safety Inspection', target: 0, isTargeted: false },
      { key: 'ps', label: 'Pelatihan Safety', target: 0, isTargeted: false }
    ],
    WFSO: [
      { key: 'obs', label: 'Observasi', target: 140, isTargeted: true },
      { key: 'iden', label: 'Identifikasi Bahaya', target: 12, isTargeted: true },
      { key: 'ste', label: 'Safety Training (External)', target: 8, isTargeted: true },
      { key: 'st', label: 'Safety Talk', target: 8, isTargeted: true },
      { key: 'ss', label: 'Safety Sharing', target: 20, isTargeted: true },
      { key: 'si', label: 'Safety Inspection', target: 0, isTargeted: false },
      { key: 'ps', label: 'Pelatihan Safety (Internal)', target: 0, isTargeted: false }
    ],
    Foreman: [],
    Admin: []
  }
};

export default function App() {
  const getCurrentMonth = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  };

  const generatePeriodList = () => {
    const periods = [];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentYear = new Date().getFullYear();
    for(let y = currentYear - 1; y <= currentYear + 1; y++) {
      for(let m = 0; m < 12; m++) {
        periods.push({ id: `${y}-${String(m+1).padStart(2, '0')}`, label: `${months[m]} ${y}` });
      }
    }
    return periods;
  };

  // =====================================================
  // STATE AUTENTIKASI & SESSION LOGIN
  // =====================================================
  const [currentUser, setCurrentUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ idKaryawan: '', password: '' });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardMode, setDashboardMode] = useState('bulanan'); 
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentMonth());
  const [user, setUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3500);
  };

  const [personnel, setPersonnel] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});
  const [monthlyData, setMonthlyData] = useState({});
  const [masterData, setMasterData] = useState(defaultSettings); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardSearch, setDashboardSearch] = useState({}); 
  
  const [newEmp, setNewEmp] = useState({ nama: '', area: '', role: '', idKaryawan: '', password: '' });
  const [selectedRoleContext, setSelectedRoleContext] = useState('SO');
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [selectedIndicator, setSelectedIndicator] = useState('obs');
  const [pasteText, setPasteText] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ nama: '', area: '', role: '', idKaryawan: '', password: '' });
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nama: '' });
  const [pasteErrors, setPasteErrors] = useState([]);
  
  const [newArea, setNewArea] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatTarget, setNewCatTarget] = useState(0);
  const [newCatType, setNewCatType] = useState('target'); 
  const [newCatRole, setNewCatRole] = useState('SO');

  const [yearlyRecapData, setYearlyRecapData] = useState({ globalBest: null, areaBest: {} });
  const [loadingYearly, setLoadingYearly] = useState(false);

  const getAppId = () => typeof __app_id !== 'undefined' ? __app_id : 'bufn2-kpi-app';
  const getActiveCategories = (roleId) => masterData.categories[roleId] || [];

  const getAllUniqueCategories = () => {
    const allCats = [];
    masterData.roles.forEach(r => {
      masterData.categories[r.id]?.forEach(c => {
        if (!allCats.find(existing => existing.key === c.key)) {
          allCats.push(c);
        }
      });
    });
    return allCats;
  };

  const weeks = [
    { id: 'w1', label: 'Minggu 1' }, { id: 'w2', label: 'Minggu 2' },
    { id: 'w3', label: 'Minggu 3' }, { id: 'w4', label: 'Minggu 4' }, { id: 'w5', label: 'Minggu 5' }
  ];

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const appId = getAppId();
    setIsDbReady(false);
    const unsubs = [];

    try {
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
          setDoc(doc(db, 'artifacts', appId, 'settings', 'master'), defaultSettings);
        }
      }, (err) => console.error(err));
      unsubs.push(unsubSettings);

      const unsubPersonnel = onSnapshot(collection(db, 'artifacts', appId, 'personnel'), (s) => { 
        const d = []; 
        s.forEach(doc => { 
          const data = doc.data();
          if (data && data.nama) d.push(data); 
        }); 
        setPersonnel(d); 
      });
      unsubs.push(unsubPersonnel);
      
      const unsubWeekly = onSnapshot(collection(db, 'artifacts', appId, `weekly_${selectedPeriod}`), (s) => { 
        const d = {}; s.forEach(doc => { d[doc.id] = doc.data(); }); setWeeklyData(d); 
      });
      unsubs.push(unsubWeekly);
      
      const unsubMonthly = onSnapshot(collection(db, 'artifacts', appId, `monthly_${selectedPeriod}`), (s) => { 
        const d = {}; s.forEach(doc => { d[doc.id] = doc.data(); }); setMonthlyData(d); setIsDbReady(true); 
      }, (err) => { console.error(err); setIsDbReady(true); });
      unsubs.push(unsubMonthly);
      
    } catch (err) {
      console.error(err); setIsDbReady(true);
    }

    return () => { unsubs.forEach(u => u()); };
  }, [user, selectedPeriod]);

  // PROTEKSI KONTEKS ROLE BAGI KARYAWAN BIASA
  useEffect(() => {
    if (currentUser && currentUser.role !== 'Admin' && currentUser.role !== 'Foreman') {
      setSelectedRoleContext(currentUser.role);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'dashboard' && dashboardMode === 'tahunan' && personnel.length > 0) {
      calculateYearlyBest();
    }
  }, [activeTab, dashboardMode, selectedPeriod, personnel, selectedRoleContext]);

  // --- PROSES EXECUTOR AUTH LOGIN ---
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const username = loginForm.idKaryawan.trim();
    const password = loginForm.password.trim();

    if (!username || !password) return showToast("Harap isi semua kolom login!", "error");

    // Skenario 1: Master bypass akun cadangan awal
    if (username.toLowerCase() === 'admin' && password === 'adminbufn2') {
      setCurrentUser({ id: 'master-admin', nama: 'Super Admin HSE', role: 'Admin', area: 'All Smelters', idKaryawan: 'admin' });
      showToast("Selamat datang, Super Admin!");
      setActiveTab('dashboard');
      return;
    }

    // Skenario 2: Cari data asli di Firestore cloud
    const foundUser = personnel.find(p => p.idKaryawan && p.idKaryawan.trim() === username && p.password && p.password.trim() === password);

    if (foundUser) {
      setCurrentUser(foundUser);
      showToast(`Selamat datang, ${foundUser.nama}!`);
      setActiveTab('dashboard');
    } else {
      showToast("ID Karyawan atau Password Anda salah!", "error");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginForm({ idKaryawan: '', password: '' });
    showToast("Anda berhasil keluar sistem.");
  };

  // --- OPERASIONAL MASTER DATA ---
  const saveMasterData = async (newData) => {
    try {
      await setDoc(doc(db, 'artifacts', getAppId(), 'settings', 'master'), newData);
      showToast("Pengaturan sistem berhasil diperbarui!");
    } catch (error) {
      showToast("Gagal menyimpan ke server: " + error.message, "error");
    }
  };

  const handleAddArea = () => {
    if(!newArea.trim()) return;
    const formattedArea = newArea.trim().replace(/\b\w/g, l => l.toUpperCase());
    if(masterData.areas.includes(formattedArea)) return showToast("Nama Smelter sudah terdaftar!", "error");
    saveMasterData({ ...masterData, areas: [...masterData.areas, formattedArea] });
    setNewArea('');
  };

  const handleDeleteArea = (areaTarget) => {
    if(confirm(`Hapus ${areaTarget} dari master sistem? Karyawan di area ini tidak akan terhapus, tapi ditandai.`)) {
      saveMasterData({ ...masterData, areas: masterData.areas.filter(a => a !== areaTarget) });
    }
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
    if (!newCatLabel.trim()) return showToast("Nama indikator wajib diisi!", "error");
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

  // --- OPERASIONAL KARYAWAN ---
  const handleAddPersonnel = async (e) => {
    e.preventDefault();
    if (!newEmp.nama.trim() || !newEmp.idKaryawan.trim() || !newEmp.password.trim()) {
      return showToast("Harap isi semua kolom profil dan kredensial login!", "error");
    }
    try {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      await setDoc(doc(db, 'artifacts', getAppId(), 'personnel', newId), { ...newEmp, id: newId });
      setNewEmp({ nama: '', area: masterData.areas[0], role: masterData.roles[0].id, idKaryawan: '', password: '' });
      showToast("Karyawan baru berhasil ditambahkan!");
    } catch (error) {
      showToast("Gagal menyimpan karyawan: " + error.message, "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!editFormData.nama.trim() || !editFormData.idKaryawan.trim() || !editFormData.password.trim()) return;
    try {
      await setDoc(doc(db, 'artifacts', getAppId(), 'personnel', editingId), editFormData, { merge: true });
      setEditingId(null);
      showToast("Profil data karyawan berhasil diubah!");
    } catch (error) {
      showToast("Gagal mengubah profil data: " + error.message, "error");
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'artifacts', getAppId(), 'personnel', deleteModal.id));
      setDeleteModal({ show: false, id: null, nama: '' });
      showToast("Data karyawan dihapus permanen dari sistem!");
    } catch (error) {
      showToast("Gagal menghapus: " + error.message, "error");
    }
  };

  // --- REKAP DATA PASTE ---
  const handleProcessPaste = async () => {
    if (!pasteText.trim()) return showToast('Teks data paste kosong!', 'error');
    const lines = pasteText.split('\n');
    
    const counts = {}; 
    let lineTotal = 0;

    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim()).filter(p => p !== '');
      if (parts.length < 1) return;

      const namaPaste = parts[0].toLowerCase();
      if (!counts[namaPaste]) counts[counts] = 0;
      counts[namaPaste] = (counts[namaPaste] || 0) + 1; 
      lineTotal++;
    });

    const updates = {};
    let matchedCount = 0;
    let notFoundNames = [];

    Object.keys(counts).forEach(namaKey => {
      const emp = personnel.find(p => p.nama.toLowerCase() === namaKey);
      
      if (emp) {
        if (!updates[emp.id]) updates[emp.id] = {};
        if (!updates[emp.id][selectedWeek]) updates[emp.id][selectedWeek] = {};
        
        const oldVal = weeklyData[emp.id]?.[selectedWeek]?.[selectedIndicator] || 0;
        updates[emp.id][selectedWeek][selectedIndicator] = oldVal + counts[namaKey];
        matchedCount++;
      } else {
        notFoundNames.push(namaKey);
      }
    });

    try {
      for (const empId of Object.keys(updates)) {
        await setDoc(doc(db, 'artifacts', getAppId(), `weekly_${selectedPeriod}`, empId), updates[empId], { merge: true });
      }
      setPasteText('');
      showToast(`Berhasil merekap ${lineTotal} data ke ${matchedCount} karyawan!`);
      if(notFoundNames.length > 0) {
        setPasteErrors(Array.from(new Set(notFoundNames)));
      }
    } catch (error) {
      showToast("Gagal memproses rekap data: " + error.message, "error");
    }
  };

  const handleMonthlyInput = async (empId, field, value) => {
    try {
      await setDoc(doc(db, 'artifacts', getAppId(), `monthly_${selectedPeriod}`, empId), { [field]: value }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  };

  // =====================================================
  // ENGINE LOGIKA RUMUS MATEMATIKA KPI
  // =====================================================
  const calculateScore = (acc, um, roleId) => {
    const cats = getActiveCategories(roleId);
    const targetedCats = cats.filter(c => c.isTargeted);
    const untargetedCats = cats.filter(c => !c.isTargeted);
    
    const weightPerCat = targetedCats.length > 0 ? (100 / targetedCats.length) : 0; 
    let sAwal = targetedCats.length > 0 ? 100 : 0;
    
    targetedCats.forEach(c => {
      const val = acc[c.key] || 0;
      if (val < c.target) {
        const shortfall = c.target - val;
        const percentageFailed = shortfall / c.target;
        sAwal -= (percentageFailed * weightPerCat);
      }
    });
    if(sAwal < 0) sAwal = 0; 

    let tPoin = Number(um.kepatuhan) || 75; 
    untargetedCats.forEach(c => { tPoin += (acc[c.key] || 0) }); 

    const penalti = (Number(um.pelanggaran) || 0) * -5;
    const sAkhir = sAwal + tPoin + penalti;
    
    let grade = 'D';
    const isAwalSempurna = Math.abs(sAwal - 100) < 0.1; 
    const ket = (um.keterangan || "").toLowerCase();
    const hasIjin = ket.includes("ijin") || ket.includes("cuti");

    if (isAwalSempurna) {
      if (sAkhir >= 170) grade = 'A';
      else if (sAkhir >= 141) grade = 'B';
      else if (sAkhir >= 100) grade = 'C';
    } else {
      if (hasIjin) grade = 'C';
    }

    return { sAwal, tPoin, penalti, sAkhir, grade };
  };

  // --- ALGORITMA REKAP TAHUNAN ---
  const calculateYearlyBest = async () => {
    setLoadingYearly(true);
    const year = selectedPeriod.split('-')[0];
    const appId = getAppId();
    const yearlyScores = {};

    try {
      for (let m = 1; m <= 12; m++) {
        const periodKey = `${year}-${String(m).padStart(2, '0')}`;
        const weeklySnap = await getDocs(collection(db, 'artifacts', appId, `weekly_${periodKey}`));
        const monthlySnap = await getDocs(collection(db, 'artifacts', appId, `monthly_${periodKey}`));
        
        const wData = {};
        weeklySnap.forEach(doc => { wData[doc.id] = doc.data(); });
        const mData = {};
        monthlySnap.forEach(doc => { mData[doc.id] = doc.data(); });

        personnel.filter(p => p.role === selectedRoleContext).forEach(p => {
          if (!yearlyScores[p.id]) {
            yearlyScores[p.id] = { id: p.id, nama: p.nama, area: p.area, totalScore: 0, monthsActive: 0 };
          }

          const empWeekly = wData[p.id] || {};
          const totalWeeklyAcc = {};
          getActiveCategories(p.role).forEach(c => totalWeeklyAcc[c.key] = 0);
          
          Object.values(empWeekly).forEach(weekData => {
            getActiveCategories(p.role).forEach(c => { totalWeeklyAcc[c.key] += (weekData[c.key] || 0); });
          });

          const empMonthly = mData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' };
          const calc = calculateScore(totalWeeklyAcc, empMonthly, p.role);
          
          yearlyScores[p.id].totalScore += calc.sAkhir;
          yearlyScores[p.id].monthsActive += 1; 
        });
      }

      const finalRank = Object.values(yearlyScores).map(p => ({
        ...p,
        averageScore: p.monthsActive > 0 ? (p.totalScore / p.monthsActive) : 0
      })).filter(p => p.averageScore > 0);

      finalRank.sort((a, b) => b.averageScore - a.averageScore);

      const areaBest = {};
      masterData.areas.forEach(area => {
        const filteredArea = finalRank.filter(p => p.area === area);
        areaBest[area] = filteredArea[0] || null; 
      });

      setYearlyRecapData({
        globalBest: finalRank[0] || null,
        areaBest: areaBest
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingYearly(false);
    }
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

  // =====================================================
  // FILTERING DATA BERDASARKAN LEVEL AKSES LOGIN (RBAC)
  // =====================================================
  const getVisibleAreas = () => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return masterData.areas;
    // Foreman hanya melihat Smelter miliknya
    if (currentUser.role === 'Foreman') return [currentUser.area];
    // Karyawan biasa melihat Smelter miliknya
    return [currentUser.area];
  };

  const getVisiblePersonnel = (area) => {
    if (!currentUser) return [];
    
    // Ambil basis karyawan di smelter & jabatan aktif
    let list = personnel.filter(p => p.role === selectedRoleContext && p.area === area);
    
    // Jika Karyawan biasa login, kunci tabel hanya untuk memunculkan namanya sendiri
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Foreman') {
      list = list.filter(p => p.id === currentUser.id);
    }
    return list;
  };

  const filteredPersonnel = personnel.filter(p => p.role === selectedRoleContext);
  const searchResult = personnel.filter(p => (p.nama || '').toLowerCase().includes(searchQuery.toLowerCase()));

  // =====================================================
  // RENDER JENDELA LOGIN CARD JIKA BELUM AUTENTIKASI
  // =====================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {toast.show && (
          <div className="fixed top-6 right-6 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-semibold bg-gradient-to-r from-red-600 to-rose-700 border border-white/20">
            <XCircle size={22} /> <p className="text-sm">{toast.msg}</p>
          </div>
        )}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-700/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-700/20 rounded-full blur-3xl"></div>
        
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full relative z-10 animate-in fade-in zoom-in duration-300">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-emerald-600/10 p-3 rounded-2xl border border-emerald-500/30 mb-3">
              <CheckCircle size={40} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">PORTAL KPI HSE</h2>
            <p className="text-slate-400 text-xs mt-1">Silakan masuk menggunakan ID Karyawan Anda</p>
          </div>
          
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">ID Karyawan (Username)</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-3 text-slate-500" />
                <input type="text" placeholder="Masukkan ID Karyawan" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                  value={loginForm.idKaryawan} onChange={e => setLoginForm({...loginForm, idKaryawan: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-slate-500" />
                <input type="password" placeholder="Masukkan Password" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg transition-colors mt-2 text-sm tracking-wide">
              Masuk Sistem
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER UTAMA DASHBOARD CORE SYSTEM (AUTHENTICATED)
  // =====================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-12 relative overflow-hidden">
      
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-semibold border border-white/20 ${toast.type === 'error' ? 'bg-gradient-to-r from-red-600 to-rose-700' : 'bg-gradient-to-r from-emerald-600 to-teal-700'}`}>
          {toast.type === 'error' ? <XCircle size={22} /> : <CheckCircle size={22} />}
          <p className="text-sm tracking-wide">{toast.msg}</p>
        </div>
      )}

      <header className="bg-emerald-800 text-white p-5 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CheckCircle size={36} className="text-emerald-300" />
            <div>
              <h1 className="text-2xl font-bold tracking-wide">KPI HSE BUFN 2</h1>
              <p className="text-emerald-200 text-xs mt-0.5">User: <b>{currentUser.nama}</b> ({currentUser.role})</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-emerald-900 px-4 py-2 rounded-lg border border-emerald-700 flex items-center gap-2 shadow-inner">
              <Calendar size={16} className="text-emerald-300"/>
              {/* DROPDOWN KALENDER KUSTOM */}
              <select className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer outline-none" 
                value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                {generatePeriodList().map(p => <option key={p.id} value={p.id} className="text-slate-800">{p.label}</option>)}
              </select>
            </div>
            <button onClick={handleLogout} className="bg-red-700 hover:bg-red-600 text-white px-3 py-2 rounded-lg border border-red-800 font-bold text-xs flex items-center gap-1.5 shadow transition-colors">
              <LogOut size={14}/> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-6 px-4">
        {/* TAB NAVIGATION DENGAN PROTEKSI HAK AKSES */}
        <div className="flex flex-wrap space-x-1 border-b border-slate-300 mb-6">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><LayoutDashboard size={18}/> Dashboard</button>
          
          {currentUser.role === 'Admin' && (
            <>
              <button onClick={() => setActiveTab('database')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'database' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><Database size={18}/> Karyawan</button>
              <button onClick={() => setActiveTab('input')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'input' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><ClipboardPaste size={18}/> Input Nilai</button>
            </>
          )}
          
          <button onClick={() => setActiveTab('laporan')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'laporan' ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><Table size={18}/> Laporan</button>
          
          {currentUser.role === 'Admin' && (
            <button onClick={() => setActiveTab('pengaturan')} className={`px-4 py-3 font-semibold rounded-t-lg transition-colors flex items-center gap-2 ml-auto ${activeTab === 'pengaturan' ? 'bg-slate-800 text-white border-t-2 border-emerald-500 shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}><Settings size={18}/> Pengaturan</button>
          )}
        </div>

        {/* ROLE FILTER JABATAN */}
        {['input', 'laporan', 'dashboard'].includes(activeTab) && (currentUser.role === 'Admin' || currentUser.role === 'Foreman') && (
          <div className="mb-4 bg-white p-4 rounded-lg shadow-sm flex flex-wrap items-center gap-3 border border-slate-200">
            <span className="font-bold text-slate-700 mr-2">Tampilkan Data Untuk:</span>
            {masterData.roles.filter(r => r.id === 'SO' || r.id === 'WFSO').map(r => (
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
            {/* Hanya Admin & Foreman yang bisa melihat Tab Juara Tahunan */}
            {(currentUser.role === 'Admin' || currentUser.role === 'Foreman') && (
              <div className="flex gap-2 bg-slate-200 p-1.5 rounded-lg w-fit shadow-inner">
                <button onClick={() => setDashboardMode('bulanan')} className={`px-4 py-2 font-bold text-xs rounded-md transition-all ${dashboardMode === 'bulanan' ? 'bg-white text-emerald-800 shadow' : 'text-slate-600'}`}>Pencapaian Bulanan (Defisit)</button>
                <button onClick={() => setDashboardMode('tahunan')} className={`px-4 py-2 font-bold text-xs rounded-md transition-all ${dashboardMode === 'tahunan' ? 'bg-white text-emerald-800 shadow' : 'text-slate-600'}`}>Rekap Tahunan (Karyawan Terbaik)</button>
              </div>
            )}

            {/* A. VIEW MODE BULANAN (DENGAN FILTER LEVEL AKSES AREA) */}
            {dashboardMode === 'bulanan' && (
              <div className="grid grid-cols-1 gap-6">
                {getVisibleAreas().map(area => {
                  const defisitArea = getDefisitTarget().filter(d => d.area === area);
                  
                  // Jika yang login adalah Karyawan biasa, hanya tampilkan defisit namanya sendiri
                  const defisitFilteredByRole = currentUser.role !== 'Admin' && currentUser.role !== 'Foreman' 
                    ? defisitArea.filter(d => d.nama === currentUser.nama)
                    : defisitArea;

                  const searchKey = dashboardSearch[area] || '';
                  const finalDefisitList = defisitFilteredByRole.filter(d => d.nama.toLowerCase().includes(searchKey.toLowerCase()));

                  return (
                    <div key={area} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-4">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                          <TrendingDown className="text-red-500" size={20} /> {area}
                        </h3>
                        {(currentUser.role === 'Admin' || currentUser.role === 'Foreman') && (
                          <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                            <input type="text" placeholder={`Cari nama di ${area}...`} className="pl-8 pr-2 py-1 border rounded text-xs w-52 focus:ring-emerald-500"
                              value={searchKey} onChange={(e) => handleDashboardSearchChange(area, e.target.value)} />
                          </div>
                        )}
                      </div>

                      <div className="overflow-x-auto max-h-[300px] border rounded-lg shadow-inner">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-700 text-white sticky top-0">
                            <tr><th className="p-2.5">Nama Karyawan</th><th className="p-2.5">Indikator Kurang</th><th className="p-2.5 text-center bg-slate-600">Tercapai</th><th className="p-2.5 text-center bg-slate-600">Target</th><th className="p-2.5 text-center bg-red-600">Kekurangan</th></tr>
                          </thead>
                          <tbody>
                            {finalDefisitList.length === 0 ? (
                              <tr><td colSpan="5" className="p-6 text-center text-slate-500 font-bold bg-slate-50">🎉 Luar biasa! Target bulan ini sudah terpenuhi semua.</td></tr>
                            ) : (
                              finalDefisitList.map((item) => (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="p-2.5 font-bold text-slate-700">{item.nama}</td><td className="p-2.5 font-medium text-slate-600">{item.indikator}</td><td className="p-2.5 text-center">{item.tercapai}</td><td className="p-2.5 text-center">{item.target}</td><td className="p-2.5 text-center font-bold text-red-600 bg-red-50/40"> - {item.kurang}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* B. VIEW MODE TAHUNAN */}
            {dashboardMode === 'tahunan' && (currentUser.role === 'Admin' || currentUser.role === 'Foreman') && (
              <div className="space-y-6">
                {loadingYearly ? (
                  <div className="p-12 text-center bg-white rounded-xl border font-semibold text-slate-500">Mengkalkulasi Rata-rata Nilai 12 Bulan...</div>
                ) : (
                  <>
                    {/* Hanya tampilkan Juara Umum Global jika yang login adalah Admin */}
                    {yearlyRecapData.globalBest && currentUser.role === 'Admin' && (
                      <div className="bg-gradient-to-r from-amber-500 to-yellow-600 p-6 rounded-xl shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="bg-white/20 p-4 rounded-full shadow-inner"><Award size={48} className="text-yellow-200 animate-pulse"/></div>
                          <div>
                            <span className="bg-amber-800 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">KARYAWAN TERBAIK TAHUNAN (GLOBAL)</span>
                            <h3 className="text-2xl font-black mt-1 tracking-wide shadow-sm">{yearlyRecapData.globalBest.nama}</h3>
                            <p className="text-amber-100 text-xs mt-0.5">Penempatan: <b>{yearlyRecapData.globalBest.area}</b> | Jabatan: <b>{masterData.roles.find(r=>r.id===selectedRoleContext)?.name}</b></p>
                          </div>
                        </div>
                        <div className="bg-white/10 px-5 py-3 rounded-xl border border-white/20 text-center shadow-inner">
                          <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider">Rata-rata Nilai Akhir</p>
                          <p className="text-3xl font-black mt-0.5">{yearlyRecapData.globalBest.averageScore.toFixed(1)}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {getVisibleAreas().map(area => {
                        const winner = yearlyRecapData.areaBest[area];
                        return (
                          <div key={area} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between gap-4">
                            <div className="flex items-center justify-between border-b pb-3">
                              <h4 className="font-bold text-slate-800 text-sm tracking-wide">{area}</h4>
                              <Medal size={20} className={winner ? "text-slate-400" : "text-slate-300"} />
                            </div>
                            {winner ? (
                              <div>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1"><UserCheck size={12}/> Juara 1 Area {selectedRoleContext}</p>
                                <p className="text-lg font-black text-slate-800 mt-0.5">{winner.nama}</p>
                                <p className="text-xs text-slate-500 font-bold mt-2 bg-slate-100 px-2 py-1 rounded w-fit">Rata-rata Skor: {winner.averageScore.toFixed(1)}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-4">Belum ada rekam capaian nilai tahunan di smelter ini.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB DATABASE KARYAWAN (HANYA ADMIN) --- */}
        {activeTab === 'database' && currentUser.role === 'Admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">
              <h2 className="text-lg font-bold mb-4 pb-2 border-b">Tambah Karyawan</h2>
              <form onSubmit={handleAddPersonnel} className="space-y-4">
                <div><label className="block text-sm text-slate-600 mb-1">Nama Lengkap</label><input type="text" required className="w-full border p-2 rounded focus:ring-emerald-500" value={newEmp.nama} onChange={e => setNewEmp({...newEmp, nama: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Smelter</label>
                    <select className="w-full border p-2 rounded focus:ring-emerald-500" value={newEmp.area} onChange={e => setNewEmp({...newEmp, area: e.target.value})}>
                      {masterData.areas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Jabatan / Role</label>
                    <select className="w-full border p-2 rounded focus:ring-emerald-500" value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})}>
                      {masterData.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">Kredensial Login User</span>
                  <div><label className="block text-xs font-bold text-slate-600 mb-1">ID Karyawan (Username)</label><input type="text" required placeholder="Contoh: SO-019" className="w-full border p-2 rounded text-sm bg-white font-mono" value={newEmp.idKaryawan} onChange={e => setNewEmp({...newEmp, idKaryawan: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-slate-600 mb-1">Password</label><input type="text" required placeholder="Contoh: 4 Angka Akhir ID" className="w-full border p-2 rounded text-sm bg-white" value={newEmp.password} onChange={e => setNewEmp({...newEmp, password: e.target.value})} /></div>
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
                  <thead className="bg-slate-100 sticky top-0 z-10"><tr className="shadow-sm"><th className="p-3">Nama</th><th className="p-3 text-center">Smelter</th><th className="p-3 text-center">Role</th><th className="p-3 text-center">Kredensial Login</th><th className="p-3 text-center">Aksi</th></tr></thead>
                  <tbody>
                    {searchResult.length === 0 ? (
                      <tr><td colSpan="5" className="text-center p-10 text-slate-500 border border-dashed bg-slate-50">Karyawan tidak ditemukan.</td></tr>
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
                              <td className="p-2 flex flex-col gap-1">
                                <input type="text" placeholder="Username" className="border p-1 text-xs rounded font-mono" value={editFormData.idKaryawan} onChange={(e) => setEditFormData({...editFormData, idKaryawan: e.target.value})} />
                                <input type="text" placeholder="Password" className="border p-1 text-xs rounded" value={editFormData.password} onChange={(e) => setEditFormData({...editFormData, password: e.target.value})} />
                              </td>
                              <td className="p-2 text-center space-x-2 whitespace-nowrap"><button onClick={handleSaveEdit} className="text-white bg-emerald-600 px-3 py-1.5 rounded font-bold text-xs shadow">Simpan</button><button onClick={() => setEditingId(null)} className="bg-slate-200 px-3 py-1.5 rounded font-bold text-xs">Batal</button></td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-medium text-slate-700">{p.nama}</td>
                              <td className="p-3 text-center font-bold text-slate-500">
                                {p.area} {isAreaUnknown && <span className="text-red-500 text-xs block mt-1">(Perlu Diupdate)</span>}
                              </td>
                              <td className="p-3 text-center"><span className="px-3 py-1 bg-slate-200 rounded-full text-xs font-bold">{masterData.roles.find(r=>r.id===p.role)?.name || p.role}</span></td>
                              <td className="p-3 text-center text-xs font-mono text-slate-500">
                                 ID: <b className="text-slate-700">{p.idKaryawan || '-'}</b> <br/> PW: <span className="text-slate-700">{p.password || '-'}</span>
                              </td>
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

        {/* --- TAB INPUT NILAI KINERJA (HANYA ADMIN) --- */}
        {activeTab === 'input' && currentUser.role === 'Admin' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-50 p-6 rounded-lg border h-fit">
                  <h2 className="font-bold text-lg mb-4 border-b pb-2">Paste Data Excel Gabungan</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <select className="border p-2 w-full rounded focus:ring-emerald-500" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>{weeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
                    <select className="border p-2 w-full rounded focus:ring-emerald-500" value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>
                      {getAllUniqueCategories().map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded p-3 text-xs mb-3">
                     💡 <b>Auto-Detect Global:</b> Cukup paste barisan <b>NAMA KARYAWAN</b> dari excel tanpa memisahkan SO atau WFSO. Aplikasi otomatis melacak jabatannya dan menghitung akumulasi frekuensinya.
                  </div>
                  <textarea className="w-full border p-3 h-48 rounded text-sm font-mono focus:ring-emerald-500" placeholder="Paste data daftar NAMA saja dari Excel..." value={pasteText} onChange={(e) => setPasteText(e.target.value)}></textarea>
                  <button onClick={handleProcessPaste} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 mt-4 rounded shadow">Proses & Akumulasikan Data</button>
                </div>
                <div>
                  <h2 className="font-bold text-lg mb-4">Preview Capaian Semelter ({masterData.roles.find(r=>r.id===selectedRoleContext)?.name})</h2>
                  {getVisibleAreas().map(area => {
                    const areaPersonnel = getVisiblePersonnel(area);
                    if (areaPersonnel.length === 0) return null;

                    return (
                      <div key={area} className="mb-4">
                        <div className="px-3 py-1.5 rounded-t-lg font-bold text-sm bg-slate-200 text-slate-700">{area}</div>
                        <div className="overflow-x-auto border border-t-0 rounded-b-lg">
                          <table className="w-full text-xs"><thead className="bg-slate-50 border-b"><tr><th className="p-2 text-left">Nama</th>{getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-2 text-center">{c.label}</th>)}</tr></thead>
                            <tbody>{areaPersonnel.map(p => {
                              const wData = weeklyData[p.id]?.[selectedWeek] || {};
                              return (
                                <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50">
                                  <td className="p-2 font-medium">{p.nama}</td>
                                  {getActiveCategories(selectedRoleContext).map(c => (
                                    <td key={c.key} className="p-2 text-center text-slate-600 font-bold">{wData[c.key] !== undefined ? wData[c.key] : 0}</td>
                                  ))}
                                </tr>
                              )
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
             </div>
          </div>
        )}

        {/* --- TAB REKAP LAPORAN FINAL (DENGAN SECURITY FILTER TINGGI) --- */}
        {activeTab === 'laporan' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="mb-6 pb-4 border-b border-slate-200"><h2 className="font-bold text-2xl">Laporan Rekap Keseluruhan KPI</h2></div>
             
             {getVisibleAreas().map(area => {
                const areaPersonnel = getVisiblePersonnel(area);
                if (areaPersonnel.length === 0) return null;
                
                return (
                  <div key={area} className="mb-10 overflow-x-auto shadow-sm rounded-lg">
                    <div className="flex justify-between items-center text-white px-4 py-3 rounded-t-lg bg-slate-800">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Table size={18} className="text-emerald-400" /> {area}</h3>
                      <button onClick={() => exportToExcel(area, areaPersonnel)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 shadow"><Download size={14} /> Export Excel</button>
                    </div>
                    <table className="w-full text-xs border-collapse whitespace-nowrap border-x border-b border-slate-300">
                      <thead className="bg-slate-700 text-white">
                        <tr>
                          <th className="p-3 text-left">Area</th><th className="p-3 text-center">Nama</th>
                          {getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-3 border-l border-slate-600 text-center">{c.label}</th>)}
                          <th className="p-3 bg-emerald-800 border-l border-emerald-700 text-center">Kepatuhan</th><th className="p-3 bg-slate-600 text-center">Pelanggaran</th><th className="p-3 bg-slate-600 border-l border-slate-500 text-center">Skor Awal</th><th className="p-3 bg-slate-600 text-center">Tambahan Poin</th><th className="p-3 bg-slate-600 text-center">Penalti Kepatuhan</th><th className="p-3 bg-emerald-700 border-l border-emerald-600 text-center">Skor Akhir</th><th className="p-3 bg-emerald-600 border-l border-emerald-500 text-center">Nilai</th><th className="p-3 bg-emerald-800 text-center">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaPersonnel.map(p => {
                          const acc = getAccumulatedData(p.id, p.role);
                          const um = monthlyData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' };
                          const calc = calculateScore(acc, um, p.role);

                          return (
                            <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="p-3 text-center font-bold text-slate-500 bg-slate-50/50">{p.area}</td><td className="p-3 font-bold text-slate-700">{p.nama}</td>
                              {getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-3 text-center border-l border-slate-200 font-medium">{acc[c.key]||0}</td>)}
                              
                              {/* Opsi edit bulanan hanya terbuka lebar untuk Admin saja */}
                              <td className="p-2 text-center border-l border-slate-200 bg-emerald-50/30">
                                <select disabled={currentUser.role !== 'Admin'} className="border p-1.5 rounded w-16 focus:ring-emerald-500 text-center bg-white" value={um.kepatuhan || 75} onChange={e=>handleMonthlyInput(p.id, 'kepatuhan', e.target.value)}><option value="25">25</option><option value="50">50</option><option value="75">75</option></select>
                              </td>
                              <td className="p-2 text-center bg-red-50/30 border-l border-slate-200">
                                <input type="number" disabled={currentUser.role !== 'Admin'} className="w-14 border p-1 rounded text-center focus:ring-red-500 bg-white" value={um.pelanggaran || 0} onChange={e=>handleMonthlyInput(p.id, 'pelanggaran', e.target.value)}/>
                              </td>
                              
                              <td className="p-3 text-center border-l border-slate-200 bg-slate-50 font-bold">{calc.sAwal.toFixed(1)}</td>
                              <td className="p-3 text-center bg-slate-50 font-bold text-emerald-600">{calc.tPoin}</td>
                              <td className="p-3 text-center text-red-600 font-bold bg-red-50/30">{calc.penalti}</td>
                              <td className="p-3 text-center font-bold text-lg text-emerald-800 bg-emerald-100/50 border-l border-emerald-200">{calc.sAkhir.toFixed(1)}</td>
                              <td className="p-3 text-center border-l border-emerald-200 bg-emerald-50/50"><span className={`px-3 py-1.5 rounded text-white font-black tracking-wider ${calc.grade==='A'?'bg-green-500':calc.grade==='B'?'bg-lime-500':calc.grade==='C'?'bg-yellow-500':'bg-red-500'}`}>{calc.grade}</span></td>
                              
                              <td className="p-2 bg-emerald-50/30">
                                <input type="text" disabled={currentUser.role !== 'Admin'} className="w-24 border p-1.5 text-xs rounded focus:ring-emerald-500 bg-white" placeholder="Cuti/Ijin" value={um.keterangan || ''} onChange={e=>handleMonthlyInput(p.id, 'keterangan', e.target.value)}/>
                              </td>
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

        {/* --- TAB PENGATURAN (ONLY ADMIN) --- */}
        {activeTab === 'pengaturan' && currentUser.role === 'Admin' && (
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 text-slate-200">
            <h2 className="font-bold text-2xl mb-2 text-white flex items-center gap-2"><Settings /> Pengaturan Sistem (Master Data)</h2>
            <p className="text-sm text-slate-400 mb-8 border-b border-slate-700 pb-4">Setiap perubahan di sini akan otomatis mengubah seluruh struktur tabel, form, dan rumus penilaian di aplikasi secara instan.</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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

              <div className="bg-slate-900 p-5 rounded-lg border border-slate-700 lg:col-span-2">
                <h3 className="font-bold text-white mb-4">Manajemen Indikator & Target Utama</h3>
                <div className="grid grid-cols-1 gap-6 mb-8">
                  {masterData.roles.filter(r => r.id === 'SO' || r.id === 'WFSO').map(r => (
                    <div key={r.id} className="bg-slate-800 p-4 rounded border border-slate-600">
                      <h4 className="font-bold text-emerald-400 mb-4 border-b border-slate-700 pb-2">
                        <span>Indikator {r.name}</span>
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm mb-4">
                          <thead><tr className="text-slate-400 border-b border-slate-700"><th className="pb-2">Nama Indikator</th><th className="pb-2 text-center">Tipe Aturan</th><th className="pb-2 text-center">Target (Angka)</th><th className="pb-2 text-center">Aksi</th></tr></thead>
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

                <div className="bg-slate-800 p-4 rounded border border-emerald-700/50 shadow-inner">
                  <h4 className="font-bold text-white mb-3 text-sm flex items-center gap-2"><Plus size={16} className="text-emerald-400"/> Tambah Indikator Lapangan Baru</h4>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[150px]"><label className="block text-xs text-slate-400 mb-1">Pilih Jabatan</label>
                      <select className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white text-sm" value={newCatRole} onChange={e=>setNewCatRole(e.target.value)}>
                        {masterData.roles.filter(r => r.id === 'SO' || r.id === 'WFSO').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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

      {/* COMPONENT MODAL CUSTOM (NOTIFTYPO TYPO NAMA EXCEL) */}
      {pasteErrors.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/75 flex items-center justify-center z-[110] p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600 border-b pb-2">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold">Nama Tidak Terdaftar!</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Beberapa nama dari excel di bawah ini <b>gagal diinput</b> karena tidak ditemukan atau salah ketik (*typo*). Pastikan ejaan nama sama persis dengan menu Karyawan:
            </p>
            <div className="bg-slate-100 p-3 rounded border border-slate-200 max-h-48 overflow-y-auto mb-6">
              <ul className="list-disc pl-5 text-xs text-slate-700 font-mono space-y-1">
                {pasteErrors.map((name, i) => <li key={i} className="capitalize">{name}</li>)}
              </ul>
            </div>
            <button onClick={() => setPasteErrors([])} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-lg shadow text-sm transition-colors">
              Tutup & Evaluasi Nama
            </button>
          </div>
        </div>
      )}

      {/* COMPONENT MODAL CUSTOM (HAPUS KARYAWAN) */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-slate-900/75 flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 transform transition-all border border-slate-200">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 p-3 rounded-full mb-4"><AlertTriangle size={32} className="text-red-600" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Karyawan?</h3>
              <p className="text-slate-600 mb-6 text-sm">Apakah Anda yakin ingin menghapus <b>{deleteModal.nama}</b>?</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteModal({ show: false, id: null, nama: '' })} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 transition-colors font-bold rounded-lg text-slate-700 text-sm">Batal</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 transition-colors text-white font-bold rounded-lg text-sm shadow-md">Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

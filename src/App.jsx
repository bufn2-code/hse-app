/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { 
  Database, ClipboardPaste, CheckCircle, Table, Trash2, Edit, AlertTriangle, 
  Download, Search, LayoutDashboard, Calendar, TrendingDown, Settings, 
  Plus, XCircle, Award, Medal, UserCheck, Lock, User, LogOut, Smartphone, Shield, Clock
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

// =====================================================
// MASTER DATA DEFAULT
// =====================================================
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
      { key: 'ps', py: 'Pelatihan Safety (Internal)', target: 0, isTargeted: false }
    ],
    Foreman: [],
    Admin: []
  },
  lastDataUpdate: '' 
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

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isIOSDevice = userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod');

  // =====================================================
  // STATE UTAMA
  // =====================================================
  const [currentUser, setCurrentUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ idKaryawan: '', password: '' });
  const [isCheckingSession, setIsCheckingSession] = useState(true); 
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardMode, setDashboardMode] = useState('bulanan'); 
  const [activeSettingTab, setActiveSettingTab] = useState('akun'); 
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentMonth());
  const [user, setUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

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
  
  const [newEmp, setNewEmp] = useState({ nama: '', area: '', role: '' });
  const [selectedRoleContext, setSelectedRoleContext] = useState('SO');
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [selectedIndicator, setSelectedIndicator] = useState('obs');
  const [pasteText, setPasteText] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ nama: '', area: '', role: '' });
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nama: '' });
  const [pasteErrors, setPasteErrors] = useState([]);
  
  const [credSearchQuery, setCredSearchQuery] = useState('');
  const [editingCredId, setEditingCredId] = useState(null);
  const [credFormData, setCredFormData] = useState({ idKaryawan: '', password: '' });

  const [newArea, setNewArea] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatTarget, setNewCatTarget] = useState(0);
  const [newCatType, setNewCatType] = useState('target'); 
  const [newCatRole, setNewCatRole] = useState('SO');

  const [yearlyRecapData, setYearlyRecapData] = useState({ globalBest: null, areaBest: {} });
  const [loadingYearly, setLoadingYearly] = useState(false);

  const getAppId = () => typeof __app_id !== 'undefined' ? __app_id : 'bufn2-kpi-app';
  const safeAreas = masterData?.areas && masterData.areas.length > 0 ? masterData.areas : defaultSettings.areas;
  const safeRoles = masterData?.roles && masterData.roles.length > 0 ? masterData.roles : defaultSettings.roles;
  const getActiveCategories = (roleId) => (masterData?.categories && masterData.categories[roleId]) || [];

  const getAllUniqueCategories = () => {
    const allCats = [];
    safeRoles.forEach(r => {
      getActiveCategories(r.id).forEach(c => {
        if (!allCats.find(existing => existing.key === c.key)) allCats.push(c);
      });
    });
    return allCats;
  };

  const weeks = [
    { id: 'w1', label: 'Minggu 1' }, { id: 'w2', label: 'Minggu 2' },
    { id: 'w3', label: 'Minggu 3' }, { id: 'w4', label: 'Minggu 4' }, { id: 'w5', label: 'Minggu 5' }
  ];

  // =====================================================
  // HELPER: PENCATAT WAKTU SINKRONISASI DATA (TIMESTAMP)
  // =====================================================
  const updateLastModified = async () => {
    try {
      const now = new Date();
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const day = now.getDate();
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      const timestampString = `${day} ${month} ${year} - Pukul ${hours}:${minutes} WITA`;
      
      setMasterData(prev => ({ ...prev, lastDataUpdate: timestampString }));
      await setDoc(doc(db, 'artifacts', getAppId(), 'settings', 'master'), { lastDataUpdate: timestampString }, { merge: true });
    } catch (error) {
      console.error("Gagal update timestamp:", error);
    }
  };

  // =====================================================
  // INTERSEPTOR NAVIGATION BACK BUTTON HP
  // =====================================================
  useEffect(() => {
    window.history.pushState({ trap: true }, '');
    const handlePopState = (e) => {
      e.preventDefault();
      setShowExitModal(true); 
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const cancelExitApp = () => {
    setShowExitModal(false);
    window.history.pushState({ trap: true }, '');
  };

  const confirmExitApp = () => {
    setShowExitModal(false);
    window.close();
    setTimeout(() => { window.history.back(); }, 100);
  };

  // =====================================================
  // POPUP MANIFEST PWA PROMPT LISTENER
  // =====================================================
  useEffect(() => {
    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPopup(true); 
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    
    const hasSeenPopup = localStorage.getItem('bufn2_install_prompt');
    if (!hasSeenPopup) {
      setTimeout(() => setShowInstallPopup(true), 3000);
    }
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const triggerNativeInstall = async () => {
    if (!deferredPrompt) {
      showToast("Gunakan browser Chrome/Safari, lalu pilih 'Tambahkan ke Layar Utama'", "error");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast("Aplikasi berhasil diinstal ke HP Anda!");
      localStorage.setItem('bufn2_install_prompt', 'done');
    }
    setDeferredPrompt(null);
    setShowInstallPopup(false);
  };

  // =====================================================
  // INITIAL MOUNT: RESTORE LOGIN SESSION INSTAN (ANTI-REFRESH)
  // =====================================================
  useEffect(() => {
    // 1. Cek Sesi Penyimpanan Lokal Perangkat Detik Pertama
    const savedUser = localStorage.getItem('bufn2_user_session');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('bufn2_user_session');
      }
    }
    setIsCheckingSession(false);

    // 2. Buat koneksi Firebase Cloud di Background
    const unsubAuth = onAuthStateChanged(auth, async (userObj) => {
      if (!userObj) {
        try { await signInAnonymously(auth); } catch (e) { console.error(e); }
      }
    });

    const appId = getAppId();
    const unsubs = [];

    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'settings', 'master'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const validatedRoles = data.roles && data.roles.length > 0 ? data.roles : defaultSettings.roles;
        if (!validatedRoles.find(r => r.id === 'Admin')) validatedRoles.push({ id: 'Admin', name: 'Admin Sistem' });
        if (!validatedRoles.find(r => r.id === 'Foreman')) validatedRoles.push({ id: 'Foreman', name: 'Foreman' });

        const safeData = {
          areas: data.areas && data.areas.length > 0 ? data.areas : defaultSettings.areas,
          roles: validatedRoles,
          categories: data.categories || defaultSettings.categories,
          lastDataUpdate: data.lastDataUpdate || '' 
        };
        setMasterData(safeData);
      } else {
        setDoc(doc(db, 'artifacts', appId, 'settings', 'master'), defaultSettings);
      }
      setIsDbReady(true);
    }, () => { setIsDbReady(true); });
    unsubs.push(unsubSettings);

    const unsubPersonnel = onSnapshot(collection(db, 'artifacts', appId, 'personnel'), (s) => { 
      const d = []; s.forEach(doc => { const data = doc.data(); if (data?.nama) d.push(data); }); setPersonnel(d); 
    });
    unsubs.push(unsubPersonnel);

    return () => { unsubAuth(); unsubs.forEach(u => u()); };
  }, []);

  useEffect(() => {
    const appId = getAppId();
    const unsubW = onSnapshot(collection(db, 'artifacts', appId, `weekly_${selectedPeriod}`), (s) => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data()); setWeeklyData(d);
    });
    const unsubM = onSnapshot(collection(db, 'artifacts', appId, `monthly_${selectedPeriod}`), (s) => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data()); setMonthlyData(d);
    });
    return () => { unsubW(); unsubM(); };
  }, [selectedPeriod]);

  // =====================================================
  // LOGIN SUBMIT EXECUTOR (SELALU SIMPAN SESI)
  // =====================================================
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const username = loginForm.idKaryawan.trim();
    const password = loginForm.password.trim();

    if (!username || !password) return showToast("Harap isi seluruh kolom!", "error");

    if (username.toLowerCase() === 'admin' && password === 'adminbufn2') {
      const adminData = { id: 'master-admin', nama: 'Super Admin HSE', role: 'Admin', area: 'All Smelters', idKaryawan: 'admin' };
      setCurrentUser(adminData);
      localStorage.setItem('bufn2_user_session', JSON.stringify(adminData)); // Simpan Sesi Permanen
      showToast("Selamat datang, Super Admin!");
      setActiveTab('dashboard');
      return;
    }

    const foundUser = personnel.find(p => p.idKaryawan && p.idKaryawan.trim() === username && p.password && p.password.trim() === password);
    if (foundUser) {
      setCurrentUser(foundUser);
      localStorage.setItem('bufn2_user_session', JSON.stringify(foundUser)); // Simpan Sesi Permanen
      showToast(`Selamat datang, ${foundUser.nama}!`);
      setActiveTab('dashboard');
    } else {
      showToast("ID Karyawan atau Password salah!", "error");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginForm({ idKaryawan: '', password: '' });
    localStorage.removeItem('bufn2_user_session'); // Bersihkan Sesi Perangkat
    showToast("Berhasil keluar.");
  };

  const handleTabClick = (tabName) => {
    window.location.hash = tabName;
    setActiveTab(tabName);
  };

  const scrollToView = (e) => {
    setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);
  };

  // =====================================================
  // OPERASIONAL CORE SYSTEM DATA CRUD
  // =====================================================
  const saveMasterData = async (newData) => {
    try { 
      await setDoc(doc(db, 'artifacts', getAppId(), 'settings', 'master'), newData); 
      await updateLastModified();
      showToast("Master data disimpan!"); 
    } catch (error) { showToast("Gagal: " + error.message, "error"); }
  };
  const handleAddArea = () => {
    if(!newArea.trim()) return;
    const formattedArea = newArea.trim().replace(/\b\w/g, l => l.toUpperCase());
    if(safeAreas.includes(formattedArea)) return showToast("Smelter sudah terdaftar!", "error");
    saveMasterData({ ...masterData, areas: [...safeAreas, formattedArea] });
    setNewArea('');
  };
  const handleDeleteArea = (areaTarget) => {
    if(confirm(`Hapus ${areaTarget}?`)) { saveMasterData({ ...masterData, areas: safeAreas.filter(a => a !== areaTarget) }); }
  };
  const handleUpdateCategory = (roleId, catIndex, field, value) => {
    const updatedCategories = { ...masterData.categories };
    if (field === 'target') updatedCategories[roleId][catIndex].target = Number(value);
    if (field === 'label') updatedCategories[roleId][catIndex].label = value;
    if (field === 'isTargeted') { updatedCategories[roleId][catIndex].isTargeted = value; if (!value) updatedCategories[roleId][catIndex].target = 0; }
    saveMasterData({ ...masterData, categories: updatedCategories });
  };
  const handleDeleteCategory = (roleId, catIndex) => {
    const updatedCategories = { ...masterData.categories };
    updatedCategories[roleId].splice(catIndex, 1); saveMasterData({ ...masterData, categories: updatedCategories });
  };
  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return showToast("Nama kriteria wajib diisi!", "error");
    const updatedCategories = { ...masterData.categories }; const newKey = 'cat_' + Date.now();
    if (!updatedCategories[newCatRole]) updatedCategories[newCatRole] = [];
    updatedCategories[newCatRole].push({ key: newKey, label: newCatLabel, target: newCatType === 'target' ? Number(newCatTarget) : 0, isTargeted: newCatType === 'target' });
    saveMasterData({ ...masterData, categories: updatedCategories }); setNewCatLabel(''); setNewCatTarget(0);
  };

  const handleAddPersonnel = async (e) => {
    e.preventDefault(); if (!newEmp.nama.trim()) return showToast("Nama karyawan wajib diisi!", "error");
    try {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      await setDoc(doc(db, 'artifacts', getAppId(), 'personnel', newId), { id: newId, nama: newEmp.nama, area: newEmp.area, role: newEmp.role, idKaryawan: '', password: '' });
      await updateLastModified(); // Catat Waktu Pendaftaran Karyawan Baru
      setNewEmp({ nama: '', area: safeAreas[0] || '', role: safeRoles[0]?.id || '' }); 
      showToast("Karyawan baru terdaftar!");
    } catch (error) { showToast("Gagal: " + error.message, "error"); }
  };

  const handleEditClick = (emp) => {
    setEditingId(emp.id);
    setEditFormData({ nama: emp.nama || '', area: emp.area || '', role: emp.role || '' });
  };

  const handleSaveEdit = async () => {
    if (!editFormData.nama.trim()) return;
    try { 
      await setDoc(doc(db, 'artifacts', getAppId(), 'personnel', editingId), { nama: editFormData.nama, area: editFormData.area, role: editFormData.role }, { merge: true }); 
      await updateLastModified(); // Catat Waktu Edit Profil Karyawan
      setEditingId(null); 
      showToast("Profil diubah!"); 
    } catch (error) { showToast("Gagal: " + error.message, "error"); }
  };

  const confirmDelete = async () => {
    try { 
      await deleteDoc(doc(db, 'artifacts', getAppId(), 'personnel', deleteModal.id)); 
      await updateLastModified(); // Catat Waktu Penghapusan Karyawan
      setDeleteModal({ show: false, id: null, nama: '' }); 
      showToast("Data dihapus!"); 
    } catch (error) { showToast("Gagal: " + error.message, "error"); }
  };

  const handleProcessPaste = async () => {
    if (!pasteText.trim()) return showToast('Teks paste kosong!', 'error');
    const lines = pasteText.split('\n'); const counts = {}; let lineTotal = 0;
    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim()).filter(p => p !== ''); if (parts.length < 1) return;
      const namaPaste = parts[0].toLowerCase(); counts[namaPaste] = (counts[namaPaste] || 0) + 1; lineTotal++;
    });
    const updates = {}; let matchedCount = 0; let notFoundNames = [];
    Object.keys(counts).forEach(namaKey => {
      const emp = personnel.find(p => p.nama.toLowerCase() === namaKey);
      if (emp) {
        if (!updates[emp.id]) updates[emp.id] = {}; if (!updates[emp.id][selectedWeek]) updates[emp.id][selectedWeek] = {};
        const oldVal = weeklyData[emp.id]?.[selectedWeek]?.[selectedIndicator] || 0;
        updates[emp.id][selectedWeek][selectedIndicator] = oldVal + counts[namaKey]; matchedCount++;
      } else { notFoundNames.push(namaKey); }
    });
    try {
      for (const empId of Object.keys(updates)) { await setDoc(doc(db, 'artifacts', getAppId(), `weekly_${selectedPeriod}`, empId), updates[empId], { merge: true }); }
      await updateLastModified(); // Catat Waktu Input Excel Berhasil
      setPasteText(''); showToast(`Berhasil merekap ${lineTotal} data!`);
      if(notFoundNames.length > 0) setPasteErrors(Array.from(new Set(notFoundNames)));
    } catch (error) { showToast("Gagal: " + error.message, "error"); }
  };

  const handleMonthlyInput = async (empId, field, value) => {
    try { 
      await setDoc(doc(db, 'artifacts', getAppId(), `monthly_${selectedPeriod}`, empId), { [field]: value }, { merge: true }); 
      await updateLastModified(); // Catat Waktu Perubahan Dropdown Bulanan
    } catch (error) { console.error(error); }
  };

  // ENGINE MATEMATIKA KPI RUMUS STRUKTUR
  const getAccumulatedData = (empId, role) => {
    const empData = weeklyData[empId] || {}; const total = {};
    getActiveCategories(role).forEach(c => total[c.key] = 0);
    Object.values(empData).forEach(weekData => { getActiveCategories(role).forEach(c => { total[c.key] += (weekData[c.key] || 0); }); });
    return total;
  };

  const calculateScore = (acc, um, roleId) => {
    const cats = getActiveCategories(roleId);
    const targetedCats = cats.filter(c => c.isTargeted);
    const untargetedCats = cats.filter(c => !c.isTargeted);
    const weightPerCat = targetedCats.length > 0 ? (100 / targetedCats.length) : 0; 
    let sAwal = targetedCats.length > 0 ? 100 : 0;
    targetedCats.forEach(c => { const val = acc[c.key] || 0; if (val < c.target) { sAwal -= (((c.target - val) / c.target) * weightPerCat); } });
    if(sAwal < 0) sAwal = 0; 

    let tPoin = Number(um.kepatuhan) || 75; untargetedCats.forEach(c => { tPoin += (acc[c.key] || 0) }); 
    const penalti = (Number(um.pelanggaran) || 0) * -5; const sAkhir = sAwal + tPoin + penalti;
    
    let grade = 'D'; const isAwalSempurna = Math.abs(sAwal - 100) < 0.1; 
    const ket = (um.keterangan || "").toLowerCase(); const hasIjin = ket.includes("ijin") || ket.includes("cuti");

    if (isAwalSempurna) { if (sAkhir >= 170) grade = 'A'; else if (sAkhir >= 141) grade = 'B'; else if (sAkhir >= 100) grade = 'C'; } 
    else if (hasIjin) { grade = 'C'; }
    return { sAwal, tPoin, penalti, sAkhir, grade };
  };

  const calculateYearlyBest = async () => {
    setLoadingYearly(true); const year = selectedPeriod.split('-')[0]; const appId = getAppId(); const yearlyScores = {};
    try {
      for (let m = 1; m <= 12; m++) {
        const periodKey = `${year}-${String(m).padStart(2, '0')}`;
        const [wSnap, mSnap] = await Promise.all([ getDocs(collection(db, 'artifacts', appId, `weekly_${periodKey}`)), getDocs(collection(db, 'artifacts', appId, `monthly_${periodKey}`)) ]);
        const wData = {}; wSnap.forEach(doc => { wData[doc.id] = doc.data(); });
        const mData = {}; mSnap.forEach(doc => { mData[doc.id] = doc.data(); });

        personnel.filter(p => p.role === selectedRoleContext).forEach(p => {
          if (!yearlyScores[p.id]) yearlyScores[p.id] = { id: p.id, nama: p.nama, area: p.area, totalScore: 0, monthsActive: 0 };
          const empWeekly = wData[p.id] || {}; const totalWeeklyAcc = {};
          getActiveCategories(p.role).forEach(c => totalWeeklyAcc[c.key] = 0);
          Object.values(empWeekly).forEach(weekData => { getActiveCategories(p.role).forEach(c => { totalWeeklyAcc[c.key] += (weekData[c.key] || 0); }); });
          const calc = calculateScore(totalWeeklyAcc, mData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' }, p.role);
          yearlyScores[p.id].totalScore += calc.sAkhir; yearlyScores[p.id].monthsActive += 1; 
        });
      }
      const finalRank = Object.values(yearlyScores).map(p => ({ ...p, averageScore: p.monthsActive > 0 ? (p.totalScore / p.monthsActive) : 0 })).filter(p => p.averageScore > 0);
      finalRank.sort((a, b) => b.averageScore - a.averageScore);
      const areaBest = {}; safeAreas.forEach(area => { areaBest[area] = finalRank.filter(p => p.area === area)[0] || null; });
      setYearlyRecapData({ globalBest: finalRank[0] || null, areaBest });
    } catch (e) { console.error(e); } finally { setLoadingYearly(false); }
  };

  const getDefisitTarget = () => {
    let defisit = []; let targetPersonnel = personnel.filter(p => p.role === selectedRoleContext);
    if (!isManager) targetPersonnel = targetPersonnel.filter(p => p.id === currentUser.id);
    targetPersonnel.forEach(p => {
      const acc = getAccumulatedData(p.id, p.role);
      getActiveCategories(p.role).filter(c => c.isTargeted).forEach(c => {
        const tercapai = acc[c.key] || 0;
        if (tercapai < c.target) { defisit.push({ id: p.id + c.key, nama: p.nama, area: p.area, indikator: c.label, tercapai, target: c.target, kurang: c.target - tercapai }); }
      });
    });
    return defisit.sort((a, b) => b.kurang - a.kurang);
  };

  const getVisibleAreas = () => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return safeAreas;
    return [currentUser.area || '']; 
  };
  const getVisiblePersonnel = (area) => {
    if (!currentUser) return [];
    let list = personnel.filter(p => p.role === selectedRoleContext && p.area === area);
    if (!isManager) list = list.filter(p => p.id === currentUser.id); 
    return list;
  };
  
  const searchResult = personnel.filter(p => (p.nama || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const credSearchResult = personnel.filter(p => (p.nama || '').toLowerCase().includes(credSearchQuery.toLowerCase()));

  // =====================================================
  // RENDER INTERFACE STRUKTUR CONDITIONAL
  // =====================================================
  if (!currentUser) {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-950 flex flex-col p-4 md:p-6 overflow-y-auto relative">
        {toast.show && (
          <div className="fixed top-6 right-6 z-[200] bg-red-600 text-white p-4 rounded-xl shadow-2xl flex items-center gap-2">
            <XCircle size={20}/> <span className="text-sm font-semibold">{toast.msg}</span>
          </div>
        )}
        
        {showInstallPopup && (
          <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-4 rounded-2xl shadow-2xl z-[150] border border-emerald-700 animate-in slide-in-from-top duration-500">
            <div className="flex gap-4 items-start">
              <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-lg"><Smartphone size={24}/></div>
              <div className="flex-1">
                <h3 className="font-black text-sm tracking-wide text-emerald-300">Instal Aplikasi KPI HSE</h3>
                <p className="text-slate-300 text-xs mt-1 leading-relaxed">Akses lebih cepat dan lancar langsung dari layar beranda HP Anda.</p>
                {isIOSDevice ? (
                  <div className="mt-3 text-[11px] bg-black/40 text-emerald-300 p-2 rounded-lg border border-emerald-800/50">
                    👉 Tekan tombol <b>Share</b> lalu pilih <b>Add to Home Screen</b>.
                  </div>
                ) : (
                  <button onClick={triggerNativeInstall} className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md w-full">Instal Sekarang</button>
                )}
              </div>
              <button onClick={() => setShowInstallPopup(false)} className="text-slate-400 hover:text-white font-bold text-sm bg-slate-800 rounded-full w-6 h-6 flex items-center justify-center shrink-0">✕</button>
            </div>
          </div>
        )}

        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-700/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="m-auto bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-sm relative z-10 animate-in fade-in zoom-in duration-300 shrink-0">
          <div className="text-center mb-6">
            <div className="bg-emerald-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <CheckCircle size={36} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase">KPI HSE Portal</h2>
            <p className="text-slate-500 text-xs mt-1">Sistem Evaluasi BUFN 2</p>
          </div>
          
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">ID Karyawan</label>
              <div className="relative mt-1">
                <User size={18} className="absolute left-4 top-3.5 text-slate-500" />
                <input type="text" placeholder="Contoh: SO-001" className="w-full bg-slate-800 border border-slate-700 p-3 pl-11 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all font-mono text-sm shadow-inner" value={loginForm.idKaryawan} onChange={e => setLoginForm({...loginForm, idKaryawan: e.target.value})} onFocus={scrollToView} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">Password</label>
              <div className="relative mt-1">
                <Lock size={18} className="absolute left-4 top-3.5 text-slate-500" />
                <input type="password" placeholder="••••••••" className="w-full bg-slate-800 border border-slate-700 p-3 pl-11 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all text-sm shadow-inner" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} onFocus={scrollToView} />
              </div>
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-emerald-900/40 tracking-widest text-sm mt-4">MASUK SISTEM</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-800 font-sans pb-12 relative overflow-hidden">
      {showExitModal && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full p-6 text-center border border-slate-200">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100"><LogOut size={28} className="text-red-500" /></div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Keluar Aplikasi?</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">Apakah Anda yakin ingin keluar dari Portal KPI HSE BUFN 2?</p>
            <div className="flex gap-3 w-full">
              <button onClick={cancelExitApp} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700 text-sm">Batal</button>
              <button onClick={confirmExitApp} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-md">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-emerald-800 text-white p-5 shadow-lg relative z-10 border-b border-emerald-900/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CheckCircle size={36} className="text-emerald-300 drop-shadow-md" />
            <div>
              <h1 className="text-2xl font-black tracking-wide">KPI HSE BUFN 2</h1>
              <p className="text-emerald-200 text-xs mt-0.5">User: <b className="uppercase">{currentUser.nama}</b> ({safeRoles.find(r=>r.id===currentUser.role)?.name || currentUser.role})</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-emerald-900/80 px-4 py-2.5 md:py-2 rounded-xl border border-emerald-700 flex items-center gap-2 shadow-inner w-full md:w-auto justify-between">
              <Calendar size={16} className="text-emerald-300"/><input type="month" className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer outline-none w-[110px] [color-scheme:dark]" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} />
            </div>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 text-white p-2.5 md:px-4 md:py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md"><LogOut size={16}/><span className="hidden md:inline">Keluar</span></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-6 px-4">
        <div className="flex overflow-x-auto whitespace-nowrap space-x-2 border-b border-slate-200 mb-6 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <button onClick={() => handleTabClick('dashboard')} className={`px-4 py-2.5 font-bold rounded-xl transition-all text-sm ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><LayoutDashboard size={16}/> Dashboard</button>
          {currentUser.role === 'Admin' && (
            <>
              <button onClick={() => handleTabClick('database')} className={`px-4 py-2.5 font-bold rounded-xl transition-all text-sm ${activeTab === 'database' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><Database size={16}/> Karyawan</button>
              <button onClick={() => handleTabClick('input')} className={`px-4 py-2.5 font-bold rounded-xl transition-all text-sm ${activeTab === 'input' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><ClipboardPaste size={16}/> Input Nilai</button>
            </>
          )}
          <button onClick={() => handleTabClick('laporan')} className={`px-4 py-2.5 font-bold rounded-xl transition-all text-sm ${activeTab === 'laporan' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}><Table size={16}/> Laporan</button>
          {currentUser.role === 'Admin' && (
            <button onClick={() => handleTabClick('pengaturan')} className={`px-4 py-2.5 font-bold rounded-xl transition-all text-sm ${activeTab === 'pengaturan' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}><Settings size={16}/> Pengaturan</button>
          )}
        </div>

        {/* --- TAB DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600"><Clock size={20}/></div>
              <div className="flex-1">
                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider mb-0.5">Status Sinkronisasi</p>
                <p className="text-sm md:text-base text-emerald-900 font-black">Last Update : {masterData.lastDataUpdate || 'Belum ada data'}</p>
              </div>
              {currentUser.role === 'Admin' && <button onClick={updateLastModified} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm border border-emerald-700">Update Waktu</button>}
            </div>

            {isManager && (
              <div className="flex gap-2 bg-slate-200 p-1.5 rounded-xl w-full md:w-fit shadow-inner">
                <button onClick={() => setDashboardMode('bulanan')} className={`flex-1 md:flex-none px-4 py-2 font-bold text-xs rounded-lg ${dashboardMode === 'bulanan' ? 'bg-white text-emerald-800 shadow' : 'text-slate-600'}`}>Pencapaian Bulanan</button>
                <button onClick={() => setDashboardMode('tahunan')} className={`flex-1 md:flex-none px-4 py-2 font-bold text-xs rounded-lg ${dashboardMode === 'tahunan' ? 'bg-white text-emerald-800 shadow' : 'text-slate-600'}`}>Karyawan Terbaik</button>
              </div>
            )}

            {dashboardMode === 'bulanan' && (
              <div className="grid grid-cols-1 gap-6">
                {getVisibleAreas().map(area => {
                  const finalDefisitList = getDefisitTarget().filter(d => d.area === area);
                  return (
                    <div key={area} className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200">
                      <h3 className="font-black text-lg text-slate-800 border-b pb-4 mb-4 flex items-center gap-2"><TrendingDown className="text-red-500" size={20} /> {area}</h3>
                      <div className="overflow-x-auto border rounded-2xl max-h-[300px]">
                        <table className="w-full text-xs text-left whitespace-nowrap">
                          <thead className="bg-slate-700 text-white sticky top-0"><tr><th className="p-3.5">Nama Karyawan</th><th className="p-3.5">Indikator Kurang</th><th className="p-3.5 text-center bg-slate-600">Tercapai</th><th className="p-3.5 text-center bg-slate-600">Target</th><th className="p-3.5 text-center bg-red-600">Kekurangan</th></tr></thead>
                          <tbody>
                            {finalDefisitList.length === 0 ? (<tr><td colSpan="5" className="p-10 text-center text-slate-500 font-bold bg-slate-50 border-dashed">🎉 Aman! Target bulan ini sudah terpenuhi semua.</td></tr>) : 
                            finalDefisitList.map(item => (<tr key={item.id} className="border-b hover:bg-slate-50"><td className="p-3.5 font-bold text-slate-700">{item.nama}</td><td className="p-3.5 font-medium text-slate-600">{item.indikator}</td><td className="p-3.5 text-center">{item.tercapai}</td><td className="p-3.5 text-center">{item.target}</td><td className="p-3.5 text-center font-black text-red-600 bg-red-50/40">- {item.kurang}</td></tr>))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- TAB DATABASE KARYAWAN (ADMIN ONLY) --- */}
        {activeTab === 'database' && currentUser.role === 'Admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-1">
              <h2 className="text-lg font-black mb-5 pb-3 border-b text-slate-800">Tambah Karyawan Baru</h2>
              <form onSubmit={handleAddPersonnel} className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Nama Lengkap</label><input type="text" required className="w-full border border-slate-300 p-3 rounded-xl outline-none text-sm" value={newEmp.nama} onChange={e => setNewEmp({...newEmp, nama: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Smelter</label><select className="w-full border border-slate-300 p-3 rounded-xl text-sm bg-white" value={newEmp.area} onChange={e => setNewEmp({...newEmp, area: e.target.value})}>{safeAreas.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Jabatan</label><select className="w-full border border-slate-300 p-3 rounded-xl text-sm bg-white" value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})}>{safeRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl text-sm mt-4 shadow-md">SIMPAN DATA</button>
              </form>
            </div>
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-2">
              <h2 className="text-lg font-black mb-5 text-slate-800">Database Profil Global</h2>
              <div className="overflow-x-auto border rounded-2xl max-h-[500px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4 font-bold">Nama Karyawan</th><th className="p-4 text-center font-bold">Smelter</th><th className="p-4 text-center font-bold">Jabatan Aktif</th><th className="p-4 text-center font-bold">Aksi</th></tr></thead>
                  <tbody>
                    {searchResult.map(p => (
                      <tr key={p.id} className="border-b hover:bg-slate-50">
                        {editingId === p.id ? (
                          <>
                            <td className="p-2"><input type="text" className="border p-2 w-full text-sm rounded-lg" value={editFormData.nama} onChange={e => setEditFormData({...editFormData, nama: e.target.value})} /></td>
                            <td className="p-2 text-center"><select className="border p-2 text-sm rounded-lg bg-white" value={editFormData.area} onChange={e => setEditFormData({...editFormData, area: e.target.value})}>{safeAreas.map(a => <option key={a} value={a}>{a}</option>)}</select></td>
                            <td className="p-2 text-center"><select className="border p-2 text-sm rounded-lg bg-white" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})}>{safeRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                            <td className="p-2 text-center space-x-2"><button onClick={handleSaveEdit} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Simpan</button><button onClick={() => setEditingId(null)} className="bg-slate-200 px-4 py-2 rounded-lg text-xs">Batal</button></td>
                          </>
                        ) : (
                          <>
                            <td className="p-4 font-bold text-slate-700">{p.nama}</td>
                            <td className="p-4 text-center text-slate-500 font-bold">{p.area}</td>
                            <td className="p-4 text-center"><span className="px-3 py-1 bg-slate-200 rounded-lg text-xs font-bold text-slate-600">{safeRoles.find(r=>r.id===p.role)?.name || p.role}</span></td>
                            <td className="p-4 text-center space-x-3"><button onClick={() => handleEditClick(p)} className="text-blue-600 bg-blue-50 p-2 rounded-lg"><Edit size={16}/></button><button onClick={() => setDeleteModal({ show: true, id: p.id, nama: p.nama })} className="text-red-600 bg-red-50 p-2 rounded-lg"><Trash2 size={16}/></button></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB INPUT NILAI KINERJA (ADMIN ONLY) --- */}
        {activeTab === 'input' && currentUser.role === 'Admin' && (
          <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-5 rounded-3xl border h-fit shadow-inner">
                  <h2 className="font-black text-lg mb-4 text-slate-800">Data Excel Generator</h2>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <select className="border p-3 w-full rounded-xl text-sm bg-white font-bold" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>{weeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
                    <select className="border p-3 w-full rounded-xl text-sm bg-white font-bold" value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>{getAllUniqueCategories().map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                  </div>
                  <textarea className="w-full border p-4 h-48 rounded-xl text-sm font-mono shadow-inner outline-none" placeholder="Paste data kolom NAMA di sini..." value={pasteText} onChange={(e) => setPasteText(e.target.value)}></textarea>
                  <button onClick={handleProcessPaste} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 mt-4 rounded-xl text-sm shadow-md">PROSES DATA</button>
                </div>
                <div>
                  <h2 className="font-black text-lg mb-5 text-slate-800 border-b pb-3">Tinjauan Capaian Semelter ({safeRoles.find(r=>r.id===selectedRoleContext)?.name})</h2>
                  {getVisibleAreas().map(area => {
                    const areaPersonnel = getVisiblePersonnel(area); if (areaPersonnel.length === 0) return null;
                    return (
                      <div key={area} className="mb-4">
                        <div className="px-4 py-2 rounded-t-xl font-bold text-sm bg-slate-700 text-white shadow-sm">{area}</div>
                        <div className="overflow-x-auto border rounded-b-xl bg-white max-h-[300px]">
                          <table className="w-full text-xs whitespace-nowrap"><thead className="bg-slate-100 border-b"><tr><th className="p-3 text-left">Nama Karyawan</th>{getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-3 text-center">{c.label}</th>)}</tr></thead>
                            <tbody>{areaPersonnel.map(p => {
                              const wData = weeklyData[p.id]?.[selectedWeek] || {};
                              return (<tr key={p.id} className="border-b hover:bg-slate-50"><td className="p-3 font-bold text-slate-700">{p.nama}</td>{getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-3 text-center text-emerald-700 font-black">{wData[c.key] !== undefined ? wData[c.key] : 0}</td>)}</tr>)
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

        {/* --- TAB REKAP LAPORAN FINAL --- */}
        {activeTab === 'laporan' && (
          <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-200">
             <div className="mb-6 pb-4 border-b flex justify-between items-center"><h2 className="font-black text-xl md:text-2xl text-slate-800">Laporan Akhir Kinerja (KPI)</h2></div>
             {getVisibleAreas().map(area => {
                const areaPersonnel = getVisiblePersonnel(area); if (areaPersonnel.length === 0) return null;
                return (
                  <div key={area} className="mb-10 overflow-x-auto shadow-md rounded-2xl border border-slate-300">
                    <div className="flex justify-between items-center text-white px-4 py-4 rounded-t-2xl bg-slate-800 border-b">
                      <h3 className="font-black text-sm md:text-base tracking-wide"><Table size={18} className="text-emerald-400" /> AREA {area.toUpperCase()}</h3>
                      <button onClick={() => exportToExcel(area, areaPersonnel)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"><Download size={14} /> Export Excel</button>
                    </div>
                    <table className="w-full text-xs border-collapse whitespace-nowrap bg-white">
                      <thead className="bg-slate-700 text-white">
                        <tr><th className="p-4 text-left">Nama</th>{getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-3 border-l border-slate-600 text-center">{c.label}</th>)}<th className="p-3 bg-emerald-900/80 border-l border-emerald-700 text-center">Kepatuhan</th><th className="p-3 bg-slate-800 border-l border-slate-700 text-center">Pelanggaran</th><th className="p-3 bg-slate-800 border-l border-slate-700 text-center">Skor Awal</th><th className="p-3 bg-slate-800 text-center">Extra Poin</th><th className="p-3 bg-slate-800 text-center">Penalti</th><th className="p-3 bg-emerald-800 border-l border-emerald-700 text-center font-bold">SKOR AKHIR</th><th className="p-3 bg-emerald-700 border-l border-emerald-600 text-center font-bold">NILAI KASTA</th><th className="p-3 bg-slate-800 text-center border-l border-slate-700">Catatan</th></tr>
                      </thead>
                      <tbody>
                        {areaPersonnel.map(p => {
                          const acc = getAccumulatedData(p.id, p.role); const um = monthlyData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' }; const calc = calculateScore(acc, um, p.role);
                          return (
                            <tr key={p.id} className="border-b hover:bg-slate-50 transition-colors">
                              <td className="p-4"><span className="font-bold text-slate-800 text-sm block mb-1">{p.nama}</span></td>
                              {getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-3 text-center border-l font-bold text-slate-600">{acc[c.key]||0}</td>)}
                              <td className="p-2 text-center border-l bg-emerald-50/50"><select disabled={currentUser.role !== 'Admin'} className="border p-1.5 rounded-lg w-16 bg-white font-black text-emerald-800" value={um.kepatuhan || 75} onChange={e=>handleMonthlyInput(p.id, 'kepatuhan', e.target.value)}><option value="25">25</option><option value="50">50</option><option value="75">75</option></select></td>
                              <td className="p-2 text-center bg-red-50/50 border-l"><input type="number" disabled={currentUser.role !== 'Admin'} className="w-16 border p-1.5 rounded-lg text-center bg-white font-black text-red-800" value={um.pelanggaran || 0} onChange={e=>handleMonthlyInput(p.id, 'pelanggaran', e.target.value)}/></td>
                              <td className="p-3 text-center border-l bg-slate-50 font-bold">{calc.sAwal.toFixed(1)}</td><td className="p-3 text-center bg-slate-50 font-black text-emerald-600">+{calc.tPoin}</td><td className="p-3 text-center font-black text-red-600 bg-red-50/30">{calc.penalti}</td><td className="p-3 text-center font-black text-lg text-emerald-900 bg-emerald-100/50 border-l">{calc.sAkhir.toFixed(1)}</td>
                              <td className="p-3 text-center border-l bg-emerald-50/50"><span className={`px-4 py-1.5 rounded-lg text-white font-black shadow-sm ${calc.grade==='A'?'bg-green-500':calc.grade==='B'?'bg-lime-500':calc.grade==='C'?'bg-yellow-500':'bg-red-500'}`}>{calc.grade}</span></td>
                              <td className="p-2 bg-slate-50 border-l"><input type="text" disabled={currentUser.role !== 'Admin'} className="w-28 border p-2 text-xs rounded-lg outline-none bg-white" placeholder="Cuti" value={um.keterangan || ''} onChange={e=>handleMonthlyInput(p.id, 'keterangan', e.target.value)}/></td>
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

        {/* --- TAB PENGATURAN SUB-TABS (ONLY ADMIN) --- */}
        {activeTab === 'pengaturan' && currentUser.role === 'Admin' && (
          <div className="bg-slate-800 p-5 md:p-8 rounded-3xl shadow-2xl border border-slate-700 text-slate-200">
            <h2 className="font-black text-2xl text-white flex items-center gap-2"><Settings /> Control Panel</h2>
            <p className="text-sm text-slate-400 mt-1.5">Kelola master data, parameter KPI, dan kredensial login.</p>
            <div className="flex gap-2 border-b border-slate-700 pb-4 mb-6 mt-4 overflow-x-auto">
              <button onClick={() => setActiveSettingTab('akun')} className={`px-5 py-3 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${activeSettingTab === 'akun' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Akses Login User</button>
              <button onClick={() => setActiveSettingTab('smelter')} className={`px-5 py-3 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${activeSettingTab === 'smelter' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Manajemen Area</button>
              <button onClick={() => setActiveSettingTab('kpi')} className={`px-5 py-3 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${activeSettingTab === 'kpi' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Indikator & Target KPI</button>
            </div>

            {activeSettingTab === 'akun' && (
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-700 shadow-inner">
                <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6 border-b border-slate-700 pb-5">
                  <div><h3 className="font-black text-white text-lg flex items-center gap-2"><Shield size={22} className="text-emerald-400"/> Database Kredensial User</h3><p className="text-xs text-slate-400">Pusat keamanan manajemen sandi perangkat staf.</p></div>
                  <div className="relative w-full md:w-72"><Search size={16} className="absolute left-4 top-3 text-slate-400" /><input type="text" placeholder="Cari profil karyawan..." className="pl-11 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white focus:ring-emerald-500 w-full outline-none" value={credSearchQuery} onChange={e => setCredSearchQuery(e.target.value)} /></div>
                </div>
                <div className="overflow-x-auto border border-slate-700 rounded-2xl max-h-[450px]">
                  <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
                    <thead className="bg-slate-800 text-slate-200 sticky top-0"><tr><th className="p-4">Profil Pegawai</th><th className="p-4 text-center">ID (Username)</th><th className="p-4 text-center">Password Sistem</th><th className="p-4 text-center">Aksi</th></tr></thead>
                    <tbody>
                      {credSearchResult.map(p => (
                        <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/40">
                          <td className="p-4"><span className="font-bold text-white text-base block">{p.nama}</span><span className="inline-block mt-1 text-[10px] rounded text-emerald-400 font-mono">{p.area} • {p.role}</span></td>
                          {editingCredId === p.id ? (
                            <>
                              <td className="p-3"><input type="text" className="bg-slate-950 border border-slate-600 rounded-lg p-2 w-full text-white text-xs font-mono text-center" value={credFormData.idKaryawan} onChange={e => setCredFormData({...credFormData, idKaryawan: e.target.value})} /></td>
                              <td className="p-3"><input type="text" className="bg-slate-950 border border-slate-600 rounded-lg p-2 w-full text-white text-xs text-center" value={credFormData.password} onChange={e => setCredFormData({...credFormData, password: e.target.value})} /></td>
                              <td className="p-3 text-center space-x-2"><button onClick={handleSaveCred} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs">Simpan</button><button onClick={() => setEditingCredId(null)} className="bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-xs">Batal</button></td>
                            </>
                          ) : (
                            <>
                              <td className="p-4 text-center">{p.idKaryawan ? <span className="text-emerald-300 font-mono bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-800/50">{p.idKaryawan}</span> : <span className="text-slate-500 italic text-xs">Belum diset</span>}</td>
                              <td className="p-4 text-center">{p.password ? <span className="text-slate-300 font-mono bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700">{p.password}</span> : <span className="text-slate-500 italic text-xs">Belum diset</span>}</td>
                              <td className="p-4 text-center"><button onClick={() => handleEditCredClick(p)} className="text-emerald-400 border border-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all"><Edit size={14}/></button></td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSettingTab === 'smelter' && (
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-700">
                <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-widest text-emerald-400">Database Area / Smelter</h3>
                <div className="flex flex-col md:flex-row gap-3 mb-6">
                  <input type="text" placeholder="Tambahkan nama smelter/area baru..." className="flex-1 bg-slate-800 border border-slate-600 rounded-xl p-3.5 text-sm text-white focus:ring-emerald-500 outline-none" value={newArea} onChange={e=>setNewArea(e.target.value)} />
                  <button onClick={handleAddArea} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3.5 rounded-xl text-white font-bold text-sm shadow-md">Tambahkan</button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {safeAreas.map(area => (
                    <div key={area} className="bg-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm font-bold text-emerald-300 border border-slate-600 shadow-sm">{area} <button onClick={() => handleDeleteArea(area)} className="text-red-400 p-1 rounded-md bg-slate-900"><Trash2 size={14}/></button></div>
                  ))}
                </div>
              </div>
            )}

            {activeSettingTab === 'kpi' && (
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-700">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                  {safeRoles.filter(r => r.id === 'SO' || r.id === 'WFSO').map(r => (
                    <div key={r.id} className="bg-slate-800 p-5 rounded-3xl border border-slate-600 shadow-sm">
                      <h4 className="font-black text-emerald-400 mb-5 border-b border-slate-700 pb-3 flex items-center gap-2 uppercase tracking-wide"><span>Rules {r.name}</span></h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm mb-2 whitespace-nowrap">
                          <thead><tr className="text-slate-400 border-b border-slate-700"><th className="pb-3 px-1 font-bold">Parameter Penilaian</th><th className="pb-3 text-center px-1 font-bold">Kategori</th><th className="pb-3 text-center px-1 font-bold">Target</th><th className="pb-3 text-center px-1 font-bold">Hapus</th></tr></thead>
                          <tbody>
                            {masterData.categories?.[r.id]?.map((cat, index) => (
                              <tr key={cat.key} className="border-b border-slate-700/50 last:border-0">
                                <td className="py-3 pr-2"><input type="text" className="bg-slate-900 border border-slate-600 rounded-xl p-2.5 w-full text-white text-xs outline-none" value={cat.label} onChange={e => handleUpdateCategory(r.id, index, 'label', e.target.value)} /></td>
                                <td className="py-3 px-2 text-center"><select className="bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white text-xs outline-none" value={cat.isTargeted} onChange={e => handleUpdateCategory(r.id, index, 'isTargeted', e.target.value === 'true')}><option value="true">Utama</option><option value="false">Ekstra</option></select></td>
                                <td className="py-3 px-2 text-center"><input type="number" disabled={!cat.isTargeted} className={`w-16 bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-center text-xs font-bold text-white outline-none ${!cat.isTargeted && 'opacity-30'}`} value={cat.target} onChange={e => handleUpdateCategory(r.id, index, 'target', e.target.value)} /></td>
                                <td className="py-3 pl-2 text-center"><button onClick={() => handleDeleteCategory(r.id, index)} className="text-red-400 p-2 bg-slate-700 rounded-xl"><Trash2 size={16}/></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-emerald-950/30 p-5 rounded-3xl border border-emerald-800/50 shadow-lg">
                  <h4 className="font-black text-emerald-400 mb-4 text-sm uppercase tracking-widest"><Plus size={18} /> Daftarkan Parameter Baru</h4>
                  <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
                    <div className="w-full md:flex-1"><label className="block text-[10px] text-emerald-200/70 font-bold uppercase mb-2">Jabatan</label><select className="w-full bg-slate-800 border border-emerald-800/50 rounded-xl p-3 text-white text-sm outline-none" value={newCatRole} onChange={e=>setNewCatRole(e.target.value)}>{safeRoles.filter(r => r.id === 'SO' || r.id === 'WFSO').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                    <div className="w-full md:flex-1"><label className="block text-[10px] text-emerald-200/70 font-bold uppercase mb-2">Nama Indikator / Kriteria</label><input type="text" placeholder="Laporan Harian" className="w-full bg-slate-800 border border-emerald-800/50 rounded-xl p-3 text-white text-sm outline-none" value={newCatLabel} onChange={e=>setNewCatLabel(e.target.value)} /></div>
                    <div className="w-full md:w-32"><label className="block text-[10px] text-emerald-200/70 font-bold uppercase mb-2">Tipe Aturan</label><select className="w-full bg-slate-800 border border-emerald-800/50 rounded-xl p-3 text-white text-sm outline-none" value={newCatType} onChange={e=>setNewCatType(e.target.value)}><option value="target">Utama</option><option value="extra">Ekstra Poin</option></select></div>
                    {newCatType === 'target' && (<div className="w-full md:w-24"><label className="block text-[10px] text-emerald-200/70 font-bold uppercase mb-2">Target</label><input type="number" className="w-full bg-slate-800 border border-emerald-800/50 rounded-xl p-3 text-white text-sm font-bold text-center outline-none" value={newCatTarget} onChange={e=>setNewCatTarget(e.target.value)} /></div>)}
                    <button onClick={handleAddCategory} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 px-8 py-3.5 rounded-xl text-white font-bold text-sm tracking-wide border border-emerald-500">SIMPAN</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* COMPONENT MODAL CUSTOM (ERROR TYPO EXCEL) */}
      {pasteErrors.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8 border border-slate-200">
            <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4"><div className="bg-red-100 p-2 rounded-xl text-red-600"><AlertTriangle size={24} /></div><h3 className="text-xl font-black text-slate-800">Nama Tidak Terdaftar!</h3></div>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">Beberapa nama dari excel di bawah ini <b>gagal diinput</b> karena tidak ditemukan atau salah ketik (*typo*). Pastikan ejaan nama sama persis dengan menu Karyawan:</p>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto mb-6 shadow-inner"><ul className="list-disc pl-5 text-xs text-slate-700 font-mono space-y-1.5">{pasteErrors.map((name, i) => <li key={i} className="capitalize font-bold">{name}</li>)}</ul></div>
            <button onClick={() => setPasteErrors([])} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl tracking-wide text-sm">Tutup & Evaluasi Excel</button>
          </div>
        </div>
      )}
    </div>
  );
}

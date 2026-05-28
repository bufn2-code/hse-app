/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { 
  Database, ClipboardPaste, CheckCircle, Table, Trash2, Edit, AlertTriangle, 
  Download, Search, LayoutDashboard, Calendar, TrendingDown, Settings, 
  Plus, XCircle, Award, Medal, UserCheck, Lock, User, LogOut, Smartphone, Shield
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

  // =====================================================
  // STATE UTAMA
  // =====================================================
  const [currentUser, setCurrentUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ idKaryawan: '', password: '' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardMode, setDashboardMode] = useState('bulanan'); 
  const [activeSettingTab, setActiveSettingTab] = useState('akun'); 
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentMonth());
  const [user, setUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  
  // STATE PWA & MODAL EXIT
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
  // 1. SISTEM JEBAKAN TOMBOL KEMBALI HP (SEMPURNA)
  // =====================================================
  useEffect(() => {
    // 1. Pasang 'state palsu' agar tombol back HP memicu event, bukan langsung keluar
    window.history.pushState({ trap: true }, '');

    const handlePopState = (e) => {
      e.preventDefault();
      // 2. Saat back ditekan, tampilkan konfirmasi keluar
      setShowExitModal(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // Hanya dipanggil sekali saat aplikasi dimuat

  const cancelExitApp = () => {
    setShowExitModal(false);
    // 3. Jika batal keluar, pasang ulang 'state palsu' agar jebakan aktif kembali
    window.history.pushState({ trap: true }, '');
  };

  const confirmExitApp = () => {
    setShowExitModal(false);
    // 4. Jika yakin keluar, tutup paksa aplikasi
    window.close();
    // Fallback: Jika window.close diblokir browser, paksa mundur 1 langkah keluar dari aplikasi
    setTimeout(() => {
      window.history.back();
    }, 100);
  };

  // =====================================================
  // 2. SISTEM POPUP INSTALASI PWA (MOBILE DETECT)
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
  // 3. FIRESTORE SYNC INITIALIZER
  // =====================================================
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (userObj) => {
      if (!userObj) {
        try { await signInAnonymously(auth); } catch (e) { console.error("Koneksi ditolak HP:", e); }
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
          categories: data.categories || defaultSettings.categories
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

    const timeoutDb = setTimeout(() => setIsDbReady(true), 3000);

    return () => { unsubAuth(); unsubs.forEach(u => u()); clearTimeout(timeoutDb); };
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

  // PROTEKSI FILTER ROLE
  const isManager = currentUser && ['Admin', 'Foreman', 'WFSO'].includes(currentUser.role);
  useEffect(() => {
    if (currentUser && !isManager) setSelectedRoleContext(currentUser.role);
  }, [currentUser, isManager]);

  useEffect(() => {
    if (activeTab === 'dashboard' && dashboardMode === 'tahunan' && personnel.length > 0) {
      calculateYearlyBest();
    }
  }, [activeTab, dashboardMode, selectedPeriod, personnel, selectedRoleContext]);

  // =====================================================
  // LOGIN SYSTEM
  // =====================================================
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const username = loginForm.idKaryawan.trim();
    const password = loginForm.password.trim();

    if (!username || !password) return showToast("Harap isi seluruh kolom!", "error");

    if (username.toLowerCase() === 'admin' && password === 'addminbufn2') {
      setCurrentUser({ id: 'master-admin', nama: 'Super Admin HSE', role: 'Admin', area: 'All Smelters', idKaryawan: 'admin' });
      showToast("Selamat datang, Super Admin!");
      setActiveTab('dashboard');
      return;
    }

    const foundUser = personnel.find(p => p.idKaryawan && p.idKaryawan.trim() === username && p.password && p.password.trim() === password);
    if (foundUser) {
      setCurrentUser(foundUser);
      showToast(`Selamat datang, ${foundUser.nama}!`);
      setActiveTab('dashboard');
    } else {
      showToast("ID Karyawan atau Password salah!", "error");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginForm({ idKaryawan: '', password: '' });
    showToast("Berhasil keluar.");
  };

  // =====================================================
  // OPERASIONAL KARYAWAN & MASTER DATA
  // =====================================================
  const saveMasterData = async (newData) => {
    try { await setDoc(doc(db, 'artifacts', getAppId(), 'settings', 'master'), newData); showToast("Master data disimpan!"); } 
    catch (error) { showToast("Gagal menyimpan: " + error.message, "error"); }
  };
  const handleAddArea = () => {
    if(!newArea.trim()) return;
    const formattedArea = newArea.trim().replace(/\b\w/g, l => l.toUpperCase());
    if(safeAreas.includes(formattedArea)) return showToast("Smelter sudah terdaftar!", "error");
    saveMasterData({ ...masterData, areas: [...safeAreas, formattedArea] });
    setNewArea('');
  };
  const handleDeleteArea = (areaTarget) => {
    if(confirm(`Hapus ${areaTarget} dari master sistem?`)) { saveMasterData({ ...masterData, areas: safeAreas.filter(a => a !== areaTarget) }); }
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
    if (!newCatLabel.trim()) return showToast("Nama indikator wajib diisi!", "error");
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
      setNewEmp({ nama: '', area: safeAreas[0] || '', role: safeRoles[0]?.id || '' }); showToast("Karyawan baru terdaftar!");
    } catch (error) { showToast("Gagal menyimpan: " + error.message, "error"); }
  };

  const handleEditClick = (emp) => {
    setEditingId(emp.id);
    setEditFormData({ nama: emp.nama || '', area: emp.area || '', role: emp.role || '' });
  };

  const handleSaveEdit = async () => {
    if (!editFormData.nama.trim()) return;
    try { await setDoc(doc(db, 'artifacts', getAppId(), 'personnel', editingId), { nama: editFormData.nama, area: editFormData.area, role: editFormData.role }, { merge: true }); setEditingId(null); showToast("Profil diubah!"); } 
    catch (error) { showToast("Gagal mengubah: " + error.message, "error"); }
  };

  const confirmDelete = async () => {
    try { await deleteDoc(doc(db, 'artifacts', getAppId(), 'personnel', deleteModal.id)); setDeleteModal({ show: false, id: null, nama: '' }); showToast("Data dihapus permanen!"); } 
    catch (error) { showToast("Gagal menghapus: " + error.message, "error"); }
  };

  const handleEditCredClick = (emp) => {
    setEditingCredId(emp.id);
    setCredFormData({ idKaryawan: emp.idKaryawan || '', password: emp.password || '' });
  };

  const handleSaveCred = async () => {
    try { await setDoc(doc(db, 'artifacts', getAppId(), 'personnel', editingCredId), credFormData, { merge: true }); setEditingCredId(null); showToast("Akses Login diperbarui!"); } 
    catch (error) { showToast("Gagal mengubah akses: " + error.message, "error"); }
  };
  
  // =====================================================
  // DATA PASTE EXCEL (AUTO-DETECT GLOBAL)
  // =====================================================
  const handleProcessPaste = async () => {
    if (!pasteText.trim()) return showToast('Teks paste kosong!', 'error');
    const lines = pasteText.split('\n');
    const counts = {}; let lineTotal = 0;

    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim()).filter(p => p !== '');
      if (parts.length < 1) return;
      const namaPaste = parts[0].toLowerCase();
      counts[namaPaste] = (counts[namaPaste] || 0) + 1; lineTotal++;
    });

    const updates = {}; let matchedCount = 0; let notFoundNames = [];

    Object.keys(counts).forEach(namaKey => {
      const emp = personnel.find(p => p.nama.toLowerCase() === namaKey);
      if (emp) {
        if (!updates[emp.id]) updates[emp.id] = {};
        if (!updates[emp.id][selectedWeek]) updates[emp.id][selectedWeek] = {};
        const oldVal = weeklyData[emp.id]?.[selectedWeek]?.[selectedIndicator] || 0;
        updates[emp.id][selectedWeek][selectedIndicator] = oldVal + counts[namaKey];
        matchedCount++;
      } else { notFoundNames.push(namaKey); }
    });

    try {
      for (const empId of Object.keys(updates)) { await setDoc(doc(db, 'artifacts', getAppId(), `weekly_${selectedPeriod}`, empId), updates[empId], { merge: true }); }
      setPasteText(''); showToast(`Berhasil merekap ${lineTotal} data!`);
      if(notFoundNames.length > 0) setPasteErrors(Array.from(new Set(notFoundNames)));
    } catch (error) { showToast("Gagal: " + error.message, "error"); }
  };

  const handleMonthlyInput = async (empId, field, value) => {
    try { await setDoc(doc(db, 'artifacts', getAppId(), `monthly_${selectedPeriod}`, empId), { [field]: value }, { merge: true }); } catch (error) { console.error(error); }
  };

  // =====================================================
  // ENGINE LOGIKA RUMUS MATEMATIKA KPI
  // =====================================================
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

    let tPoin = Number(um.kepatuhan) || 75; 
    untargetedCats.forEach(c => { tPoin += (acc[c.key] || 0) }); 
    const penalti = (Number(um.pelanggaran) || 0) * -5;
    const sAkhir = sAwal + tPoin + penalti;
    
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

  const exportToExcel = (area, personnelList) => {
    const cats = getActiveCategories(selectedRoleContext);
    let csvContent = "Area,Nama,"; cats.forEach(c => csvContent += `"${c.label}",`);
    csvContent += "Kepatuhan,Pelanggaran,Skor Awal,Tambahan Poin,Penalti Kepatuhan,Skor Akhir,Nilai,Keterangan\n";
    personnelList.forEach(p => {
      const acc = getAccumulatedData(p.id, p.role);
      const um = monthlyData[p.id] || { kepatuhan: 75, pelanggaran: 0, keterangan: '' };
      const calc = calculateScore(acc, um, p.role);
      let row = `"${p.area}","${p.nama}",`; cats.forEach(c => row += `"${acc[c.key]||0}",`);
      row += `"${um.kepatuhan||75}","${um.pelanggaran||0}","${calc.sAwal.toFixed(1)}","${calc.tPoin}","${calc.penalti}","${calc.sAkhir.toFixed(1)}","${calc.grade}","${um.keterangan||''}"\n`;
      csvContent += row;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `Laporan_KPI_${selectedRoleContext}_${area}_${selectedPeriod}.csv`; link.click();
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
  const handleDashboardSearchChange = (area, val) => { setDashboardSearch(prev => ({ ...prev, [area]: val })); };
  const searchResult = personnel.filter(p => (p.nama || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const credSearchResult = personnel.filter(p => (p.nama || '').toLowerCase().includes(credSearchQuery.toLowerCase()));


  // =====================================================
  // RENDER PRAMUAT & JENDELA LOGIN & MODAL GLOBAL (ALL STATES)
  // =====================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-12 relative overflow-hidden">
      
      {/* 1. COMPONENT TOAST MODERN GLOBAL */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-semibold transition-all duration-300 border border-white/20 animate-bounce ${toast.type === 'error' ? 'bg-gradient-to-r from-red-600 to-rose-700' : 'bg-gradient-to-r from-emerald-600 to-teal-700'}`}>
          {toast.type === 'error' ? <XCircle size={22} /> : <CheckCircle size={22} />}
          <p className="text-sm tracking-wide">{toast.msg}</p>
        </div>
      )}

      {/* 2. COMPONENT POPUP PWA INSTALASI GLOBAL (BISA MUNCUL SAAT LOGIN) */}
      {showInstallPopup && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-2xl z-[150] border border-slate-700 animate-in slide-in-from-bottom duration-500">
          <div className="flex gap-4 items-start">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-lg"><Smartphone size={24}/></div>
            <div className="flex-1">
              <h3 className="font-black text-sm tracking-wide">Instal Aplikasi KPI HSE</h3>
              <p className="text-slate-300 text-xs mt-1 leading-relaxed">Pasang aplikasi di layar utama HP Anda agar loading lebih cepat, nyaman, dan praktis.</p>
              {navigator.userAgent.match(/iPhone|iPad|iPod/i) ? (
                <div className="mt-3 text-[11px] bg-emerald-950/40 text-emerald-300 p-2 rounded-lg border border-emerald-800/30">
                  👉 <b>Khusus iPhone:</b> Tekan tombol kotak panah atas <b>'Share'</b> di browser bawah, lalu geser & pilih <b>'Add to Home Screen'</b>.
                </div>
              ) : (
                <button onClick={triggerNativeInstall} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md">Instal Sekarang</button>
              )}
            </div>
            <button onClick={() => setShowInstallPopup(false)} className="text-slate-400 hover:text-white font-bold text-sm bg-slate-800 rounded-full w-6 h-6 flex items-center justify-center">✕</button>
          </div>
        </div>
      )}

      {/* 3. COMPONENT MODAL EXIT APP (KEMBALI KE HOMESCREEN HP) */}
      {showExitModal && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 text-center border border-slate-200">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut size={32} className="text-red-600" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Keluar Aplikasi?</h3>
            <p className="text-slate-500 text-sm mb-6">Apakah Anda yakin ingin keluar dari Portal KPI HSE BUFN 2?</p>
            <div className="flex gap-3 w-full">
              <button onClick={cancelExitApp} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700 text-sm transition-colors">Batal</button>
              <button onClick={confirmExitApp} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-md transition-colors">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= LOADING SCREEN ================= */}
      {!isDbReady ? (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center absolute inset-0 z-50">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-10 w-10 mb-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span className="font-semibold text-emerald-400 tracking-widest text-sm animate-pulse">Menghubungkan ke Server...</span>
          </div>
        </div>
      ) : !currentUser ? (
        
      /* ================= LOGIN SCREEN ================= */
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 absolute inset-0 z-40">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-700/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-700/20 rounded-full blur-3xl"></div>
          
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-sm relative z-10 animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-8">
              <div className="bg-emerald-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <CheckCircle size={48} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Portal KPI HSE BUFN 2</h2>
              <p className="text-slate-500 text-sm mt-1">Sistem Evaluasi</p>
            </div>
            
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">ID Karyawan</label>
                <div className="relative mt-1">
                  <User size={18} className="absolute left-4 top-3.5 text-slate-500" />
                  <input type="text" placeholder="Contoh: 822" className="w-full bg-slate-800 border border-slate-700 p-3.5 pl-12 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all font-mono text-sm"
                    value={loginForm.idKaryawan} onChange={e => setLoginForm({...loginForm, idKaryawan: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">Password</label>
                <div className="relative mt-1">
                  <Lock size={18} className="absolute left-4 top-3.5 text-slate-500" />
                  <input type="password" placeholder="••••••••" className="w-full bg-slate-800 border border-slate-700 p-3.5 pl-12 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all text-sm"
                    value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-900/20 transition-all transform active:scale-[0.98] tracking-widest text-sm mt-2">
                MASUK SISTEM
              </button>
            </form>
          </div>
        </div>
      ) : (

      /* ================= MAIN DASHBOARD APP ================= */
        <>
          <header className="bg-emerald-800 text-white p-5 shadow-lg relative z-10">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <CheckCircle size={36} className="text-emerald-300" />
                <div>
                  <h1 className="text-2xl font-bold tracking-wide">KPI HSE BUFN 2</h1>
                  <p className="text-emerald-200 text-xs mt-0.5">User: <b className="uppercase">{currentUser.nama}</b> ({safeRoles.find(r=>r.id===currentUser.role)?.name || currentUser.role})</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                
                {/* KALENDER DARK MODE KUSTOM */}
                <div className="bg-emerald-900 px-4 py-2.5 md:py-2 rounded-lg border border-emerald-700 flex items-center gap-2 shadow-inner w-full md:w-auto justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-emerald-300"/>
                    <input 
                      type="month" 
                      className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer outline-none w-[110px] [color-scheme:dark]" 
                      value={selectedPeriod} 
                      onChange={(e) => setSelectedPeriod(e.target.value)} 
                    />
                  </div>
                </div>

                <button onClick={handleLogout} className="bg-red-700 hover:bg-red-600 text-white p-2.5 md:px-3 md:py-2 rounded-lg border border-red-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors w-12 md:w-auto"><LogOut size={16}/><span className="hidden md:inline">Keluar</span></button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto mt-6 px-4">
            {/* TABS NAVIGATION (SCROLLABLE ON MOBILE) */}
            <div className="flex overflow-x-auto whitespace-nowrap space-x-2 border-b border-slate-300 mb-6 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2.5 font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 border border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><LayoutDashboard size={16}/> Dashboard</button>
              {currentUser.role === 'Admin' && (
                <>
                  <button onClick={() => setActiveTab('database')} className={`px-4 py-2.5 font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm ${activeTab === 'database' ? 'bg-white text-emerald-700 border border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Database size={16}/> Karyawan</button>
                  <button onClick={() => setActiveTab('input')} className={`px-4 py-2.5 font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm ${activeTab === 'input' ? 'bg-white text-emerald-700 border border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><ClipboardPaste size={16}/> Input Nilai</button>
                </>
              )}
              <button onClick={() => setActiveTab('laporan')} className={`px-4 py-2.5 font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm ${activeTab === 'laporan' ? 'bg-white text-emerald-700 border border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Table size={16}/> Laporan</button>
              {currentUser.role === 'Admin' && (
                <button onClick={() => setActiveTab('pengaturan')} className={`px-4 py-2.5 font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm ${activeTab === 'pengaturan' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}><Settings size={16}/> Pengaturan</button>
              )}
            </div>

            {/* ROLE FILTER */}
            {['input', 'laporan', 'dashboard'].includes(activeTab) && isManager && (
              <div className="mb-4 bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center gap-3 border border-slate-200">
                <span className="font-bold text-slate-700 text-sm">Tampilkan Data Untuk:</span>
                <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                  {safeRoles.filter(r => r.id === 'SO' || r.id === 'WFSO').map(r => (
                    <button key={r.id} onClick={() => setSelectedRoleContext(r.id)} className={`px-4 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap text-sm ${selectedRoleContext === r.id ? 'bg-emerald-100 text-emerald-800 shadow-sm border border-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{r.name}</button>
                  ))}
                </div>
              </div>
            )}

            {/* --- TAB DASHBOARD --- */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {isManager && (
                  <div className="flex gap-2 bg-slate-200 p-1.5 rounded-xl w-full md:w-fit shadow-inner">
                    <button onClick={() => setDashboardMode('bulanan')} className={`flex-1 md:flex-none px-4 py-2 font-bold text-xs rounded-lg transition-all ${dashboardMode === 'bulanan' ? 'bg-white text-emerald-800 shadow' : 'text-slate-600'}`}>Pencapaian Bulanan</button>
                    <button onClick={() => setDashboardMode('tahunan')} className={`flex-1 md:flex-none px-4 py-2 font-bold text-xs rounded-lg transition-all ${dashboardMode === 'tahunan' ? 'bg-white text-emerald-800 shadow' : 'text-slate-600'}`}>Karyawan Terbaik</button>
                  </div>
                )}

                {dashboardMode === 'bulanan' && (
                  <div className="grid grid-cols-1 gap-6">
                    {getVisibleAreas().map(area => {
                      const defisitArea = getDefisitTarget().filter(d => d.area === area);
                      const searchKey = dashboardSearch[area] || '';
                      const finalDefisitList = defisitArea.filter(d => d.nama.toLowerCase().includes(searchKey.toLowerCase()));

                      return (
                        <div key={area} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><TrendingDown className="text-red-500" size={20} /> {area}</h3>
                            {isManager && (
                              <div className="relative w-full md:w-auto"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input type="text" placeholder="Cari nama karyawan..." className="pl-9 pr-3 py-1.5 border rounded-lg text-xs w-full md:w-56 bg-slate-50 focus:ring-emerald-500" value={searchKey} onChange={(e) => handleDashboardSearchChange(area, e.target.value)} /></div>
                            )}
                          </div>

                          <div className="overflow-x-auto border rounded-xl shadow-inner max-h-[300px]">
                            <table className="w-full text-xs text-left whitespace-nowrap">
                              <thead className="bg-slate-700 text-white sticky top-0">
                                <tr><th className="p-3">Nama Karyawan</th><th className="p-3">Indikator Kurang</th><th className="p-3 text-center bg-slate-600">Tercapai</th><th className="p-3 text-center bg-slate-600">Target</th><th className="p-3 text-center bg-red-600">Kekurangan</th></tr>
                              </thead>
                              <tbody>
                                {finalDefisitList.length === 0 ? (
                                  <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-bold bg-slate-50">🎉 Aman! Tidak ada defisit target di area ini.</td></tr>
                                ) : (
                                  finalDefisitList.map((item) => (
                                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                      <td className="p-3 font-bold text-slate-700">{item.nama}</td><td className="p-3 font-medium text-slate-600">{item.indikator}</td><td className="p-3 text-center">{item.tercapai}</td><td className="p-3 text-center">{item.target}</td><td className="p-3 text-center font-bold text-red-600 bg-red-50/40"> - {item.kurang}</td>
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

                {dashboardMode === 'tahunan' && isManager && (
                  <div className="space-y-6">
                    {loadingYearly ? (
                      <div className="p-12 text-center bg-white rounded-2xl border font-semibold text-slate-500 animate-pulse">Mengkalkulasi Rata-rata Nilai 12 Bulan...</div>
                    ) : (
                      <>
                        {yearlyRecapData.globalBest && currentUser.role === 'Admin' && (
                          <div className="bg-gradient-to-r from-amber-500 to-yellow-600 p-6 md:p-8 rounded-2xl shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
                              <div className="bg-white/20 p-5 rounded-full shadow-inner"><Award size={48} className="text-yellow-200 animate-pulse"/></div>
                              <div>
                                <span className="bg-amber-800 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">KARYAWAN TERBAIK GLOBAL</span>
                                <h3 className="text-2xl font-black mt-2 tracking-wide shadow-sm">{yearlyRecapData.globalBest.nama}</h3>
                                <p className="text-amber-100 text-xs mt-1">Penempatan: <b>{yearlyRecapData.globalBest.area}</b> | Jabatan: <b>{safeRoles.find(r=>r.id===selectedRoleContext)?.name}</b></p>
                              </div>
                            </div>
                            <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/20 text-center shadow-inner w-full md:w-auto">
                              <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider">Rata-rata Nilai</p>
                              <p className="text-4xl font-black mt-1">{yearlyRecapData.globalBest.averageScore.toFixed(1)}</p>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                          {getVisibleAreas().map(area => {
                            const winner = yearlyRecapData.areaBest[area];
                            return (
                              <div key={area} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between gap-4">
                                <div className="flex items-center justify-between border-b pb-3">
                                  <h4 className="font-bold text-slate-800 text-sm tracking-wide">{area}</h4>
                                  <Medal size={20} className={winner ? "text-slate-400" : "text-slate-300"} />
                                </div>
                                {winner ? (
                                  <div>
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1"><UserCheck size={12}/> Juara 1 Area {selectedRoleContext}</p>
                                    <p className="text-xl font-black text-slate-800 mt-1">{winner.nama}</p>
                                    <p className="text-xs text-slate-600 font-bold mt-3 bg-slate-100 px-3 py-1.5 rounded-lg w-fit">Rata-rata Skor: <span className="text-emerald-700">{winner.averageScore.toFixed(1)}</span></p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic py-6 text-center">Belum ada rekam capaian tahunan.</p>
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

            {/* --- TAB DATABASE KARYAWAN (ADMIN ONLY) --- */}
            {activeTab === 'database' && currentUser.role === 'Admin' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">
                  <h2 className="text-lg font-bold mb-4 pb-2 border-b">Tambah Karyawan Baru</h2>
                  <form onSubmit={handleAddPersonnel} className="space-y-4">
                    <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Nama Lengkap</label><input type="text" required className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-emerald-500 text-sm" value={newEmp.nama} onChange={e => setNewEmp({...newEmp, nama: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Smelter</label><select className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-emerald-500 text-sm bg-white" value={newEmp.area} onChange={e => setNewEmp({...newEmp, area: e.target.value})}>{safeAreas.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                      <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Jabatan</label><select className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-emerald-500 text-sm bg-white" value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})}>{safeRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-bold py-3 rounded-xl shadow-md text-sm mt-2">Simpan Data Karyawan</button>
                  </form>
                </div>
                
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 border-b pb-4">
                    <h2 className="text-lg font-bold">Data Profil Karyawan Global</h2>
                    <div className="relative w-full md:w-auto"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input type="text" placeholder="Cari nama karyawan..." className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm w-full md:w-56 bg-slate-50 focus:ring-emerald-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner max-h-[500px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10"><tr><th className="p-3">Nama Lengkap</th><th className="p-3 text-center">Smelter</th><th className="p-3 text-center">Jabatan Aktif</th><th className="p-3 text-center">Aksi</th></tr></thead>
                      <tbody>
                        {searchResult.length === 0 ? (
                          <tr><td colSpan="4" className="text-center p-10 text-slate-500 border-dashed bg-slate-50">Karyawan tidak ditemukan.</td></tr>
                        ) : (
                          searchResult.map(p => {
                            const isAreaUnknown = !safeAreas.includes(p.area);
                            return (
                            <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 ${isAreaUnknown ? 'bg-red-50/50' : ''}`}>
                              {editingId === p.id ? (
                                <>
                                  <td className="p-2"><input type="text" className="border p-2 w-full text-sm rounded-lg focus:ring-emerald-500" value={editFormData.nama} onChange={(e) => setEditFormData({...editFormData, nama: e.target.value})} /></td>
                                  <td className="p-2 text-center"><select className="border p-2 text-sm rounded-lg focus:ring-emerald-500 bg-white" value={editFormData.area} onChange={(e) => setEditFormData({...editFormData, area: e.target.value})}>{safeAreas.map(a => <option key={a} value={a}>{a}</option>)}</select></td>
                                  <td className="p-2 text-center"><select className="border p-2 text-sm rounded-lg focus:ring-emerald-500 bg-white" value={editFormData.role} onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}>{safeRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                                  <td className="p-2 text-center space-x-2"><button onClick={handleSaveEdit} className="text-white bg-emerald-600 px-4 py-2 rounded-lg font-bold text-xs shadow">Simpan</button><button onClick={() => setEditingId(null)} className="bg-slate-200 px-4 py-2 rounded-lg font-bold text-xs">Batal</button></td>
                                </>
                              ) : (
                                <>
                                  <td className="p-3 font-bold text-slate-700">{p.nama}</td>
                                  <td className="p-3 text-center font-bold text-slate-500">{p.area} {isAreaUnknown && <span className="text-red-500 text-[10px] block mt-1">(Perlu Diupdate)</span>}</td>
                                  <td className="p-3 text-center"><span className="px-3 py-1 bg-slate-200 rounded-lg text-xs font-bold text-slate-600">{safeRoles.find(r=>r.id===p.role)?.name || p.role}</span></td>
                                  <td className="p-3 text-center space-x-4"><button onClick={() => handleEditClick(p)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-lg"><Edit size={16}/></button><button onClick={() => setDeleteModal({ show: true, id: p.id, nama: p.nama })} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-lg"><Trash2 size={16}/></button></td>
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

            {/* --- TAB INPUT NILAI KINERJA (ADMIN ONLY) --- */}
            {activeTab === 'input' && currentUser.role === 'Admin' && (
              <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="bg-slate-50 p-5 md:p-6 rounded-2xl border border-slate-200 h-fit">
                      <h2 className="font-bold text-lg mb-4 border-b pb-2">Paste Data Excel Gabungan</h2>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <select className="border border-slate-300 p-2.5 w-full rounded-xl focus:ring-emerald-500 text-sm bg-white" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>{weeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
                        <select className="border border-slate-300 p-2.5 w-full rounded-xl focus:ring-emerald-500 text-sm bg-white" value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>
                          {getAllUniqueCategories().map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                      <div className="bg-blue-100/50 border border-blue-200 text-blue-800 rounded-xl p-4 text-xs mb-4 leading-relaxed">
                         💡 <b>Auto-Detect Global:</b> Cukup paste barisan <b>NAMA KARYAWAN</b> dari excel tanpa memisahkan SO atau WFSO. Aplikasi otomatis melacak jabatannya dan menghitung akumulasi frekuensinya secara presisi.
                      </div>
                      <textarea className="w-full border border-slate-300 p-4 h-48 rounded-xl text-sm font-mono focus:ring-emerald-500 shadow-inner" placeholder="Paste daftar NAMA saja di sini..." value={pasteText} onChange={(e) => setPasteText(e.target.value)}></textarea>
                      <button onClick={handleProcessPaste} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black tracking-wide py-3 mt-4 rounded-xl shadow-md">PROSES DATA</button>
                    </div>
                    <div>
                      <h2 className="font-bold text-lg mb-4 text-slate-700">Preview Capaian Semelter ({safeRoles.find(r=>r.id===selectedRoleContext)?.name})</h2>
                      {getVisibleAreas().map(area => {
                        const areaPersonnel = getVisiblePersonnel(area);
                        if (areaPersonnel.length === 0) return null;

                        return (
                          <div key={area} className="mb-6">
                            <div className="px-4 py-2 rounded-t-xl font-bold text-sm bg-slate-200 text-slate-700">{area}</div>
                            <div className="overflow-x-auto border border-slate-200 border-t-0 rounded-b-xl shadow-sm">
                              <table className="w-full text-xs whitespace-nowrap"><thead className="bg-slate-50 border-b"><tr><th className="p-3 text-left text-slate-500">Nama</th>{getActiveCategories(selectedRoleContext).map(c => <th key={c.key} className="p-3 text-center text-slate-500">{c.label}</th>)}</tr></thead>
                                <tbody>{areaPersonnel.map(p => {
                                  const wData = weeklyData[p.id]?.[selectedWeek] || {};
                                  return (
                                    <tr key={p.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                                      <td className="p-3 font-bold text-slate-700">{p.nama}</td>
                                      {getActiveCategories(selectedRoleContext).map(c => (
                                        <td key={c.key} className="p-3 text-center text-emerald-700 font-black bg-emerald-50/30">{wData[c.key] !== undefined ? wData[c.key] : 0}</td>
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

            {/* --- TAB REKAP LAPORAN FINAL --- */}
            {activeTab === 'laporan' && (
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                 <div className="mb-6 pb-4 border-b border-slate-200"><h2 className="font-bold text-xl md:text-2xl text-slate-800">Laporan Rekap Keseluruhan KPI</h2></div>
                 
                 {getVisibleAreas().map(area => {
                    const areaPersonnel = getVisiblePersonnel(area);
                    if (areaPersonnel.length === 0) return null;
                    
                    return (
                      <div key={area} className="mb-10 overflow-x-auto shadow-sm rounded-2xl border border-slate-200">
                        <div className="flex justify-between items-center text-white px-4 md:px-5 py-3.5 rounded-t-2xl bg-slate-800">
                          <h3 className="font-bold text-sm md:text-lg flex items-center gap-2"><Table size={18} className="text-emerald-400" /> {area}</h3>
                          <button onClick={() => exportToExcel(area, areaPersonnel)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow transition-colors"><Download size={14} /> Export Excel</button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse whitespace-nowrap">
                            <thead className="bg-slate-700 text-white">
                              <tr>
                                <th className="p-3 md:p-4 text-left">Nama</th>
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
                                    <td className="p-3 md:p-4 font-bold text-slate-700">{p.nama} <span className="block text-[10px] text-slate-400 mt-0.5">{p.area}</span></td>
                                    {getActiveCategories(selectedRoleContext).map(c => <td key={c.key} className="p-3 text-center border-l border-slate-200 font-medium text-slate-600">{acc[c.key]||0}</td>)}
                                    
                                    <td className="p-2 text-center border-l border-slate-200 bg-emerald-50/30">
                                      <select disabled={currentUser.role !== 'Admin'} className="border border-emerald-200 p-1.5 rounded-lg w-16 focus:ring-emerald-500 text-center bg-white font-bold text-emerald-800" value={um.kepatuhan || 75} onChange={e=>handleMonthlyInput(p.id, 'kepatuhan', e.target.value)}><option value="25">25</option><option value="50">50</option><option value="75">75</option></select>
                                    </td>
                                    <td className="p-2 text-center bg-red-50/30 border-l border-slate-200">
                                      <input type="number" disabled={currentUser.role !== 'Admin'} className="w-14 border border-red-200 p-1.5 rounded-lg text-center focus:ring-red-500 bg-white font-bold text-red-800" value={um.pelanggaran || 0} onChange={e=>handleMonthlyInput(p.id, 'pelanggaran', e.target.value)}/>
                                    </td>
                                    
                                    <td className="p-3 text-center border-l border-slate-200 bg-slate-50 font-bold">{calc.sAwal.toFixed(1)}</td>
                                    <td className="p-3 text-center bg-slate-50 font-bold text-emerald-600">+{calc.tPoin}</td>
                                    <td className="p-3 text-center text-red-600 font-bold bg-red-50/30">{calc.penalti}</td>
                                    <td className="p-3 text-center font-black text-base text-emerald-800 bg-emerald-100/50 border-l border-emerald-200">{calc.sAkhir.toFixed(1)}</td>
                                    <td className="p-3 text-center border-l border-emerald-200 bg-emerald-50/50"><span className={`px-4 py-1.5 rounded-lg text-white font-black tracking-wider shadow-sm ${calc.grade==='A'?'bg-green-500':calc.grade==='B'?'bg-lime-500':calc.grade==='C'?'bg-yellow-500':'bg-red-500'}`}>{calc.grade}</span></td>
                                    
                                    <td className="p-2 bg-emerald-50/30">
                                      <input type="text" disabled={currentUser.role !== 'Admin'} className="w-24 md:w-32 border border-emerald-200 p-2 text-xs rounded-lg focus:ring-emerald-500 bg-white placeholder-slate-400" placeholder="Cuti/Ijin" value={um.keterangan || ''} onChange={e=>handleMonthlyInput(p.id, 'keterangan', e.target.value)}/>
                                    </td>
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
            )}

            {/* --- TAB PENGATURAN SUB-TABS (ONLY ADMIN) --- */}
            {activeTab === 'pengaturan' && currentUser.role === 'Admin' && (
              <div className="bg-slate-800 p-5 md:p-8 rounded-2xl shadow-xl border border-slate-700 text-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <h2 className="font-bold text-2xl text-white flex items-center gap-2"><Settings /> Pengaturan Sistem</h2>
                    <p className="text-sm text-slate-400 mt-1">Kelola data master dan hak akses sistem.</p>
                  </div>
                </div>

                {/* SUB-MENU TABS */}
                <div className="flex gap-2 border-b border-slate-700 pb-4 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  <button onClick={() => setActiveSettingTab('akun')} className={`px-5 py-2.5 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${activeSettingTab === 'akun' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>1. Akses Login User</button>
                  <button onClick={() => setActiveSettingTab('smelter')} className={`px-5 py-2.5 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${activeSettingTab === 'smelter' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>2. Manajemen Smelter</button>
                  <button onClick={() => setActiveSettingTab('kpi')} className={`px-5 py-2.5 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${activeSettingTab === 'kpi' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>3. Indikator KPI</button>
                </div>

                {/* SUB-TAB 1: MANAJEMEN AKSES LOGIN KARYAWAN */}
                {activeSettingTab === 'akun' && (
                  <div className="bg-slate-900 p-5 md:p-8 rounded-3xl border border-slate-700 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
                    <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6 border-b border-slate-700 pb-5 relative z-10">
                      <div>
                        <h3 className="font-black text-white text-lg flex items-center gap-2 mb-1"><Shield size={22} className="text-emerald-400"/> Kredensial Login User</h3>
                        <p className="text-xs text-slate-400">Pusat kendali Username dan Password staf.</p>
                      </div>
                      <div className="relative w-full md:w-72">
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input type="text" placeholder="Cari karyawan..." className="pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white focus:ring-emerald-500 w-full outline-none" value={credSearchQuery} onChange={e => setCredSearchQuery(e.target.value)} />
                      </div>
                    </div>
                    <div className="overflow-x-auto border border-slate-700 rounded-2xl shadow-lg relative z-10 bg-slate-800/50 max-h-[400px]">
                      <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
                        <thead className="bg-slate-800 text-slate-200 sticky top-0 shadow-sm z-20">
                          <tr><th className="p-4 border-b border-slate-700">Profil Karyawan</th><th className="p-4 border-b border-slate-700 text-center">ID Karyawan (Username)</th><th className="p-4 border-b border-slate-700 text-center">Password</th><th className="p-4 border-b border-slate-700 text-center">Aksi</th></tr>
                        </thead>
                        <tbody>
                          {credSearchResult.length === 0 ? (
                            <tr><td colSpan="4" className="p-10 text-center text-slate-500 italic">Karyawan tidak ditemukan.</td></tr>
                          ) : (
                            credSearchResult.map(p => (
                              <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                <td className="p-4">
                                  <span className="font-bold text-white text-base block">{p.nama}</span> 
                                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-emerald-400 uppercase tracking-wider border border-slate-600">{p.area} • {safeRoles.find(r=>r.id===p.role)?.name || p.role}</span>
                                </td>
                                {editingCredId === p.id ? (
                                  <>
                                    <td className="p-3 align-middle"><div className="flex justify-center"><input type="text" placeholder="Buat Username" className="bg-slate-900 border border-emerald-500/50 rounded-lg p-2.5 w-full md:w-3/4 text-white text-sm font-mono focus:ring-emerald-500 outline-none text-center shadow-inner" value={credFormData.idKaryawan} onChange={(e) => setCredFormData({...credFormData, idKaryawan: e.target.value})} /></div></td>
                                    <td className="p-3 align-middle"><div className="flex justify-center"><input type="text" placeholder="Buat Password" className="bg-slate-900 border border-emerald-500/50 rounded-lg p-2.5 w-full md:w-3/4 text-white text-sm focus:ring-emerald-500 outline-none text-center shadow-inner" value={credFormData.password} onChange={(e) => setCredFormData({...credFormData, password: e.target.value})} /></div></td>
                                    <td className="p-3 text-center align-middle space-x-2"><button onClick={handleSaveCred} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-lg transition-transform active:scale-95">Simpan</button><button onClick={() => setEditingCredId(null)} className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors">Batal</button></td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-4 text-center align-middle">{p.idKaryawan ? <span className="text-emerald-300 font-mono tracking-wider bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-800/50 select-all">{p.idKaryawan}</span> : <span className="text-slate-500 italic text-xs bg-slate-800 px-3 py-1 rounded-full border border-slate-700">Belum diset</span>}</td>
                                    <td className="p-4 text-center align-middle">{p.password ? <span className="text-slate-300 font-mono bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700 select-all">{p.password}</span> : <span className="text-slate-500 italic text-xs bg-slate-800 px-3 py-1 rounded-full border border-slate-700">Belum diset</span>}</td>
                                    <td className="p-4 text-center align-middle"><button onClick={() => handleEditCredClick(p)} className="text-emerald-400 hover:text-white hover:bg-emerald-600 flex items-center gap-1.5 mx-auto text-xs font-bold bg-slate-800 border border-slate-600 px-4 py-2 rounded-lg transition-all shadow-sm"><Edit size={14}/> Ubah Sandi</button></td>
                                  </>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 2: MANAJEMEN SMELTER */}
                {activeSettingTab === 'smelter' && (
                  <div className="bg-slate-900 p-5 md:p-6 rounded-3xl border border-slate-700 shadow-inner">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">Daftar Smelter / Area</h3>
                    <div className="flex gap-2 mb-6">
                      <input type="text" placeholder="Misal: Smelter G" className="flex-1 bg-slate-800 border border-slate-600 rounded-xl p-3 text-sm text-white focus:ring-emerald-500" value={newArea} onChange={e=>setNewArea(e.target.value)} />
                      <button onClick={handleAddArea} className="bg-emerald-600 hover:bg-emerald-500 px-6 rounded-xl text-white font-bold text-sm shadow">Tambah</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {safeAreas.map(area => (
                        <div key={area} className="bg-slate-800 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold text-emerald-400 border border-slate-700">
                          {area} <button onClick={() => handleDeleteArea(area)} className="text-red-400 hover:text-red-300 ml-1 bg-red-400/10 p-1 rounded-md"><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUB-TAB 3: MANAJEMEN INDIKATOR & TARGET KPI */}
                {activeSettingTab === 'kpi' && (
                  <div className="bg-slate-900 p-5 md:p-6 rounded-3xl border border-slate-700 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {safeRoles.filter(r => r.id === 'SO' || r.id === 'WFSO').map(r => (
                        <div key={r.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-600">
                          <h4 className="font-bold text-emerald-400 mb-4 border-b border-slate-700 pb-3 flex items-center gap-2"><span>KPI {r.name}</span></h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm mb-2 whitespace-nowrap">
                              <thead><tr className="text-slate-400 border-b border-slate-700"><th className="pb-3 px-1">Indikator</th><th className="pb-3 text-center px-1">Tipe</th><th className="pb-3 text-center px-1">Target</th><th className="pb-3 text-center px-1">Aksi</th></tr></thead>
                              <tbody>
                                {masterData.categories?.[r.id]?.map((cat, index) => (
                                  <tr key={cat.key} className="border-b border-slate-700/50 last:border-0">
                                    <td className="py-3 pr-2"><input type="text" className="bg-slate-700 border border-slate-600 rounded-lg p-2 w-full text-white text-xs focus:ring-emerald-500" value={cat.label} onChange={(e) => handleUpdateCategory(r.id, index, 'label', e.target.value)} /></td>
                                    <td className="py-3 px-2 text-center">
                                      <select className="bg-slate-700 border border-slate-600 rounded-lg p-2 text-white text-xs focus:ring-emerald-500" value={cat.isTargeted} onChange={(e) => handleUpdateCategory(r.id, index, 'isTargeted', e.target.value === 'true')}>
                                        <option value="true">Utama</option><option value="false">Extra</option>
                                      </select>
                                    </td>
                                    <td className="py-3 px-2 text-center"><input type="number" disabled={!cat.isTargeted} className={`w-16 bg-slate-700 border border-slate-600 rounded-lg p-2 text-center text-xs font-bold text-white focus:ring-emerald-500 ${!cat.isTargeted && 'opacity-30'}`} value={cat.target} onChange={(e) => handleUpdateCategory(r.id, index, 'target', e.target.value)} /></td>
                                    <td className="py-3 pl-2 text-center"><button onClick={() => handleDeleteCategory(r.id, index)} className="text-red-400 hover:text-white hover:bg-red-500 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-800 p-5 rounded-2xl border border-emerald-700/50 shadow-lg">
                      <h4 className="font-bold text-white mb-4 text-sm flex items-center gap-2 uppercase tracking-wide"><Plus size={16} className="text-emerald-400"/> Tambah Indikator Baru</h4>
                      <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
                        <div className="w-full md:flex-1"><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5">Jabatan</label>
                          <select className="w-full bg-slate-700 border border-slate-600 rounded-xl p-2.5 text-white text-sm focus:ring-emerald-500" value={newCatRole} onChange={e=>setNewCatRole(e.target.value)}>{safeRoles.filter(r => r.id === 'SO' || r.id === 'WFSO').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                        </div>
                        <div className="w-full md:flex-1"><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5">Nama Indikator</label><input type="text" placeholder="Misal: Patroli" className="w-full bg-slate-700 border border-slate-600 rounded-xl p-2.5 text-white text-sm focus:ring-emerald-500" value={newCatLabel} onChange={e=>setNewCatLabel(e.target.value)} /></div>
                        <div className="w-full md:w-32"><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5">Tipe</label>
                          <select className="w-full bg-slate-700 border border-slate-600 rounded-xl p-2.5 text-white text-sm focus:ring-emerald-500" value={newCatType} onChange={e=>setNewCatType(e.target.value)}><option value="target">Utama</option><option value="extra">Extra Poin</option></select>
                        </div>
                        {newCatType === 'target' && (
                          <div className="w-full md:w-24"><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5">Target</label><input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl p-2.5 text-white text-sm font-bold focus:ring-emerald-500" value={newCatTarget} onChange={e=>setNewCatTarget(e.target.value)} /></div>
                        )}
                        <button onClick={handleAddCategory} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow transition-colors mt-2 md:mt-0">Simpan</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </>
      )}

      {/* COMPONENT MODAL CUSTOM (ERROR TYPO EXCEL) */}
      {pasteErrors.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/75 flex items-center justify-center z-[110] p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600 border-b pb-2">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold">Nama Tidak Terdaftar!</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4 font-sans">
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
    </div>
  );
}

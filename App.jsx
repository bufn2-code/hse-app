import React, { useState, useEffect } from 'react';

import {
  CheckCircle,
  Trash2
} from 'lucide-react';

import { initializeApp } from 'firebase/app';

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';

// =====================================================
// FIREBASE CONFIG
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyAtEdHjdmC_MzMkb8Nmt07LU45xaYUsTg4",
  authDomain: "kpi-safety-officer.firebaseapp.com",
  projectId: "kpi-safety-officer",
  storageBucket: "kpi-safety-officer.firebasestorage.app",
  messagingSenderId: "741875026274",
  appId: "1:741875026274:web:cd11cd36a8da1b99cec43b"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const APP_ID = 'bufn2-kpi-app';

// =====================================================
// ERROR BOUNDARY
// =====================================================

class ErrorBoundary extends React.Component {

  constructor(props) {

    super(props);

    this.state = {
      hasError: false,
      error: null
    };

  }

  static getDerivedStateFromError(error) {

    return {
      hasError: true,
      error
    };

  }

  render() {

    if (this.state.hasError) {

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-10">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-xl w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Aplikasi Error
            </h1>

            <pre className="text-sm overflow-auto bg-red-100 p-4 rounded">
              {String(this.state.error)}
            </pre>
          </div>
        </div>
      );

    }

    return this.props.children;

  }

}

// =====================================================
// APP
// =====================================================

export default function App() {

  // =====================================================
  // STATE
  // =====================================================

  const [activeTab, setActiveTab] = useState('database');

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);

  const [errorMsg, setErrorMsg] = useState('');

  const [personnel, setPersonnel] = useState([]);

  const [weeklyData, setWeeklyData] = useState({});

  const [monthlyData, setMonthlyData] = useState({});

  const [newEmp, setNewEmp] = useState({
    nama: '',
    area: 'C',
    role: 'SO'
  });

  const [selectedRole, setSelectedRole] = useState('SO');

  const [selectedWeek, setSelectedWeek] = useState('w1');

  const [selectedIndicator, setSelectedIndicator] = useState('obs');

  const [pasteText, setPasteText] = useState('');

  // =====================================================
  // DATA
  // =====================================================

  const weeks = [
    { id: 'w1', label: 'Minggu 1' },
    { id: 'w2', label: 'Minggu 2' },
    { id: 'w3', label: 'Minggu 3' },
    { id: 'w4', label: 'Minggu 4' },
    { id: 'w5', label: 'Minggu 5' }
  ];

  const soCategories = [
    { key: 'obs', label: 'Observasi', target: 200 },
    { key: 'iden', label: 'Identifikasi', target: 16 },
    { key: 'st', label: 'Safety Talk', target: 8 },
    { key: 'ss', label: 'Safety Sharing', target: 28 },
    { key: 'si', label: 'Inspection', target: null },
    { key: 'ps', label: 'Pelatihan', target: null }
  ];

  const wfsoCategories = [
    { key: 'obs', label: 'Observasi', target: 140 },
    { key: 'iden', label: 'Identifikasi', target: 12 },
    { key: 'ste', label: 'Training External', target: 8 },
    { key: 'st', label: 'Safety Talk', target: 8 },
    { key: 'ss', label: 'Safety Sharing', target: 20 },
    { key: 'si', label: 'Inspection', target: null },
    { key: 'ps', label: 'Pelatihan', target: null }
  ];

  const getCategories = (role) => {

    return role === 'SO'
      ? soCategories
      : wfsoCategories;

  };

  // =====================================================
  // AUTH
  // =====================================================

  useEffect(() => {

    const login = async () => {

      try {

        await signInAnonymously(auth);

      } catch (err) {

        console.error(err);

        setErrorMsg(
          'Anonymous Auth belum aktif di Firebase Authentication'
        );

        setLoading(false);

      }

    };

    login();

    const unsub = onAuthStateChanged(auth, (u) => {

      setUser(u);

    });

    return () => unsub();

  }, []);

  // =====================================================
  // FIRESTORE
  // =====================================================

  useEffect(() => {

    if (!user) return;

    const personnelRef = collection(
      db,
      'artifacts',
      APP_ID,
      'public',
      'data',
      'personnel'
    );

    const weeklyRef = collection(
      db,
      'artifacts',
      APP_ID,
      'public',
      'data',
      'weeklyData'
    );

    const monthlyRef = collection(
      db,
      'artifacts',
      APP_ID,
      'public',
      'data',
      'monthlyData'
    );

    const unsubPersonnel = onSnapshot(

      personnelRef,

      (snapshot) => {

        const arr = [];

        snapshot.forEach((d) => {

          arr.push(d.data());

        });

        setPersonnel(arr);

        setLoading(false);

      },

      (err) => {

        console.error(err);

        setErrorMsg(
          'Firestore Rules menolak akses personnel'
        );

        setLoading(false);

      }

    );

    const unsubWeekly = onSnapshot(

      weeklyRef,

      (snapshot) => {

        const obj = {};

        snapshot.forEach((d) => {

          obj[d.id] = d.data();

        });

        setWeeklyData(obj);

      },

      (err) => {

        console.error(err);

        setErrorMsg(
          'Firestore Rules menolak akses weeklyData'
        );

        setLoading(false);

      }

    );

    const unsubMonthly = onSnapshot(

      monthlyRef,

      (snapshot) => {

        const obj = {};

        snapshot.forEach((d) => {

          obj[d.id] = d.data();

        });

        setMonthlyData(obj);

      },

      (err) => {

        console.error(err);

        setErrorMsg(
          'Firestore Rules menolak akses monthlyData'
        );

        setLoading(false);

      }

    );

    return () => {

      unsubPersonnel();
      unsubWeekly();
      unsubMonthly();

    };

  }, [user]);

  // =====================================================
  // PERSONNEL
  // =====================================================

  const handleAddPersonnel = async (e) => {

    e.preventDefault();

    if (!newEmp.nama.trim()) return;

    try {

      const id =
        Date.now().toString() +
        Math.random().toString(36).substring(2, 5);

      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        'personnel',
        id
      );

      await setDoc(ref, {
        ...newEmp,
        id
      });

      setNewEmp({
        nama: '',
        area: 'C',
        role: 'SO'
      });

    } catch (err) {

      console.error(err);

      alert('Gagal tambah pegawai');

    }

  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDeletePersonnel = async (id) => {

    const ok = window.confirm(
      'Hapus pegawai ini ?'
    );

    if (!ok) return;

    try {

      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        'personnel',
        id
      );

      await deleteDoc(ref);

    } catch (err) {

      console.error(err);

      alert('Gagal hapus pegawai');

    }

  };

  // =====================================================
  // PROCESS PASTE
  // =====================================================

  const handleProcessPaste = async () => {

    if (!pasteText.trim()) {

      alert('Paste data terlebih dahulu');

      return;

    }

    try {

      const lines = pasteText.split('\n');

      const updates = {};

      let success = 0;

      lines.forEach((line) => {

        const parts = line
          .split('\t')
          .map((p) => p.trim());

        if (parts.length < 2) return;

        const nama = parts[0];

        const nilai =
          parseFloat(parts[1]) || 0;

        const emp = personnel.find(
          (p) =>
            p.nama.toLowerCase() ===
              nama.toLowerCase() &&
            p.role === selectedRole
        );

        if (!emp) return;

        if (!updates[emp.id]) {

          updates[emp.id] = {};

        }

        if (!updates[emp.id][selectedWeek]) {

          updates[emp.id][selectedWeek] = {};

        }

        updates[emp.id][selectedWeek][selectedIndicator] = nilai;

        success++;

      });

      for (const empId of Object.keys(updates)) {

        const ref = doc(
          db,
          'artifacts',
          APP_ID,
          'public',
          'data',
          'weeklyData',
          empId
        );

        await setDoc(
          ref,
          updates[empId],
          {
            merge: true
          }
        );

      }

      setPasteText('');

      alert(
        `${success} data berhasil disimpan`
      );

    } catch (err) {

      console.error(err);

      alert('Gagal proses paste');

    }

  };

  // =====================================================
  // MONTHLY INPUT
  // =====================================================

  const handleMonthlyInput = async (
    empId,
    field,
    value
  ) => {

    try {

      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        'monthlyData',
        empId
      );

      await setDoc(
        ref,
        {
          [field]: value
        },
        {
          merge: true
        }
      );

    } catch (err) {

      console.error(err);

    }

  };

  // =====================================================
  // ACCUMULATE
  // =====================================================

  const getAccumulatedData = (
    empId,
    role
  ) => {

    const data =
      weeklyData[empId] || {};

    const total = {};

    getCategories(role).forEach((c) => {

      total[c.key] = 0;

    });

    Object.values(data).forEach((week) => {

      getCategories(role).forEach((c) => {

        total[c.key] +=
          week[c.key] || 0;

      });

    });

    return total;

  };

  // =====================================================
  // GRADE
  // =====================================================

  const calculateGrade = (
    score
  ) => {

    if (score >= 170) return 'A';

    if (score >= 141) return 'B';

    if (score >= 100) return 'C';

    return 'D';

  };

  // =====================================================
  // FILTER
  // =====================================================

  const filteredPersonnel =
    personnel.filter(
      (p) => p.role === selectedRole
    );

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (

      <div className="min-h-screen flex items-center justify-center bg-slate-100">

        <div className="text-center">

          <div className="animate-spin rounded-full h-24 w-24 border-b-4 border-emerald-700 mx-auto mb-5"></div>

          <p className="text-emerald-700 font-bold text-lg">
            Menghubungkan Database...
          </p>

        </div>

      </div>

    );

  }

  // =====================================================
  // ERROR
  // =====================================================

  if (errorMsg) {

    return (

      <div className="min-h-screen flex items-center justify-center bg-red-50 p-10">

        <div className="bg-white rounded-xl shadow-xl p-8 max-w-xl w-full">

          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Firebase Error
          </h1>

          <p className="mb-4 text-slate-700">
            {errorMsg}
          </p>

          <div className="bg-slate-100 p-4 rounded text-sm">

            <p className="font-bold mb-2">
              Pastikan:
            </p>

            <ul className="list-disc ml-5 space-y-1">

              <li>
                Anonymous Auth aktif
              </li>

              <li>
                Firestore Rules allow read/write
              </li>

              <li>
                Firestore Database sudah dibuat
              </li>

            </ul>

          </div>

        </div>

      </div>

    );

  }

  // =====================================================
  // UI
  // =====================================================

  return (

    <ErrorBoundary>

      <div className="min-h-screen bg-slate-100">

        {/* HEADER */}

        <header className="bg-emerald-800 text-white shadow-lg">

          <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">

            <div className="flex items-center gap-4">

              <CheckCircle
                size={40}
                className="text-emerald-300"
              />

              <div>

                <h1 className="text-2xl font-bold">
                  KPI HSE BUFN 2
                </h1>

                <p className="text-emerald-200 text-sm">
                  Firebase Cloud Connected
                </p>

              </div>

            </div>

            <div className="bg-emerald-900 px-4 py-2 rounded-lg text-xs font-bold">
              ONLINE
            </div>

          </div>

        </header>

        {/* MAIN */}

        <main className="max-w-7xl mx-auto p-6">

          {/* TAB */}

          <div className="flex gap-2 mb-6">

            <button
              onClick={() => setActiveTab('database')}
              className={`px-5 py-3 rounded-lg font-semibold ${
                activeTab === 'database'
                  ? 'bg-white shadow text-emerald-700'
                  : 'bg-slate-200'
              }`}
            >
              Database
            </button>

            <button
              onClick={() => setActiveTab('input')}
              className={`px-5 py-3 rounded-lg font-semibold ${
                activeTab === 'input'
                  ? 'bg-white shadow text-emerald-700'
                  : 'bg-slate-200'
              }`}
            >
              Input
            </button>

            <button
              onClick={() => setActiveTab('laporan')}
              className={`px-5 py-3 rounded-lg font-semibold ${
                activeTab === 'laporan'
                  ? 'bg-white shadow text-emerald-700'
                  : 'bg-slate-200'
              }`}
            >
              Laporan
            </button>

          </div>

          {/* DATABASE */}

          {activeTab === 'database' && (

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* FORM */}

              <div className="bg-white p-6 rounded-xl shadow">

                <h2 className="font-bold text-lg mb-4">
                  Tambah Pegawai
                </h2>

                <form
                  onSubmit={handleAddPersonnel}
                  className="space-y-4"
                >

                  <input
                    type="text"
                    placeholder="Nama Pegawai"
                    className="w-full border p-3 rounded-lg"
                    value={newEmp.nama}
                    onChange={(e) =>
                      setNewEmp({
                        ...newEmp,
                        nama: e.target.value
                      })
                    }
                  />

                  <select
                    className="w-full border p-3 rounded-lg"
                    value={newEmp.area}
                    onChange={(e) =>
                      setNewEmp({
                        ...newEmp,
                        area: e.target.value
                      })
                    }
                  >
                    <option value="C">
                      Area C
                    </option>

                    <option value="E">
                      Area E
                    </option>

                    <option value="F">
                      Area F
                    </option>
                  </select>

                  <select
                    className="w-full border p-3 rounded-lg"
                    value={newEmp.role}
                    onChange={(e) =>
                      setNewEmp({
                        ...newEmp,
                        role: e.target.value
                      })
                    }
                  >
                    <option value="SO">
                      Safety Officer
                    </option>

                    <option value="WFSO">
                      Wakil Foreman
                    </option>
                  </select>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg font-bold"
                  >
                    Tambah Pegawai
                  </button>

                </form>

              </div>

              {/* TABLE */}

              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow overflow-auto">

                <h2 className="font-bold text-lg mb-4">
                  Daftar Pegawai
                </h2>

                <table className="w-full text-sm">

                  <thead className="bg-slate-100">

                    <tr>

                      <th className="p-3 text-left">
                        Nama
                      </th>

                      <th className="p-3">
                        Area
                      </th>

                      <th className="p-3">
                        Role
                      </th>

                      <th className="p-3">
                        Hapus
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {personnel.map((p) => (

                      <tr
                        key={p.id}
                        className="border-b"
                      >

                        <td className="p-3">
                          {p.nama}
                        </td>

                        <td className="text-center">
                          {p.area}
                        </td>

                        <td className="text-center">
                          {p.role}
                        </td>

                        <td className="text-center">

                          <button
                            onClick={() =>
                              handleDeletePersonnel(
                                p.id
                              )
                            }
                            className="text-red-500"
                          >
                            <Trash2 size={18} />
                          </button>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          )}

        </main>

      </div>

    </ErrorBoundary>

  );

}

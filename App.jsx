import React, { useState, useEffect } from 'react';
import {
  Database,
  ClipboardPaste,
  Calculator,
  CheckCircle,
  AlertCircle,
  Info,
  Table,
  UserPlus,
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

// ======================================================
// FIREBASE CONFIG
// ======================================================

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

// ======================================================
// ERROR BOUNDARY
// ======================================================

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
        <div className="p-10 text-red-600">
          <h1 className="text-2xl font-bold mb-4">
            Aplikasi Error
          </h1>

          <pre className="bg-red-100 p-4 rounded">
            {String(this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// ======================================================
// APP
// ======================================================

export default function App() {

  const [activeTab, setActiveTab] = useState('database');

  const [user, setUser] = useState(null);

  const [isReady, setIsReady] = useState(false);

  // ======================================================
  // DATA
  // ======================================================

  const [personnel, setPersonnel] = useState([]);

  const [weeklyData, setWeeklyData] = useState({});

  const [monthlyData, setMonthlyData] = useState({});

  // ======================================================
  // INPUT
  // ======================================================

  const [newEmp, setNewEmp] = useState({
    nama: '',
    area: 'C',
    role: 'SO'
  });

  const [selectedRole, setSelectedRole] = useState('SO');

  const [selectedWeek, setSelectedWeek] = useState('w1');

  const [selectedIndicator, setSelectedIndicator] = useState('obs');

  const [pasteText, setPasteText] = useState('');

  // ======================================================
  // WEEKS
  // ======================================================

  const weeks = [
    { id: 'w1', label: 'Minggu 1' },
    { id: 'w2', label: 'Minggu 2' },
    { id: 'w3', label: 'Minggu 3' },
    { id: 'w4', label: 'Minggu 4' },
    { id: 'w5', label: 'Minggu 5' }
  ];

  // ======================================================
  // CATEGORY
  // ======================================================

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

  // ======================================================
  // AUTH
  // ======================================================

  useEffect(() => {

    const login = async () => {

      try {

        await signInAnonymously(auth);

      } catch (err) {

        console.error(err);

      }

    };

    login();

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => unsub();

  }, []);

  // ======================================================
  // FIRESTORE LISTENER
  // ======================================================

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

    const unsubPersonnel = onSnapshot(personnelRef, (snap) => {

      const arr = [];

      snap.forEach((d) => {

        arr.push(d.data());

      });

      setPersonnel(arr);

    });

    const unsubWeekly = onSnapshot(weeklyRef, (snap) => {

      const obj = {};

      snap.forEach((d) => {

        obj[d.id] = d.data();

      });

      setWeeklyData(obj);

    });

    const unsubMonthly = onSnapshot(monthlyRef, (snap) => {

      const obj = {};

      snap.forEach((d) => {

        obj[d.id] = d.data();

      });

      setMonthlyData(obj);

      setIsReady(true);

    });

    return () => {

      unsubPersonnel();
      unsubWeekly();
      unsubMonthly();

    };

  }, [user]);

  // ======================================================
  // ADD PERSONNEL
  // ======================================================

  const handleAddPersonnel = async (e) => {

    e.preventDefault();

    if (!newEmp.nama.trim()) return;

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

  };

  // ======================================================
  // DELETE PERSONNEL
  // ======================================================

  const handleDeletePersonnel = async (id) => {

    const ok = window.confirm(
      'Hapus pegawai ini?'
    );

    if (!ok) return;

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

  };

  // ======================================================
  // PROCESS PASTE
  // ======================================================

  const handleProcessPaste = async () => {

    if (!pasteText.trim()) {

      alert('Paste data terlebih dahulu');

      return;

    }

    const lines = pasteText.split('\n');

    const updates = {};

    let success = 0;

    let failed = [];

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

      if (!emp) {

        failed.push(nama);

        return;

      }

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

      await setDoc(ref, updates[empId], {
        merge: true
      });

    }

    setPasteText('');

    alert(
      `Berhasil: ${success}\nGagal: ${failed.length}`
    );

  };

  // ======================================================
  // MONTHLY INPUT
  // ======================================================

  const handleMonthlyInput = async (
    empId,
    field,
    value
  ) => {

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

  };

  // ======================================================
  // ACCUMULATE
  // ======================================================

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

  // ======================================================
  // GRADE
  // ======================================================

  const calculateGrade = (
    score,
    kepatuhan,
    ket
  ) => {

    const txt =
      (ket || '').toLowerCase();

    if (
      score >= 170 &&
      kepatuhan === 100
    ) {
      return 'A';
    }

    if (
      score >= 141 &&
      score <= 169 &&
      kepatuhan === 100
    ) {
      return 'B';
    }

    if (
      score >= 100 &&
      score <= 140
    ) {
      return 'C';
    }

    if (
      txt.includes('cuti') ||
      txt.includes('ijin')
    ) {
      return 'C';
    }

    return 'D';

  };

  // ======================================================
  // FILTER
  // ======================================================

  const filteredPersonnel =
    personnel.filter(
      (p) => p.role === selectedRole
    );

  // ======================================================
  // LOADING
  // ======================================================

  if (!isReady) {

    return (

      <div className="min-h-screen flex items-center justify-center bg-slate-100">

        <div className="text-center">

          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-emerald-700 mx-auto mb-5"></div>

          <p className="font-bold text-emerald-700">
            Menghubungkan Database...
          </p>

        </div>

      </div>

    );

  }

  // ======================================================
  // UI
  // ======================================================

  return (

    <ErrorBoundary>

      <div className="min-h-screen bg-slate-100">

        {/* HEADER */}

        <header className="bg-emerald-800 text-white shadow-lg">

          <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">

            <div className="flex items-center gap-3">

              <CheckCircle
                size={36}
                className="text-emerald-300"
              />

              <div>

                <h1 className="text-2xl font-bold">
                  KPI HSE BUFN 2
                </h1>

                <p className="text-sm text-emerald-200">
                  Firebase Cloud Connected
                </p>

              </div>

            </div>

            <div className="bg-emerald-900 px-4 py-2 rounded text-xs font-bold">
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

              <div className="bg-white rounded-xl p-6 shadow">

                <h2 className="font-bold text-lg mb-5">
                  Tambah Pegawai
                </h2>

                <form
                  onSubmit={handleAddPersonnel}
                  className="space-y-4"
                >

                  <input
                    type="text"
                    placeholder="Nama Pegawai"
                    className="w-full border rounded-lg p-3"
                    value={newEmp.nama}
                    onChange={(e) =>
                      setNewEmp({
                        ...newEmp,
                        nama: e.target.value
                      })
                    }
                  />

                  <select
                    className="w-full border rounded-lg p-3"
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
                    className="w-full border rounded-lg p-3"
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

              <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow overflow-auto">

                <h2 className="font-bold text-lg mb-5">
                  Daftar Pegawai
                </h2>

                <table className="w-full text-sm">

                  <thead className="bg-slate-100">

                    <tr>

                      <th className="text-left p-3">
                        Nama
                      </th>

                      <th className="p-3">
                        Area
                      </th>

                      <th className="p-3">
                        Role
                      </th>

                      <th className="p-3">
                        Aksi
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

          {/* INPUT */}

          {activeTab === 'input' && (

            <div className="bg-white rounded-xl p-6 shadow">

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                <div>

                  <h2 className="font-bold mb-4">
                    Input Mingguan
                  </h2>

                  <div className="space-y-4">

                    <select
                      className="w-full border p-3 rounded-lg"
                      value={selectedRole}
                      onChange={(e) =>
                        setSelectedRole(
                          e.target.value
                        )
                      }
                    >

                      <option value="SO">
                        SO
                      </option>

                      <option value="WFSO">
                        WFSO
                      </option>

                    </select>

                    <select
                      className="w-full border p-3 rounded-lg"
                      value={selectedWeek}
                      onChange={(e) =>
                        setSelectedWeek(
                          e.target.value
                        )
                      }
                    >

                      {weeks.map((w) => (

                        <option
                          key={w.id}
                          value={w.id}
                        >
                          {w.label}
                        </option>

                      ))}

                    </select>

                    <select
                      className="w-full border p-3 rounded-lg"
                      value={selectedIndicator}
                      onChange={(e) =>
                        setSelectedIndicator(
                          e.target.value
                        )
                      }
                    >

                      {getCategories(
                        selectedRole
                      ).map((c) => (

                        <option
                          key={c.key}
                          value={c.key}
                        >
                          {c.label}
                        </option>

                      ))}

                    </select>

                    <textarea
                      className="w-full border rounded-lg p-3 h-64 font-mono text-sm"
                      placeholder="Nama[TAB]Nilai"
                      value={pasteText}
                      onChange={(e) =>
                        setPasteText(
                          e.target.value
                        )
                      }
                    />

                    <button
                      onClick={
                        handleProcessPaste
                      }
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-lg"
                    >
                      Simpan Data
                    </button>

                  </div>

                </div>

                <div className="lg:col-span-2 overflow-auto">

                  <table className="w-full text-sm">

                    <thead className="bg-slate-100">

                      <tr>

                        <th className="p-3 text-left">
                          Nama
                        </th>

                        {getCategories(
                          selectedRole
                        ).map((c) => (

                          <th
                            key={c.key}
                            className="p-3"
                          >
                            {c.label}
                          </th>

                        ))}

                      </tr>

                    </thead>

                    <tbody>

                      {filteredPersonnel.map(
                        (p) => {

                          const data =
                            weeklyData[
                              p.id
                            ]?.[
                              selectedWeek
                            ] || {};

                          return (

                            <tr
                              key={p.id}
                              className="border-b"
                            >

                              <td className="p-3">
                                {p.nama}
                              </td>

                              {getCategories(
                                selectedRole
                              ).map((c) => (

                                <td
                                  key={c.key}
                                  className="text-center"
                                >
                                  {data[
                                    c.key
                                  ] || '-'}
                                </td>

                              ))}

                            </tr>

                          );

                        }
                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>

          )}

          {/* LAPORAN */}

          {activeTab === 'laporan' && (

            <div className="bg-white rounded-xl p-6 shadow overflow-auto">

              <h2 className="text-xl font-bold mb-6">
                Laporan KPI
              </h2>

              <table className="w-full text-sm">

                <thead className="bg-slate-800 text-white">

                  <tr>

                    <th className="p-3 text-left">
                      Nama
                    </th>

                    {getCategories(
                      selectedRole
                    ).map((c) => (

                      <th
                        key={c.key}
                        className="p-3"
                      >
                        {c.label}
                      </th>

                    ))}

                    <th className="p-3">
                      Pelanggaran
                    </th>

                    <th className="p-3">
                      Kepatuhan
                    </th>

                    <th className="p-3">
                      Skor
                    </th>

                    <th className="p-3">
                      Grade
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredPersonnel.map(
                    (p) => {

                      const acc =
                        getAccumulatedData(
                          p.id,
                          selectedRole
                        );

                      const monthly =
                        monthlyData[
                          p.id
                        ] || {};

                      const pelanggaran =
                        monthly.pelanggaran ||
                        0;

                      const kepatuhan =
                        monthly.kepatuhan ||
                        75;

                      const keterangan =
                        monthly.keterangan ||
                        '';

                      const total =
                        Object.values(acc)
                          .reduce(
                            (a, b) =>
                              a + b,
                            0
                          ) +
                        kepatuhan -
                        pelanggaran * 5;

                      const grade =
                        calculateGrade(
                          total,
                          kepatuhan,
                          keterangan
                        );

                      return (

                        <tr
                          key={p.id}
                          className="border-b"
                        >

                          <td className="p-3 font-semibold">
                            {p.nama}
                          </td>

                          {getCategories(
                            selectedRole
                          ).map((c) => (

                            <td
                              key={c.key}
                              className="text-center"
                            >
                              {acc[
                                c.key
                              ] || 0}
                            </td>

                          ))}

                          <td className="text-center">

                            <input
                              type="number"
                              className="border rounded p-1 w-20 text-center"
                              value={
                                pelanggaran
                              }
                              onChange={(
                                e
                              ) =>
                                handleMonthlyInput(
                                  p.id,
                                  'pelanggaran',
                                  parseInt(
                                    e
                                      .target
                                      .value
                                  ) || 0
                                )
                              }
                            />

                          </td>

                          <td className="text-center">

                            <select
                              className="border rounded p-1"
                              value={
                                kepatuhan
                              }
                              onChange={(
                                e
                              ) =>
                                handleMonthlyInput(
                                  p.id,
                                  'kepatuhan',
                                  parseInt(
                                    e
                                      .target
                                      .value
                                  )
                                )
                              }
                            >

                              <option value="25">
                                25
                              </option>

                              <option value="50">
                                50
                              </option>

                              <option value="75">
                                75
                              </option>

                              <option value="100">
                                100
                              </option>

                            </select>

                          </td>

                          <td className="text-center font-bold text-emerald-700">
                            {total}
                          </td>

                          <td className="text-center">

                            <span className="bg-emerald-600 text-white px-3 py-1 rounded-full font-bold">
                              {grade}
                            </span>

                          </td>

                        </tr>

                      );

                    }
                  )}

                </tbody>

              </table>

            </div>

          )}

        </main>

      </div>

    </ErrorBoundary>

  );

}

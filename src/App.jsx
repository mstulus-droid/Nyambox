import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ArrowLeft, Copy, ChevronRight, LogOut } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, provider, db } from './firebase.js';

const formatRupiah = (num) => {
  if (isNaN(num) || num === null || !isFinite(num)) return '0';
  return Math.round(num).toLocaleString('id-ID');
};

const roundUpTo = (num, to) => {
  if (to <= 0 || !isFinite(num)) return Math.round(num) || 0;
  return Math.ceil(num / to) * to;
};

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const toTitleCase = (str) => str.replace(/(^|\s)\S/g, (c) => c.toUpperCase());

const formatPriceInput = (val) => val ? Number(val).toLocaleString('id-ID') : '';

const initialSample = () => [{
  id: newId(),
  name: 'Nasi Ayam Goreng',
  ingredients: [
    { id: newId(), name: 'Ayam', price: '36000', portions: '12' },
    { id: newId(), name: 'Beras', price: '14000', portions: '8' },
    { id: newId(), name: 'Gas LPG', price: '30000', portions: '50' },
    { id: newId(), name: 'Kemasan (sendok, kardus, plastik)', price: '1000', portions: '1' },
  ],
  commission: 25,
  profit: 30,
  rounding: 500,
}];

const defaultMenu = () => ({
  id: newId(),
  name: '',
  ingredients: [{ id: newId(), name: '', price: '', portions: '' }],
  commission: 25,
  profit: 30,
  rounding: 500,
});

function calculateMenu(menu) {
  const cost = menu.ingredients.reduce((sum, ing) => {
    const price = parseFloat(ing.price) || 0;
    const portions = parseFloat(ing.portions) || 0;
    if (portions <= 0) return sum;
    return sum + price / portions;
  }, 0);

  const commission = (parseFloat(menu.commission) || 0) / 100;
  const profit = (parseFloat(menu.profit) || 0) / 100;
  const rounding = parseFloat(menu.rounding) || 0;

  let targetPrice = 0;
  if (commission < 1 && cost > 0) {
    targetPrice = (cost * (1 + profit)) / (1 - commission);
  }

  const sellingPrice = roundUpTo(targetPrice, rounding);
  const commissionAmount = sellingPrice * commission;
  const received = sellingPrice - commissionAmount;
  const actualProfit = received - cost;
  const actualProfitPct = cost > 0 ? (actualProfit / cost) * 100 : 0;
  const commissionValid = commission < 1;

  return {
    cost, sellingPrice, commissionAmount, received,
    actualProfit, actualProfitPct, commissionValid,
  };
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

  .ff-body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; }
  .ff-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .ff-display-italic { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-optical-sizing: auto; letter-spacing: -0.015em; }

  .bg-paper { background-color: #F6F0E3; }
  .bg-paper-warm { background-color: #F1E9D8; }
  .bg-surface { background-color: #FEFCF7; }
  .bg-ink { background-color: #1E1A15; }
  .bg-accent { background-color: #B04A2E; }
  .bg-accent-soft { background-color: #F4E0D0; }
  .bg-cream { background-color: #FAF4E6; }

  .text-ink { color: #1E1A15; }
  .text-ink-70 { color: #4A433A; }
  .text-ink-50 { color: #7A7366; }
  .text-ink-30 { color: #A8A194; }
  .text-accent { color: #B04A2E; }
  .text-cream { color: #F6F0E3; }
  .text-paper { color: #F6F0E3; }

  .border-ink-15 { border-color: #DFD8C6; }
  .border-ink-10 { border-color: #EBE4D2; }
  .border-accent { border-color: #B04A2E; }
  .border-cream-20 { border-color: rgba(246, 240, 227, 0.2); }

  .tabular { font-variant-numeric: tabular-nums; }

  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] { -moz-appearance: textfield; }

  select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='none' stroke='%237A7366' stroke-width='1.5' stroke-linecap='round' d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.85rem center;
    padding-right: 2.25rem;
  }

  .btn-press { transition: transform 0.1s ease, background-color 0.15s ease; }
  .btn-press:active { transform: scale(0.98); }

  .hover-lift { transition: border-color 0.2s ease, background-color 0.2s ease; }

  .hero-rule {
    background-image: linear-gradient(to right, transparent, rgba(246, 240, 227, 0.3) 20%, rgba(246, 240, 227, 0.3) 80%, transparent);
    height: 1px;
  }
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [menus, setMenus] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState('list');
  const [currentId, setCurrentId] = useState(null);
  const [isNewMenu, setIsNewMenu] = useState(false);
  const saveTimeout = useRef(null);
  const isSyncing = useRef(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) { setMenus([]); setLoaded(false); }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      isSyncing.current = true;
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.menus)) {
          setMenus(data.menus);
        } else {
          setMenus(initialSample());
        }
      } else {
        setMenus(initialSample());
      }
      setLoaded(true);
      setTimeout(() => { isSyncing.current = false; }, 0);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!loaded || !user || isSyncing.current) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      setDoc(doc(db, 'users', user.uid), { menus }).catch(() => {});
    }, 600);
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [menus, loaded, user]);

  const currentMenu = menus.find(m => m.id === currentId);

  const updateCurrent = (updater) => {
    setMenus(prev => prev.map(m => m.id === currentId ? updater(m) : m));
  };

  const addNewMenu = () => {
    const m = defaultMenu();
    const last = menus[menus.length - 1];
    if (last) {
      m.commission = last.commission;
      m.profit = last.profit;
      m.rounding = last.rounding;
    }
    setMenus(prev => [...prev, m]);
    setCurrentId(m.id);
    setIsNewMenu(true);
    setView('edit');
  };

  const deleteMenu = (id) => {
    setMenus(prev => prev.filter(m => m.id !== id));
    if (id === currentId) {
      setCurrentId(null);
      setView('list');
    }
  };

  const duplicateMenu = (id) => {
    const m = menus.find(mm => mm.id === id);
    if (!m) return;
    const copy = {
      ...m,
      id: newId(),
      name: (m.name || 'Menu') + ' (Salinan)',
      ingredients: m.ingredients.map(i => ({ ...i, id: newId() })),
    };
    setMenus(prev => [...prev, copy]);
    setCurrentId(copy.id);
    setView('edit');
  };

  const handleLogin = () => signInWithPopup(auth, provider).catch(() => {});
  const handleLogout = () => { signOut(auth); setView('list'); setCurrentId(null); };

  return (
    <>
      <style>{STYLES}</style>
      <div className="ff-body bg-paper text-ink min-h-screen">
        {authLoading ? (
          <div className="min-h-screen flex items-center justify-center">
            <p className="text-ink-50">Memuat...</p>
          </div>
        ) : !user ? (
          <LoginScreen onLogin={handleLogin} />
        ) : !loaded ? (
          <div className="min-h-screen flex items-center justify-center">
            <p className="text-ink-50">Sinkronisasi data...</p>
          </div>
        ) : view === 'edit' && currentMenu ? (
          <MenuEditor
            menu={currentMenu}
            onChange={updateCurrent}
            onBack={() => { setCurrentId(null); setView('list'); }}
            onDelete={() => deleteMenu(currentMenu.id)}
            autoFocusName={isNewMenu}
          />
        ) : (
          <MenuList
            menus={menus}
            user={user}
            onAdd={addNewMenu}
            onEdit={(id) => { setCurrentId(id); setIsNewMenu(false); setView('edit'); }}
            onDelete={deleteMenu}
            onDuplicate={duplicateMenu}
            onLogout={handleLogout}
          />
        )}
      </div>
    </>
  );
}

function LoginScreen({ onLogin }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-xs uppercase tracking-widest text-ink-50 mb-3">Untuk Shopee · Grab · Gojek</div>
      <h1 className="ff-display-italic text-4xl text-ink mb-2">Nyambox</h1>
      <p className="text-ink-50 text-sm mb-10">Kalkulator harga menu, tersimpan di cloud</p>
      <button
        onClick={onLogin}
        className="bg-ink text-cream font-semibold py-4 px-8 rounded-2xl flex items-center gap-3 btn-press shadow-lg shadow-ink/20"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
          <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
          <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
          <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
        </svg>
        Masuk dengan Google
      </button>
    </div>
  );
}

function MenuList({ menus, user, onAdd, onEdit, onDelete, onDuplicate, onLogout }) {
  return (
    <div className="min-h-screen">
      <header className="bg-paper border-b border-ink-15 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-5 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-50 mb-1">Untuk Shopee · Grab · Gojek</div>
            <h1 className="ff-display-italic text-3xl text-ink">Kalkulator Harga Menu</h1>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-ink-50 text-xs mt-1 px-2 py-1.5 rounded-lg btn-press hover:bg-paper-warm"
            title={user?.displayName}
          >
            {user?.photoURL && <img src={user.photoURL} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />}
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        {menus.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="ff-display text-5xl text-ink mb-3">Rp —</div>
            <p className="text-ink-70 font-medium mb-1">Belum ada menu</p>
            <p className="text-sm text-ink-50">Tap tombol di bawah untuk menambah menu pertama</p>
          </div>
        ) : (
          <div className="space-y-3">
            {menus.map(menu => {
              const calc = calculateMenu(menu);
              return (
                <div key={menu.id} className="bg-surface rounded-2xl border border-ink-15 overflow-hidden hover-lift">
                  <button onClick={() => onEdit(menu.id)} className="w-full text-left p-5 btn-press">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink text-base mb-1 truncate">
                          {menu.name || <span className="text-ink-30 italic">Menu tanpa nama</span>}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-ink-50">
                          <span>{menu.ingredients.length} bahan</span>
                          <span className="text-ink-30">·</span>
                          <span>Modal <span className="tabular text-ink-70 font-medium">Rp {formatRupiah(calc.cost)}</span></span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] uppercase tracking-widest text-ink-50 mb-0.5">Jual</div>
                        <div className="ff-display text-2xl text-accent tabular">Rp {formatRupiah(calc.sellingPrice)}</div>
                      </div>
                    </div>
                    {calc.cost > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="inline-flex items-center gap-1 bg-accent-soft text-accent px-2 py-1 rounded-full font-medium">
                          Untung {calc.actualProfitPct.toFixed(0)}%
                        </div>
                        <div className="text-ink-50">
                          Diterima <span className="tabular font-medium text-ink-70">Rp {formatRupiah(calc.received)}</span>
                        </div>
                      </div>
                    )}
                  </button>
                  <div className="flex border-t border-ink-10">
                    <button
                      onClick={() => onEdit(menu.id)}
                      className="flex-1 text-sm py-3 text-ink-70 font-medium btn-press hover:bg-paper-warm flex items-center justify-center gap-1.5"
                    >
                      Edit <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px bg-ink-10"></div>
                    <button
                      onClick={() => onDuplicate(menu.id)}
                      className="px-4 text-sm py-3 text-ink-70 btn-press hover:bg-paper-warm"
                      aria-label="Salin"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <div className="w-px bg-ink-10"></div>
                    <button
                      onClick={() => {
                        if (window.confirm('Hapus "' + (menu.name || 'menu tanpa nama') + '"?')) onDelete(menu.id);
                      }}
                      className="px-4 text-sm py-3 text-accent btn-press hover:bg-accent-soft"
                      aria-label="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 pointer-events-none pt-8 pb-5" style={{background: 'linear-gradient(to top, #F6F0E3 40%, rgba(246,240,227,0) 100%)'}}>
        <div className="max-w-2xl mx-auto px-5 pointer-events-auto">
          <button
            onClick={onAdd}
            className="w-full bg-ink text-cream font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 btn-press shadow-lg shadow-ink/20"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
            Tambah Menu Baru
          </button>
        </div>
      </div>
      <div className="h-28"></div>
    </div>
  );
}

function MenuEditor({ menu, onChange, onBack, onDelete, autoFocusName }) {
  const calc = calculateMenu(menu);
  const nameInputRef = useRef(null);
  const [focusIngId, setFocusIngId] = useState(null);

  useEffect(() => {
    if (autoFocusName) nameInputRef.current?.focus();
  }, [autoFocusName]);

  const updateField = (field, value) => onChange(m => ({ ...m, [field]: value }));

  const updateIngredient = (ingId, field, value) => {
    onChange(m => ({
      ...m,
      ingredients: m.ingredients.map(ing =>
        ing.id === ingId ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  const addIngredient = () => {
    const newIng = { id: newId(), name: '', price: '', portions: '' };
    onChange(m => ({
      ...m,
      ingredients: [...m.ingredients, newIng],
    }));
    setFocusIngId(newIng.id);
  };

  const removeIngredient = (ingId) => {
    onChange(m => ({
      ...m,
      ingredients: m.ingredients.filter(ing => ing.id !== ingId),
    }));
  };

  return (
    <div className="min-h-screen pb-10">
      <header className="bg-paper border-b border-ink-15 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1 text-ink font-medium px-2 py-1.5 rounded-lg btn-press">
            <ArrowLeft className="w-5 h-5" />
            <span>Semua Menu</span>
          </button>
          <div className="text-[11px] uppercase tracking-widest text-ink-50">Tersimpan</div>
          <button
            onClick={() => { if (window.confirm('Hapus menu ini?')) onDelete(); }}
            className="text-accent p-2 rounded-lg btn-press"
            aria-label="Hapus"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-5 space-y-4">
        <div className="bg-surface rounded-2xl p-5 border border-ink-15">
          <label className="block text-[11px] font-semibold text-ink-50 mb-1.5 uppercase tracking-widest">Nama Menu</label>
          <input
            ref={nameInputRef}
            type="text"
            value={menu.name}
            onChange={(e) => updateField('name', toTitleCase(e.target.value))}
            placeholder="Contoh: Nasi Ayam Goreng"
            className="ff-display w-full text-2xl text-ink outline-none bg-transparent placeholder:text-ink-30 placeholder:italic"
          />
        </div>

        <div className="bg-surface rounded-2xl border border-ink-15 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-10 flex items-center justify-between">
            <h2 className="ff-display text-lg text-ink">Bahan-Bahan</h2>
            <span className="text-xs text-ink-50 tabular">{menu.ingredients.length} item</span>
          </div>
          <div className="divide-y divide-ink-10">
            {menu.ingredients.map((ing, idx) => {
              const price = parseFloat(ing.price) || 0;
              const portions = parseFloat(ing.portions) || 0;
              const perPortion = portions > 0 ? price / portions : 0;
              return (
                <div key={ing.id} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="ff-display text-sm text-ink-30 w-5 tabular">{idx + 1}</span>
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                      placeholder="Nama bahan"
                      className="flex-1 font-medium text-ink outline-none bg-transparent placeholder:text-ink-30"
                      ref={(el) => {
                        if (el && focusIngId === ing.id) {
                          el.focus();
                          setFocusIngId(null);
                        }
                      }}
                    />
                    {menu.ingredients.length > 1 && (
                      <button
                        onClick={() => removeIngredient(ing.id)}
                        className="text-ink-30 hover:text-accent p-1.5 -mr-1 rounded btn-press"
                        aria-label="Hapus bahan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-ink-50 mb-1 font-medium">Harga Beli</label>
                      <div className="flex items-center bg-cream rounded-xl px-3 py-2.5 border border-ink-15 focus-within:border-accent transition-colors">
                        <span className="text-ink-50 text-sm mr-1.5">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatPriceInput(ing.price)}
                          onChange={(e) => updateIngredient(ing.id, 'price', e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="0"
                          className="w-full bg-transparent outline-none text-ink tabular font-medium"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-ink-50 mb-1 font-medium">Untuk</label>
                      <div className="flex items-center bg-cream rounded-xl px-3 py-2.5 border border-ink-15 focus-within:border-accent transition-colors">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={ing.portions}
                          onChange={(e) => updateIngredient(ing.id, 'portions', e.target.value)}
                          placeholder="0"
                          className="w-full bg-transparent outline-none text-ink tabular font-medium"
                        />
                        <span className="text-ink-50 text-sm ml-1.5">porsi</span>
                      </div>
                    </div>
                  </div>
                  {perPortion > 0 && (
                    <div className="mt-2.5 flex items-center justify-end gap-1.5 text-xs">
                      <span className="text-ink-50">Per porsi</span>
                      <span className="ff-display text-sm text-ink tabular font-medium">Rp {formatRupiah(perPortion)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={addIngredient}
            className="w-full py-3.5 text-accent font-semibold text-sm border-t border-ink-10 hover:bg-accent-soft flex items-center justify-center gap-1.5 btn-press"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Tambah Bahan
          </button>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-ink-15 space-y-4">
          <h2 className="ff-display text-lg text-ink">Pengaturan Harga</h2>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-ink">Komisi Aplikasi</label>
              <span className="text-[11px] text-ink-50 uppercase tracking-wider">Shopee/Grab/Gojek</span>
            </div>
            <div className="flex items-center bg-cream rounded-xl px-3 py-2.5 border border-ink-15 focus-within:border-accent transition-colors">
              <input
                type="number"
                inputMode="decimal"
                value={menu.commission}
                onChange={(e) => updateField('commission', e.target.value)}
                className="w-full bg-transparent outline-none text-ink tabular font-medium"
              />
              <span className="text-ink-50 text-sm ml-1">%</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-ink">Target Keuntungan</label>
              <span className="text-[11px] text-ink-50 uppercase tracking-wider">% dari modal</span>
            </div>
            <div className="flex items-center bg-cream rounded-xl px-3 py-2.5 border border-ink-15 focus-within:border-accent transition-colors">
              <input
                type="number"
                inputMode="decimal"
                value={menu.profit}
                onChange={(e) => updateField('profit', e.target.value)}
                className="w-full bg-transparent outline-none text-ink tabular font-medium"
              />
              <span className="text-ink-50 text-sm ml-1">%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Pembulatan Harga</label>
            <select
              value={menu.rounding}
              onChange={(e) => updateField('rounding', parseInt(e.target.value))}
              className="w-full bg-cream rounded-xl px-3 py-2.5 border border-ink-15 text-ink outline-none font-medium"
            >
              <option value={0}>Tanpa pembulatan</option>
              <option value={100}>Bulatkan ke Rp 100</option>
              <option value={500}>Bulatkan ke Rp 500</option>
              <option value={1000}>Bulatkan ke Rp 1.000</option>
            </select>
          </div>
        </div>

        {!calc.commissionValid ? (
          <div className="bg-accent-soft border border-accent rounded-2xl p-5 text-accent">
            <p className="font-semibold mb-1">Komisi tidak valid</p>
            <p className="text-sm text-ink-70">Komisi aplikasi harus di bawah 100% untuk menghitung harga jual.</p>
          </div>
        ) : calc.cost === 0 ? (
          <div className="bg-surface border border-dashed border-ink-15 rounded-2xl p-8 text-center">
            <div className="ff-display text-3xl text-ink-30 mb-2">Rp —</div>
            <p className="text-sm text-ink-50">Isi bahan-bahan untuk melihat harga jual</p>
          </div>
        ) : (
          <div className="bg-ink rounded-2xl p-6 text-cream shadow-xl shadow-ink/20 relative overflow-hidden">
            <div className="text-[11px] uppercase tracking-widest text-cream opacity-70 mb-2">Harga Jual Rekomendasi</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="ff-display text-sm opacity-70">Rp</span>
              <span className="ff-display text-6xl font-medium tabular leading-none">{formatRupiah(calc.sellingPrice)}</span>
            </div>
            <div className="text-xs text-cream opacity-60 mb-5">per porsi</div>

            <div className="hero-rule mb-4"></div>

            <div className="space-y-2.5 text-sm">
              <Row label="Modal (HPP) per porsi" value={'Rp ' + formatRupiah(calc.cost)} />
              <Row label={'Komisi aplikasi (' + (parseFloat(menu.commission) || 0) + '%)'} value={'− Rp ' + formatRupiah(calc.commissionAmount)} muted />
              <Row label="Uang diterima dari aplikasi" value={'Rp ' + formatRupiah(calc.received)} />
            </div>

            <div className="hero-rule my-4"></div>

            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest opacity-70">Untung Bersih</div>
                <div className="ff-display text-2xl tabular mt-0.5">Rp {formatRupiah(calc.actualProfit)}</div>
              </div>
              <div className="bg-accent rounded-full px-3 py-1.5 text-sm font-semibold">
                {calc.actualProfitPct.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[11px] uppercase tracking-widest text-ink-30 pt-2">
          Rumus: Modal × (1 + Untung%) ÷ (1 − Komisi%)
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className={'ff-body ' + (muted ? 'opacity-60' : 'opacity-80')}>{label}</span>
      <span className="ff-display tabular font-medium whitespace-nowrap">{value}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   NUMIRA — APP.JS  |  Supabase Edition
   Auth: Supabase Auth (email/password)
   Data: PostgreSQL via Supabase RLS
   ════════════════════════════════════════════════════ */

'use strict';

// ── Supabase client ─────────────────────────────────
let db;
try {
  const { createClient } = window.supabase;
  db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Supabase init failed:', e);
}

// ══════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════

const CATEGORIES = [
  { id: 'food',      emoji: '🍔', label: 'Comida',    color: '#fb923c' },
  { id: 'home',      emoji: '🏠', label: 'Hogar',     color: '#60a5fa' },
  { id: 'health',    emoji: '💊', label: 'Salud',     color: '#34d399' },
  { id: 'fun',       emoji: '🎮', label: 'Ocio',      color: '#a78bfa' },
  { id: 'work',      emoji: '💼', label: 'Trabajo',   color: '#818cf8' },
  { id: 'travel',    emoji: '✈️', label: 'Viaje',     color: '#22d3ee' },
  { id: 'shopping',  emoji: '🛒', label: 'Compras',   color: '#f472b6' },
  { id: 'education', emoji: '📚', label: 'Educación', color: '#fbbf24' },
  { id: 'services',  emoji: '⚡', label: 'Servicios', color: '#f87171' },
  { id: 'other',     emoji: '➕', label: 'Otro',      color: '#9ca3af' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$',   name: 'Dólar estadounidense', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€',   name: 'Euro',                 flag: '🇪🇺' },
  { code: 'VES', symbol: 'Bs.', name: 'Bolívar venezolano',   flag: '🇻🇪' },
  { code: 'MXN', symbol: '$',   name: 'Peso mexicano',        flag: '🇲🇽' },
  { code: 'COP', symbol: '$',   name: 'Peso colombiano',      flag: '🇨🇴' },
  { code: 'ARS', symbol: '$',   name: 'Peso argentino',       flag: '🇦🇷' },
  { code: 'CLP', symbol: '$',   name: 'Peso chileno',         flag: '🇨🇱' },
  { code: 'PEN', symbol: 'S/',  name: 'Sol peruano',          flag: '🇵🇪' },
  { code: 'BRL', symbol: 'R$',  name: 'Real brasileño',       flag: '🇧🇷' },
];

const MONTHS_ES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ══════════════════════════════════════════════════════
// AUTH MODULE
// ══════════════════════════════════════════════════════

const Auth = {

  _user: null,

  async getUser() {
    if (this._user) return this._user;
    const { data: { user } } = await db.auth.getUser();
    this._user = user;
    return user;
  },

  clearCache() { this._user = null; },

  async register(event) {
    event.preventDefault();
    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim().toLowerCase();
    const currency = document.getElementById('reg-currency').value;
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('register-error');
    errEl.classList.add('hidden');

    if (!name || !email || !password) {
      UI.showFieldError(errEl, 'Completa todos los campos.'); return;
    }
    if (password.length < 6) {
      UI.showFieldError(errEl, 'La contraseña debe tener al menos 6 caracteres.'); return;
    }

    const btn = document.getElementById('btn-register');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creando...';

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { display_name: name, currency } }
    });

    btn.disabled = false;
    btn.querySelector('span').textContent = 'Crear cuenta';

    if (error) {
      UI.showFieldError(errEl, this._translateError(error.message));
      return;
    }

    if (data.user && !data.session) {
      errEl.style.background  = 'rgba(52,211,153,0.1)';
      errEl.style.borderColor = 'rgba(52,211,153,0.3)';
      errEl.style.color       = '#34d399';
      errEl.textContent       = 'Revisa tu email para confirmar tu cuenta 📧';
      errEl.classList.remove('hidden');
    }
  },

  async login(event) {
    event.preventDefault();
    const email    = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.classList.add('hidden');

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Entrando...';

    const { error } = await db.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.querySelector('span').textContent = 'Entrar';

    if (error) UI.showFieldError(errEl, this._translateError(error.message));
  },

  async logout() {
    this.clearCache();
    await db.auth.signOut();
  },

  async deleteAccount() {
    const user = await this.getUser();
    if (!user) return;
    await db.from('transactions').delete().eq('user_id', user.id);
    this.clearCache();
    await db.auth.signOut();
    UI.closeDeleteModal();
  },

  _translateError(msg) {
    if (!msg) return 'Error desconocido.';
    if (msg.includes('Invalid login'))       return 'Email o contraseña incorrectos.';
    if (msg.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.';
    if (msg.includes('already registered')) return 'Este email ya está registrado.';
    if (msg.includes('Password should'))    return 'La contraseña debe tener al menos 6 caracteres.';
    if (msg.includes('Unable to validate')) return 'Email inválido.';
    return msg;
  }
};

// ══════════════════════════════════════════════════════
// DATA MODULE — Supabase PostgreSQL
// ══════════════════════════════════════════════════════

const Data = {

  async getAll() {
    const { data, error } = await db
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  },

  async getByMonth(year, month) {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end   = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const { data, error } = await db
      .from('transactions')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  },

  async getMonthSummary(year, month) {
    const txs     = await this.getByMonth(year, month);
    const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, balance: income - expense, txs };
  },

  async getLast6MonthsSummary() {
    const now    = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d       = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const summary = await this.getMonthSummary(d.getFullYear(), d.getMonth());
      result.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTHS_SHORT[d.getMonth()], ...summary });
    }
    return result;
  },

  async getCategoryBreakdown(year, month) {
    const txs   = (await this.getByMonth(year, month)).filter(t => t.type === 'expense');
    const total = txs.reduce((s, t) => s + Number(t.amount), 0);
    const map   = {};
    txs.forEach(t => { map[t.category] = (map[t.category] || 0) + Number(t.amount); });
    return Object.entries(map)
      .map(([catId, amount]) => {
        const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES.at(-1);
        return { ...cat, amount, pct: total > 0 ? (amount / total) * 100 : 0 };
      })
      .sort((a, b) => b.amount - a.amount);
  },

  async add(tx) {
    const user = await Auth.getUser();
    if (!user) return null;
    const { data, error } = await db
      .from('transactions')
      .insert([{ ...tx, user_id: user.id }])
      .select()
      .single();
    if (error) { console.error(error); return null; }
    return data;
  },

  async update(id, updates) {
    const { data, error } = await db
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error(error); return null; }
    return data;
  },

  async delete(id) {
    const { error } = await db
      .from('transactions')
      .delete()
      .eq('id', id);
    if (error) console.error(error);
  },

  async saveTransaction() {
    const id       = document.getElementById('tx-edit-id').value;
    const type     = document.getElementById('type-income').classList.contains('active') ? 'income' : 'expense';
    const amount   = parseFloat(document.getElementById('tx-amount').value);
    const desc     = document.getElementById('tx-desc').value.trim();
    const date     = document.getElementById('tx-date').value;
    const category = UI.selectedCategory;

    if (!amount || amount <= 0) { UI.toast('Ingresa un monto válido', 'error'); return; }
    if (!desc)                  { UI.toast('Agrega una descripción', 'error'); return; }
    if (!category)              { UI.toast('Selecciona una categoría', 'error'); return; }
    if (!date)                  { UI.toast('Selecciona una fecha', 'error'); return; }

    const btn = document.getElementById('btn-save-tx');
    btn.disabled = true;
    const txData = { type, amount, description: desc, category, date };

    if (id) {
      await Data.update(id, txData);
      UI.toast('Transacción actualizada ✓', 'success');
    } else {
      await Data.add(txData);
      UI.toast(`${type === 'income' ? 'Ingreso' : 'Gasto'} registrado ✓`, 'success');
    }

    btn.disabled = false;
    UI.closeModal();
    UI.refreshAll();
  }
};

// ══════════════════════════════════════════════════════
// UI MODULE
// ══════════════════════════════════════════════════════

const UI = {

  currentPage:      'dashboard',
  currentFilter:    'all',
  currentMonth:     new Date().getMonth(),
  currentYear:      new Date().getFullYear(),
  selectedCategory: null,
  _modalOpen:       false,

  // ── Init ──────────────────────────────────────────

  init() {
    db.auth.onAuthStateChange((event, session) => {
      Auth.clearCache();
      if (session) this.showApp();
      else         this.showAuth();
    });

    db.auth.getSession().then(({ data: { session } }) => {
      if (session) this.showApp();
      else         this.showAuth();
    });
  },

  showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.switchAuthTab('login');
  },

  async showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    this.buildCategoryGrid();
    await this.navigate('dashboard');
    this.updateProfileView();
  },

  // ── Auth Tabs ─────────────────────────────────────

  switchAuthTab(tab) {
    const loginEl    = document.getElementById('panel-login');
    const registerEl = document.getElementById('panel-register');
    const tabLogin   = document.getElementById('tab-login');
    const tabReg     = document.getElementById('tab-register');
    const indicator  = document.querySelector('.auth-tab-indicator');

    if (tab === 'login') {
      loginEl.classList.remove('hidden'); registerEl.classList.add('hidden');
      tabLogin.classList.add('active'); tabLogin.setAttribute('aria-selected', 'true');
      tabReg.classList.remove('active'); tabReg.setAttribute('aria-selected', 'false');
      indicator.classList.remove('right');
    } else {
      loginEl.classList.add('hidden'); registerEl.classList.remove('hidden');
      tabLogin.classList.remove('active'); tabLogin.setAttribute('aria-selected', 'false');
      tabReg.classList.add('active'); tabReg.setAttribute('aria-selected', 'true');
      indicator.classList.add('right');
    }
  },

  showFieldError(el, msg) {
    el.textContent = msg;
    el.style = '';
    if (msg) el.classList.remove('hidden');
    else     el.classList.add('hidden');
  },

  togglePassword(inputId, btn) {
    const input    = document.getElementById(inputId);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.innerHTML = isHidden
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  },

  // ── Navigation ────────────────────────────────────

  async navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');
    const navEl = document.getElementById(`nav-${page}`);
    if (navEl) navEl.classList.add('active');

    this.currentPage = page;

    if (page === 'dashboard')    await this.renderDashboard();
    if (page === 'transactions') await this.renderTransactions();
    if (page === 'stats')        await this.renderStats();
    if (page === 'profile')      this.updateProfileView();
  },

  async refreshAll() {
    if (this.currentPage === 'dashboard')    await this.renderDashboard();
    if (this.currentPage === 'transactions') await this.renderTransactions();
    if (this.currentPage === 'stats')        await this.renderStats();
  },

  // ── Skeleton ──────────────────────────────────────

  _skeleton(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div class="skeleton-list">
        ${Array(3).fill(`<div class="skeleton-item"><div class="skeleton-circle"></div><div class="skeleton-lines"><div class="skeleton-line w70"></div><div class="skeleton-line w40"></div></div><div class="skeleton-line w20"></div></div>`).join('')}
      </div>`;
  },

  // ── Dashboard ─────────────────────────────────────

  async renderDashboard() {
    const user = await Auth.getUser();
    if (!user) return;

    const now       = new Date();
    const meta      = user.user_metadata || {};
    const currency  = this.getCurrencySymbol(meta.currency || 'USD');
    const firstName = (meta.display_name || user.email || 'Usuario').split(' ')[0];

    const hour = now.getHours();
    document.getElementById('dash-greeting').textContent =
      hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    document.getElementById('dash-name').textContent            = `${firstName} 👋`;
    document.getElementById('dash-avatar-letter').textContent   = firstName[0].toUpperCase();
    document.getElementById('dash-period').textContent          = `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`;
    document.getElementById('modal-currency-symbol').textContent = currency;

    this._skeleton('dash-recent');

    const { income, expense, balance } = await Data.getMonthSummary(now.getFullYear(), now.getMonth());
    document.getElementById('dash-balance').textContent  = this.formatMoney(balance,  currency);
    document.getElementById('dash-income').textContent   = this.formatMoney(income,   currency);
    document.getElementById('dash-expense').textContent  = this.formatMoney(expense,  currency);

    Charts.drawDonut('donut-chart', income, expense);
    const pct = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
    document.getElementById('donut-pct').textContent = pct !== null ? `${Math.max(0, pct)}%` : '—';

    const allTx     = await Data.getAll();
    const container = document.getElementById('dash-recent');
    if (allTx.length === 0) {
      container.innerHTML = `<div class="empty-state glass"><span class="empty-icon">💸</span><p>Aún no hay transacciones</p><small>Toca + para agregar tu primera</small></div>`;
    } else {
      container.innerHTML = allTx.slice(0, 5).map(tx => this.renderTxItem(tx, currency)).join('');
    }
  },

  // ── Transactions ──────────────────────────────────

  async renderTransactions() {
    const user = await Auth.getUser();
    if (!user) return;
    const currency = this.getCurrencySymbol((user.user_metadata || {}).currency || 'USD');

    document.getElementById('month-label').textContent = `${MONTHS_ES[this.currentMonth]} ${this.currentYear}`;
    this._skeleton('tx-list');

    let txs = await Data.getByMonth(this.currentYear, this.currentMonth);
    if (this.currentFilter !== 'all') txs = txs.filter(t => t.type === this.currentFilter);

    const searchTerm = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (searchTerm) {
      txs = txs.filter(t =>
        t.description.toLowerCase().includes(searchTerm) ||
        (CATEGORIES.find(c => c.id === t.category)?.label || '').toLowerCase().includes(searchTerm)
      );
    }

    const container = document.getElementById('tx-list');
    if (txs.length === 0) {
      container.innerHTML = `<div class="empty-state glass"><span class="empty-icon">🔍</span><p>Sin transacciones</p><small>Intenta cambiar el filtro o mes</small></div>`;
      return;
    }

    const grouped = {};
    txs.forEach(tx => {
      if (!grouped[tx.date]) grouped[tx.date] = { date: new Date(tx.date + 'T00:00:00'), txs: [] };
      grouped[tx.date].txs.push(tx);
    });

    let html = '';
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(dateKey => {
      const { date, txs: dayTxs } = grouped[dateKey];
      const today     = new Date(); today.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      let label;
      if (date.toDateString() === today.toDateString())          label = 'Hoy';
      else if (date.toDateString() === yesterday.toDateString()) label = 'Ayer';
      else label = `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
      html += `<div class="tx-date-group">${label}</div>`;
      html += dayTxs.map(tx => this.renderTxItem(tx, currency)).join('');
    });
    container.innerHTML = html;
  },

  renderTxItem(tx, currency) {
    const cat  = CATEGORIES.find(c => c.id === tx.category) || CATEGORIES.at(-1);
    const sign = tx.type === 'income' ? '+' : '-';
    const d    = new Date(tx.date + 'T00:00:00');
    return `
      <div class="tx-item glass" onclick="UI.openEditModal('${tx.id}')">
        <div class="tx-emoji">${cat.emoji}</div>
        <div class="tx-info">
          <div class="tx-desc">${this.escapeHtml(tx.description)}</div>
          <div class="tx-meta">
            <span>${cat.label}</span>
            <span class="tx-dot"></span>
            <span>${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}</span>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${this.formatMoney(Number(tx.amount), currency)}</div>
      </div>`;
  },

  setFilter(filter, btn) {
    this.currentFilter = filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    this.renderTransactions();
  },

  changeMonth(delta) {
    this.currentMonth += delta;
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    if (this.currentMonth < 0)  { this.currentMonth = 11; this.currentYear--; }
    this.renderTransactions();
  },

  toggleSearch() {
    const bar = document.getElementById('search-bar');
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) document.getElementById('search-input').focus();
    else { document.getElementById('search-input').value = ''; this.renderTransactions(); }
  },

  clearSearch() {
    document.getElementById('search-input').value = '';
    this.renderTransactions();
  },

  // ── Statistics ────────────────────────────────────

  async renderStats() {
    const user = await Auth.getUser();
    if (!user) return;
    const currency = this.getCurrencySymbol((user.user_metadata || {}).currency || 'USD');
    const now      = new Date();

    const [data6, breakdown, allTx] = await Promise.all([
      Data.getLast6MonthsSummary(),
      Data.getCategoryBreakdown(now.getFullYear(), now.getMonth()),
      Data.getAll()
    ]);

    Charts.drawBars('bar-chart', data6, currency);

    const catContainer = document.getElementById('category-breakdown');
    if (breakdown.length === 0) {
      catContainer.innerHTML = `<div class="empty-state glass" style="padding:24px"><span class="empty-icon">📭</span><p>Sin gastos este mes</p></div>`;
    } else {
      catContainer.innerHTML = breakdown.map(cat => `
        <div class="cat-item glass">
          <div class="cat-emoji">${cat.emoji}</div>
          <div class="cat-info">
            <div class="cat-name">${cat.label}</div>
            <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${cat.pct.toFixed(1)}%"></div></div>
          </div>
          <div class="cat-amount">${this.formatMoney(cat.amount, currency)}</div>
        </div>`).join('');
    }

    const maxIncome  = data6.reduce((m, d) => d.income  > m.v ? { v: d.income,  l: d.label } : m, { v: 0, l: '—' });
    const maxExpense = data6.reduce((m, d) => d.expense > m.v ? { v: d.expense, l: d.label } : m, { v: 0, l: '—' });
    const totalSaved = data6.reduce((s, d) => s + Math.max(0, d.income - d.expense), 0);

    document.getElementById('stats-insights').innerHTML = `
      <div class="insight-card glass">
        <span class="insight-label">Mejor mes</span>
        <span class="insight-value" style="color:var(--color-income)">${maxIncome.l}</span>
        <span class="insight-sub">${this.formatMoney(maxIncome.v, currency)}</span>
      </div>
      <div class="insight-card glass">
        <span class="insight-label">Mayor gasto</span>
        <span class="insight-value" style="color:var(--color-expense)">${maxExpense.l}</span>
        <span class="insight-sub">${this.formatMoney(maxExpense.v, currency)}</span>
      </div>
      <div class="insight-card glass">
        <span class="insight-label">Total ahorrado</span>
        <span class="insight-value" style="color:var(--color-accent)">${this.formatMoney(totalSaved, currency)}</span>
        <span class="insight-sub">Últimos 6 meses</span>
      </div>
      <div class="insight-card glass">
        <span class="insight-label">Transacciones</span>
        <span class="insight-value">${allTx.length}</span>
        <span class="insight-sub">Historial total</span>
      </div>`;
  },

  // ── Profile ───────────────────────────────────────

  async updateProfileView() {
    const user = await Auth.getUser();
    if (!user) return;
    const meta = user.user_metadata || {};
    const name = meta.display_name || user.email || 'Usuario';
    const cur  = CURRENCIES.find(c => c.code === (meta.currency || 'USD'));

    document.getElementById('profile-display-name').textContent   = name;
    document.getElementById('profile-username-display').textContent = user.email;
    document.getElementById('profile-avatar-display').textContent  = name[0].toUpperCase();
    document.getElementById('profile-currency').textContent        = cur ? `${cur.flag} ${cur.code}` : 'USD';
    document.getElementById('dash-avatar-letter').textContent      = name[0].toUpperCase();
  },

  // ── Modal: Transaction ────────────────────────────

  openModal() {
    this.selectedCategory = null;
    document.getElementById('tx-edit-id').value  = '';
    document.getElementById('tx-amount').value   = '';
    document.getElementById('tx-desc').value     = '';
    document.getElementById('tx-date').value     = new Date().toISOString().split('T')[0];
    document.getElementById('modal-title').textContent    = 'Nueva transacción';
    document.getElementById('btn-save-label').textContent = 'Guardar';
    this.setType('expense');
    this.buildCategoryGrid();
    this._showModal('modal-transaction');
    setTimeout(() => document.getElementById('tx-amount').focus(), 300);
  },

  async openEditModal(id) {
    const all = await Data.getAll();
    const tx  = all.find(t => t.id === id);
    if (!tx) return;
    document.getElementById('tx-edit-id').value  = tx.id;
    document.getElementById('tx-amount').value   = tx.amount;
    document.getElementById('tx-desc').value     = tx.description;
    document.getElementById('tx-date').value     = tx.date;
    document.getElementById('modal-title').textContent    = 'Editar transacción';
    document.getElementById('btn-save-label').textContent = 'Actualizar';
    this.setType(tx.type);
    this.selectedCategory = tx.category;
    this.buildCategoryGrid();
    this._showModal('modal-transaction');
  },

  closeModal() { this._hideModal('modal-transaction'); },

  setType(type) {
    const btnI = document.getElementById('type-income');
    const btnE = document.getElementById('type-expense');
    btnI.classList.toggle('active', type === 'income');
    btnE.classList.toggle('active', type === 'expense');
    btnI.setAttribute('aria-pressed', type === 'income');
    btnE.setAttribute('aria-pressed', type === 'expense');
  },

  buildCategoryGrid() {
    const grid = document.getElementById('category-grid');
    if (!grid) return;
    grid.innerHTML = CATEGORIES.map(cat => `
      <button class="cat-pill ${this.selectedCategory === cat.id ? 'selected' : ''}"
        onclick="UI.selectCategory('${cat.id}')" aria-label="${cat.label}" aria-pressed="${this.selectedCategory === cat.id}">
        ${cat.emoji}<span>${cat.label}</span>
      </button>`).join('');
  },

  selectCategory(id) {
    this.selectedCategory = id;
    this.buildCategoryGrid();
  },

  // ── Modal: Currency ───────────────────────────────

  async openCurrencyModal() {
    const user = await Auth.getUser();
    const cur  = (user?.user_metadata || {}).currency || 'USD';
    document.getElementById('currency-options').innerHTML = CURRENCIES.map(c => `
      <button class="currency-option ${cur === c.code ? 'selected' : ''}" onclick="UI.selectCurrency('${c.code}')">
        <span>${c.flag} ${c.code} — ${c.name}</span>
        <svg class="currency-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </button>`).join('');
    this._showModal('modal-currency');
  },

  async selectCurrency(code) {
    await db.auth.updateUser({ data: { currency: code } });
    Auth.clearCache();
    this.closeCurrencyModal();
    await this.updateProfileView();
    await this.renderDashboard();
    this.toast('Moneda actualizada ✓', 'success');
  },

  closeCurrencyModal() { this._hideModal('modal-currency'); },

  showDeleteConfirm() { this._showModal('modal-delete'); },
  closeDeleteModal()  { this._hideModal('modal-delete'); },

  _showModal(id) {
    document.getElementById('modal-backdrop').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this._modalOpen = id;
  },

  _hideModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('closing');
    setTimeout(() => {
      modal.classList.remove('hidden', 'closing');
      modal.classList.add('hidden');
    }, 280);
    if (this._modalOpen === id) {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.body.style.overflow = '';
      this._modalOpen = false;
    }
  },

  // ── Export CSV ────────────────────────────────────

  async exportCSV() {
    const user = await Auth.getUser();
    const txs  = await Data.getAll();
    if (txs.length === 0) { this.toast('No hay transacciones para exportar', 'info'); return; }
    const cur    = (user?.user_metadata || {}).currency || 'USD';
    const header = 'Fecha,Tipo,Descripción,Categoría,Monto,Moneda\n';
    const rows   = txs.map(t => {
      const cat = CATEGORIES.find(c => c.id === t.category)?.label || t.category;
      return `${t.date},${t.type === 'income' ? 'Ingreso' : 'Gasto'},"${t.description.replace(/"/g,'""')}",${cat},${t.amount},${cur}`;
    }).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `numira_${cur}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    this.toast('CSV exportado ✓', 'success');
  },

  // ── Toast ─────────────────────────────────────────

  toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast glass ${type}`;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  },

  // ── Helpers ───────────────────────────────────────

  formatMoney(amount, symbol = '$') {
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) return `${symbol}${(abs/1_000_000).toFixed(1)}M`;
    if (abs >= 10_000)    return `${symbol}${(abs/1_000).toFixed(1)}K`;
    return `${symbol}${abs.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  getCurrencySymbol(code) {
    return CURRENCIES.find(c => c.code === code)?.symbol || '$';
  },

  escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

// ══════════════════════════════════════════════════════
// CHARTS — Canvas API
// ══════════════════════════════════════════════════════

const Charts = {
  drawDonut(canvasId, income, expense) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const dpr  = window.devicePixelRatio || 1;
    const size = 120;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);
    const cx = size/2, cy = size/2, r = 48, inner = 34;
    const total = income + expense;
    ctx.clearRect(0, 0, size, size);
    if (total === 0) {
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.arc(cx,cy,inner,Math.PI*2,0,true);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); return;
    }
    const drawSeg = (start, end, c1, c2) => {
      const g = ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
      g.addColorStop(0,c1); g.addColorStop(1,c2);
      ctx.beginPath(); ctx.arc(cx,cy,r,start,end); ctx.arc(cx,cy,inner,end,start,true);
      ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    };
    const start = -Math.PI/2;
    const iA = (income/total)*Math.PI*2;
    const eA = (expense/total)*Math.PI*2;
    if (income  > 0) drawSeg(start, start+iA, 'rgba(52,211,153,0.9)', 'rgba(16,185,129,0.7)');
    if (expense > 0) drawSeg(start+iA, start+iA+eA, 'rgba(251,113,133,0.9)', 'rgba(244,63,94,0.7)');
  },

  drawBars(canvasId, data, currency = '$') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth || 340, H = 180;
    canvas.width = W*dpr; canvas.height = H*dpr;
    canvas.style.height = H+'px';
    ctx.scale(dpr, dpr); ctx.clearRect(0,0,W,H);
    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
    const pL=40, pR=12, pT=10, pB=36;
    const cW=W-pL-pR, cH=H-pT-pB;
    const gW=cW/data.length, bW=Math.min(gW*0.36,18), gap=4;
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
    [0.25,0.5,0.75,1].forEach(p=>{const y=pT+cH*(1-p);ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();});
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font=`10px Inter,sans-serif`; ctx.textAlign='right';
    [0.5,1].forEach(p=>{const y=pT+cH*(1-p)+4,v=maxVal*p;ctx.fillText(v>=1000?`${(v/1000).toFixed(0)}K`:v.toFixed(0),pL-5,y);});
    data.forEach((d,i)=>{
      const x=pL+i*gW+gW/2;
      const drawBar=(val,ox,c1,c2)=>{
        const bH=(val/maxVal)*cH,bx=x+ox,by=pT+cH-bH,rd=Math.min(5,bW/2);
        const g=ctx.createLinearGradient(0,by,0,by+bH);g.addColorStop(0,c1);g.addColorStop(1,c2);
        ctx.beginPath();ctx.moveTo(bx+rd,by);ctx.lineTo(bx+bW-rd,by);
        ctx.quadraticCurveTo(bx+bW,by,bx+bW,by+rd);ctx.lineTo(bx+bW,by+bH);
        ctx.lineTo(bx,by+bH);ctx.lineTo(bx,by+rd);ctx.quadraticCurveTo(bx,by,bx+rd,by);
        ctx.closePath();ctx.fillStyle=g;ctx.fill();
      };
      if(d.income  > 0) drawBar(d.income,  -(bW+gap/2),'rgba(52,211,153,0.9)','rgba(16,185,129,0.4)');
      if(d.expense > 0) drawBar(d.expense, gap/2,'rgba(251,113,133,0.9)','rgba(244,63,94,0.4)');
      ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.textAlign='center';
      ctx.font=`600 10px Inter,sans-serif`; ctx.fillText(d.label,x,H-pB+16);
    });
  }
};

// ══════════════════════════════════════════════════════
// SKELETON CSS (inyectado dinámicamente)
// ══════════════════════════════════════════════════════

const skeletonCSS = `
.skeleton-list { display:flex;flex-direction:column;gap:10px; }
.skeleton-item { display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,0.05); }
.skeleton-circle { width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,0.08);flex-shrink:0;animation:shimmer 1.4s infinite; }
.skeleton-lines { flex:1;display:flex;flex-direction:column;gap:8px; }
.skeleton-line { height:10px;border-radius:999px;background:rgba(255,255,255,0.08);animation:shimmer 1.4s infinite; }
.skeleton-line.w70{width:70%}.skeleton-line.w40{width:40%}.skeleton-line.w20{width:20%}
@keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
`;
(function() {
  const s = document.createElement('style');
  s.textContent = skeletonCSS;
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════
// KEYBOARD + SWIPE
// ══════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && UI._modalOpen) UI._hideModal(UI._modalOpen);
});

(function() {
  let sY = 0, sX = 0;
  document.addEventListener('touchstart', e => { sY = e.touches[0].clientY; sX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dY = e.changedTouches[0].clientY - sY;
    const dX = Math.abs(e.changedTouches[0].clientX - sX);
    if (UI._modalOpen && dY > 80 && dX < 60) UI._hideModal(UI._modalOpen);
  }, { passive: true });
})();

// ══════════════════════════════════════════════════════
// BOOTSTRAP
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  if (!db) {
    console.error('Supabase no inicializado. Verifica supabase-config.js');
    return;
  }
  UI.init();
});

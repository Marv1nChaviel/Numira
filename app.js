/* ════════════════════════════════════════════════════
   FINFLOW — APP.JS
   Multi-user finance tracker with localStorage
   ════════════════════════════════════════════════════ */

'use strict';

// ══════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════

const CATEGORIES = [
  { id: 'food',       emoji: '🍔', label: 'Comida',    color: '#fb923c' },
  { id: 'home',       emoji: '🏠', label: 'Hogar',     color: '#60a5fa' },
  { id: 'health',     emoji: '💊', label: 'Salud',     color: '#34d399' },
  { id: 'fun',        emoji: '🎮', label: 'Ocio',      color: '#a78bfa' },
  { id: 'work',       emoji: '💼', label: 'Trabajo',   color: '#818cf8' },
  { id: 'travel',     emoji: '✈️', label: 'Viaje',     color: '#22d3ee' },
  { id: 'shopping',   emoji: '🛒', label: 'Compras',   color: '#f472b6' },
  { id: 'education',  emoji: '📚', label: 'Educación', color: '#fbbf24' },
  { id: 'services',   emoji: '⚡', label: 'Servicios', color: '#f87171' },
  { id: 'other',      emoji: '➕', label: 'Otro',      color: '#9ca3af' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$',  name: 'Dólar estadounidense',  flag: '🇺🇸' },
  { code: 'EUR', symbol: '€',  name: 'Euro',                  flag: '🇪🇺' },
  { code: 'VES', symbol: 'Bs.',name: 'Bolívar venezolano',    flag: '🇻🇪' },
  { code: 'MXN', symbol: '$',  name: 'Peso mexicano',         flag: '🇲🇽' },
  { code: 'COP', symbol: '$',  name: 'Peso colombiano',       flag: '🇨🇴' },
  { code: 'ARS', symbol: '$',  name: 'Peso argentino',        flag: '🇦🇷' },
  { code: 'CLP', symbol: '$',  name: 'Peso chileno',          flag: '🇨🇱' },
  { code: 'PEN', symbol: 'S/', name: 'Sol peruano',           flag: '🇵🇪' },
  { code: 'BRL', symbol: 'R$', name: 'Real brasileño',        flag: '🇧🇷' },
];

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ══════════════════════════════════════════════════════
// STORAGE HELPERS
// ══════════════════════════════════════════════════════

const Store = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => { localStorage.setItem(key, JSON.stringify(val)); },
  remove: (key) => { localStorage.removeItem(key); },
};

// ══════════════════════════════════════════════════════
// AUTH MODULE
// ══════════════════════════════════════════════════════

const Auth = {

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  getUsers() {
    return Store.get('finflow_users') || [];
  },

  saveUsers(users) {
    Store.set('finflow_users', users);
  },

  getSession() {
    return Store.get('finflow_session');
  },

  getCurrentUser() {
    const session = this.getSession();
    if (!session) return null;
    const users = this.getUsers();
    return users.find(u => u.username === session.username) || null;
  },

  async register(event) {
    event.preventDefault();
    const name     = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim().toLowerCase();
    const currency = document.getElementById('reg-currency').value;
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('register-error');

    errEl.classList.add('hidden');

    if (!name || !username || !password) {
      UI.showFieldError(errEl, 'Completa todos los campos.');
      return;
    }
    if (username.length < 3) {
      UI.showFieldError(errEl, 'El usuario debe tener al menos 3 caracteres.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      UI.showFieldError(errEl, 'Usuario solo puede contener letras, números y _');
      return;
    }
    if (password.length < 6) {
      UI.showFieldError(errEl, 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const users = this.getUsers();
    if (users.find(u => u.username === username)) {
      UI.showFieldError(errEl, 'Ese nombre de usuario ya está en uso.');
      return;
    }

    const btn = document.getElementById('btn-register');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creando...';

    try {
      const passwordHash = await this.hashPassword(password);
      const newUser = { username, displayName: name, passwordHash, currency, createdAt: new Date().toISOString() };
      users.push(newUser);
      this.saveUsers(users);
      Store.set('finflow_session', { username });
      UI.showApp();
      UI.toast('¡Bienvenido a FinFlow! 🎉', 'success');
    } catch (e) {
      UI.showFieldError(errEl, 'Error al crear cuenta. Intenta de nuevo.');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Crear cuenta';
    }
  },

  async login(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.classList.add('hidden');

    if (!username || !password) {
      UI.showFieldError(errEl, 'Ingresa usuario y contraseña.');
      return;
    }

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Entrando...';

    try {
      const users = this.getUsers();
      const user = users.find(u => u.username === username);
      if (!user) { UI.showFieldError(errEl, 'Usuario no encontrado.'); return; }

      const hash = await this.hashPassword(password);
      if (hash !== user.passwordHash) { UI.showFieldError(errEl, 'Contraseña incorrecta.'); return; }

      Store.set('finflow_session', { username });
      UI.showApp();
      UI.toast(`¡Hola de vuelta, ${user.displayName.split(' ')[0]}! 👋`, 'success');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Entrar';
    }
  },

  logout() {
    Store.remove('finflow_session');
    location.reload();
  },

  async deleteAccount() {
    const user = this.getCurrentUser();
    if (!user) return;

    const users = this.getUsers().filter(u => u.username !== user.username);
    this.saveUsers(users);
    Store.remove(`finflow_${user.username}_transactions`);
    Store.remove('finflow_session');
    UI.closeDeleteModal();
    location.reload();
  }
};

// ══════════════════════════════════════════════════════
// DATA MODULE
// ══════════════════════════════════════════════════════

const Data = {

  _key() {
    const user = Auth.getCurrentUser();
    return user ? `finflow_${user.username}_transactions` : null;
  },

  getAll() {
    const key = this._key();
    if (!key) return [];
    return Store.get(key) || [];
  },

  save(transactions) {
    const key = this._key();
    if (!key) return;
    Store.set(key, transactions);
  },

  add(tx) {
    const transactions = this.getAll();
    const newTx = { ...tx, id: this._uuid(), createdAt: new Date().toISOString() };
    transactions.unshift(newTx);
    this.save(transactions);
    return newTx;
  },

  update(id, updates) {
    const transactions = this.getAll();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return false;
    transactions[idx] = { ...transactions[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save(transactions);
    return transactions[idx];
  },

  delete(id) {
    const transactions = this.getAll().filter(t => t.id !== id);
    this.save(transactions);
  },

  getByMonth(year, month) {
    return this.getAll().filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },

  getMonthSummary(year, month) {
    const txs = this.getByMonth(year, month);
    const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense, txs };
  },

  getLast6MonthsSummary() {
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const summary = this.getMonthSummary(d.getFullYear(), d.getMonth());
      result.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTHS_SHORT[d.getMonth()], ...summary });
    }
    return result;
  },

  getCategoryBreakdown(year, month) {
    const txs = this.getByMonth(year, month).filter(t => t.type === 'expense');
    const total = txs.reduce((s, t) => s + t.amount, 0);
    const map = {};
    txs.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([catId, amount]) => {
        const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES.at(-1);
        return { ...cat, amount, pct: total > 0 ? (amount / total) * 100 : 0 };
      })
      .sort((a, b) => b.amount - a.amount);
  },

  saveTransaction() {
    const id       = document.getElementById('tx-edit-id').value;
    const type     = document.getElementById('type-income').classList.contains('active') ? 'income' : 'expense';
    const amount   = parseFloat(document.getElementById('tx-amount').value);
    const desc     = document.getElementById('tx-desc').value.trim();
    const date     = document.getElementById('tx-date').value;
    const category = UI.selectedCategory;

    if (!amount || amount <= 0) { UI.toast('Ingresa un monto válido', 'error'); return; }
    if (!desc) { UI.toast('Agrega una descripción', 'error'); return; }
    if (!category) { UI.toast('Selecciona una categoría', 'error'); return; }
    if (!date) { UI.toast('Selecciona una fecha', 'error'); return; }

    const txData = { type, amount, description: desc, category, date };

    if (id) {
      Data.update(id, txData);
      UI.toast('Transacción actualizada ✓', 'success');
    } else {
      Data.add(txData);
      UI.toast(`${type === 'income' ? 'Ingreso' : 'Gasto'} registrado ✓`, 'success');
    }

    UI.closeModal();
    UI.refreshAll();
  },

  _uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
};

// ══════════════════════════════════════════════════════
// UI MODULE
// ══════════════════════════════════════════════════════

const UI = {

  currentPage: 'dashboard',
  currentFilter: 'all',
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  selectedCategory: null,
  _modalOpen: false,

  // ── Init ──────────────────────────────────────────

  init() {
    const session = Auth.getSession();
    if (session && Auth.getCurrentUser()) {
      this.showApp();
    } else {
      Store.remove('finflow_session');
      this.showAuth();
    }
  },

  showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.switchAuthTab('login');
  },

  showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    this.buildCategoryGrid();
    this.refreshAll();
    this.navigate('dashboard');
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
      loginEl.classList.remove('hidden');
      registerEl.classList.add('hidden');
      tabLogin.classList.add('active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabReg.classList.remove('active');
      tabReg.setAttribute('aria-selected', 'false');
      indicator.classList.remove('right');
    } else {
      loginEl.classList.add('hidden');
      registerEl.classList.remove('hidden');
      tabLogin.classList.remove('active');
      tabLogin.setAttribute('aria-selected', 'false');
      tabReg.classList.add('active');
      tabReg.setAttribute('aria-selected', 'true');
      indicator.classList.add('right');
    }
  },

  showFieldError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  },

  togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.innerHTML = isHidden
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  },

  // ── Navigation ────────────────────────────────────

  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    const navEl = document.getElementById(`nav-${page}`);
    if (navEl) navEl.classList.add('active');

    this.currentPage = page;

    if (page === 'dashboard') this.renderDashboard();
    if (page === 'transactions') this.renderTransactions();
    if (page === 'stats') this.renderStats();
    if (page === 'profile') this.updateProfileView();
  },

  // ── Refresh All ───────────────────────────────────

  refreshAll() {
    if (this.currentPage === 'dashboard') this.renderDashboard();
    if (this.currentPage === 'transactions') this.renderTransactions();
    if (this.currentPage === 'stats') this.renderStats();
  },

  // ── Dashboard ─────────────────────────────────────

  renderDashboard() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const now = new Date();
    const currency = this.getCurrencySymbol(user.currency);

    // Greeting
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const firstName = user.displayName.split(' ')[0];
    document.getElementById('dash-greeting').textContent = greeting;
    document.getElementById('dash-name').textContent = firstName + ' 👋';
    document.getElementById('dash-avatar-letter').textContent = firstName[0].toUpperCase();
    document.getElementById('dash-period').textContent = `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`;

    // Summary
    const { income, expense, balance } = Data.getMonthSummary(now.getFullYear(), now.getMonth());
    document.getElementById('dash-balance').textContent  = this.formatMoney(balance,  currency);
    document.getElementById('dash-income').textContent   = this.formatMoney(income,   currency);
    document.getElementById('dash-expense').textContent  = this.formatMoney(expense,  currency);

    // Update modal currency symbol
    document.getElementById('modal-currency-symbol').textContent = currency;

    // Donut chart
    Charts.drawDonut('donut-chart', income, expense);
    const pct = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
    document.getElementById('donut-pct').textContent = pct !== null ? `${Math.max(0, pct)}%` : '—';

    // Recent transactions
    const allTx = Data.getAll().slice(0, 5);
    const container = document.getElementById('dash-recent');
    if (allTx.length === 0) {
      container.innerHTML = `<div class="empty-state glass"><span class="empty-icon">💸</span><p>Aún no hay transacciones</p><small>Toca + para agregar tu primera</small></div>`;
    } else {
      container.innerHTML = allTx.map(tx => this.renderTxItem(tx, currency)).join('');
    }
  },

  // ── Transactions ──────────────────────────────────

  renderTransactions() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const currency = this.getCurrencySymbol(user.currency);

    document.getElementById('month-label').textContent = `${MONTHS_ES[this.currentMonth]} ${this.currentYear}`;

    let txs = Data.getByMonth(this.currentYear, this.currentMonth);

    // Filter by type
    if (this.currentFilter !== 'all') {
      txs = txs.filter(t => t.type === this.currentFilter);
    }

    // Filter by search
    const searchTerm = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (searchTerm) {
      txs = txs.filter(t =>
        t.description.toLowerCase().includes(searchTerm) ||
        (CATEGORIES.find(c => c.id === t.category)?.label || '').toLowerCase().includes(searchTerm)
      );
    }

    // Sort by date desc
    txs.sort((a, b) => new Date(b.date) - new Date(a.date));

    const container = document.getElementById('tx-list');
    if (txs.length === 0) {
      container.innerHTML = `<div class="empty-state glass"><span class="empty-icon">🔍</span><p>Sin transacciones</p><small>Intenta cambiar el filtro o mes</small></div>`;
      return;
    }

    // Group by date
    const grouped = {};
    txs.forEach(tx => {
      const d = new Date(tx.date + 'T00:00:00');
      const key = tx.date;
      if (!grouped[key]) grouped[key] = { date: d, txs: [] };
      grouped[key].txs.push(tx);
    });

    let html = '';
    Object.keys(grouped).sort((a,b) => b.localeCompare(a)).forEach(dateKey => {
      const { date, txs: dayTxs } = grouped[dateKey];
      const today = new Date(); today.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
      let label;
      if (date.toDateString() === today.toDateString()) label = 'Hoy';
      else if (date.toDateString() === yesterday.toDateString()) label = 'Ayer';
      else label = `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;

      html += `<div class="tx-date-group">${label}</div>`;
      html += dayTxs.map(tx => this.renderTxItem(tx, currency)).join('');
    });

    container.innerHTML = html;
  },

  renderTxItem(tx, currency) {
    const cat = CATEGORIES.find(c => c.id === tx.category) || CATEGORIES.at(-1);
    const sign = tx.type === 'income' ? '+' : '-';
    const d = new Date(tx.date + 'T00:00:00');
    const dateStr = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    return `
      <div class="tx-item glass" onclick="UI.openEditModal('${tx.id}')">
        <div class="tx-emoji">${cat.emoji}</div>
        <div class="tx-info">
          <div class="tx-desc">${this.escapeHtml(tx.description)}</div>
          <div class="tx-meta">
            <span>${cat.label}</span>
            <span class="tx-dot"></span>
            <span>${dateStr}</span>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${this.formatMoney(tx.amount, currency)}</div>
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
    if (!bar.classList.contains('hidden')) {
      document.getElementById('search-input').focus();
    } else {
      document.getElementById('search-input').value = '';
      this.renderTransactions();
    }
  },

  clearSearch() {
    document.getElementById('search-input').value = '';
    this.renderTransactions();
  },

  // ── Statistics ────────────────────────────────────

  renderStats() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const currency = this.getCurrencySymbol(user.currency);
    const now = new Date();
    const data6 = Data.getLast6MonthsSummary();

    // Bar chart
    Charts.drawBars('bar-chart', data6, currency);

    // Category breakdown
    const breakdown = Data.getCategoryBreakdown(now.getFullYear(), now.getMonth());
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

    // Insights
    const maxIncome  = data6.reduce((m, d) => d.income  > m.v ? { v: d.income,  l: d.label } : m, { v: 0, l: '—' });
    const maxExpense = data6.reduce((m, d) => d.expense > m.v ? { v: d.expense, l: d.label } : m, { v: 0, l: '—' });
    const totalSaved = data6.reduce((s, d) => s + Math.max(0, d.income - d.expense), 0);
    const txCount    = Data.getAll().length;

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
        <span class="insight-value">${txCount}</span>
        <span class="insight-sub">Historial total</span>
      </div>`;
  },

  // ── Profile ───────────────────────────────────────

  updateProfileView() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    document.getElementById('profile-display-name').textContent = user.displayName;
    document.getElementById('profile-username-display').textContent = `@${user.username}`;
    document.getElementById('profile-avatar-display').textContent = user.displayName[0].toUpperCase();
    const cur = CURRENCIES.find(c => c.code === user.currency);
    document.getElementById('profile-currency').textContent = cur ? `${cur.flag} ${cur.code}` : user.currency;
  },

  // ── Modal: Transaction ────────────────────────────

  openModal() {
    this.selectedCategory = null;
    document.getElementById('tx-edit-id').value = '';
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-desc').value = '';
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-title').textContent = 'Nueva transacción';
    document.getElementById('btn-save-label').textContent = 'Guardar';
    this.setType('expense');
    this.buildCategoryGrid();
    this._showModal('modal-transaction');
    setTimeout(() => document.getElementById('tx-amount').focus(), 300);
  },

  openEditModal(id) {
    const tx = Data.getAll().find(t => t.id === id);
    if (!tx) return;

    document.getElementById('tx-edit-id').value = tx.id;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-desc').value = tx.description;
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('modal-title').textContent = 'Editar transacción';
    document.getElementById('btn-save-label').textContent = 'Actualizar';

    this.setType(tx.type);
    this.selectedCategory = tx.category;
    this.buildCategoryGrid();
    this._showModal('modal-transaction');
  },

  closeModal() {
    this._hideModal('modal-transaction');
  },

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
        onclick="UI.selectCategory('${cat.id}')"
        aria-label="${cat.label}" aria-pressed="${this.selectedCategory === cat.id}">
        ${cat.emoji}
        <span>${cat.label}</span>
      </button>`).join('');
  },

  selectCategory(id) {
    this.selectedCategory = id;
    this.buildCategoryGrid();
  },

  // ── Modal: Currency ───────────────────────────────

  openCurrencyModal() {
    const user = Auth.getCurrentUser();
    const container = document.getElementById('currency-options');
    container.innerHTML = CURRENCIES.map(c => `
      <button class="currency-option ${user.currency === c.code ? 'selected' : ''}"
        onclick="UI.selectCurrency('${c.code}')">
        <span>${c.flag} ${c.code} — ${c.name}</span>
        <svg class="currency-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </button>`).join('');
    this._showModal('modal-currency');
  },

  selectCurrency(code) {
    const users = Auth.getUsers();
    const session = Auth.getSession();
    const idx = users.findIndex(u => u.username === session.username);
    if (idx > -1) {
      users[idx].currency = code;
      Auth.saveUsers(users);
    }
    this.closeCurrencyModal();
    this.updateProfileView();
    this.renderDashboard();
    UI.toast('Moneda actualizada ✓', 'success');
  },

  closeCurrencyModal() {
    this._hideModal('modal-currency');
  },

  // ── Modal: Delete ─────────────────────────────────

  showDeleteConfirm() {
    this._showModal('modal-delete');
  },

  closeDeleteModal() {
    this._hideModal('modal-delete');
  },

  // ── Modal helpers ─────────────────────────────────

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

  exportCSV() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const txs = Data.getAll();
    if (txs.length === 0) { this.toast('No hay transacciones para exportar', 'info'); return; }

    const header = 'Fecha,Tipo,Descripción,Categoría,Monto,Moneda\n';
    const rows = txs.map(t => {
      const cat = CATEGORIES.find(c => c.id === t.category)?.label || t.category;
      return `${t.date},${t.type === 'income' ? 'Ingreso' : 'Gasto'},"${t.description.replace(/"/g,'""')}",${cat},${t.amount},${user.currency}`;
    }).join('\n');

    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `finflow_${user.username}_${new Date().toISOString().split('T')[0]}.csv`;
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
    this._toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 3000);
  },

  // ── Helpers ───────────────────────────────────────

  formatMoney(amount, symbol = '$') {
    const abs = Math.abs(amount);
    if (abs >= 1000000) return `${symbol}${(abs/1000000).toFixed(1)}M`;
    if (abs >= 10000)   return `${symbol}${(abs/1000).toFixed(1)}K`;
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
// CHARTS MODULE
// ══════════════════════════════════════════════════════

const Charts = {

  drawDonut(canvasId, income, expense) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 120;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, r = 48, inner = 34;
    const total = income + expense;
    ctx.clearRect(0, 0, size, size);

    if (total === 0) {
      // Empty ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx, cy, inner, Math.PI * 2, 0, true);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      return;
    }

    const incomeAngle  = (income  / total) * Math.PI * 2;
    const expenseAngle = (expense / total) * Math.PI * 2;
    const start = -Math.PI / 2;

    // Draw segment with gradient
    const drawSegment = (startA, endA, color1, color2) => {
      const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);

      ctx.beginPath();
      ctx.arc(cx, cy, r, startA, endA);
      ctx.arc(cx, cy, inner, endA, startA, true);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    };

    if (income > 0) drawSegment(start, start + incomeAngle, 'rgba(52,211,153,0.9)', 'rgba(16,185,129,0.7)');
    if (expense > 0) drawSegment(start + incomeAngle, start + incomeAngle + expenseAngle, 'rgba(251,113,133,0.9)', 'rgba(244,63,94,0.7)');

    // Gap between segments
    if (income > 0 && expense > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      [start + incomeAngle, start + incomeAngle + expenseAngle].forEach(angle => {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * (inner - 2), cy + Math.sin(angle) * (inner - 2));
        ctx.lineTo(cx + Math.cos(angle) * (r + 2), cy + Math.sin(angle) * (r + 2));
        ctx.lineWidth = 3;
        ctx.stroke();
      });
      ctx.restore();
    }
  },

  drawBars(canvasId, data, currency = '$') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const dpr    = window.devicePixelRatio || 1;
    const W      = canvas.offsetWidth || 340;
    const H      = 180;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
    const padL = 40, padR = 12, padT = 10, padB = 36;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const groupW = chartW / data.length;
    const barW   = Math.min(groupW * 0.36, 18);
    const gap    = 4;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    [0.25, 0.5, 0.75, 1].forEach(pct => {
      const y = padT + chartH * (1 - pct);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    });

    // Y labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${10 * dpr / dpr}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    [0.5, 1].forEach(pct => {
      const y = padT + chartH * (1 - pct) + 4;
      const val = maxVal * pct;
      ctx.fillText(val >= 1000 ? `${(val/1000).toFixed(0)}K` : val.toFixed(0), padL - 5, y);
    });

    data.forEach((d, i) => {
      const x = padL + i * groupW + groupW / 2;

      const drawBar = (value, offsetX, color1, color2) => {
        const barH = (value / maxVal) * chartH;
        const bx   = x + offsetX;
        const by   = padT + chartH - barH;
        const radius = Math.min(5, barW / 2);

        const grad = ctx.createLinearGradient(0, by, 0, by + barH);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);

        ctx.beginPath();
        ctx.moveTo(bx + radius, by);
        ctx.lineTo(bx + barW - radius, by);
        ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + radius);
        ctx.lineTo(bx + barW, by + barH);
        ctx.lineTo(bx, by + barH);
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + radius, by);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      };

      if (d.income  > 0) drawBar(d.income,  -(barW + gap / 2), 'rgba(52,211,153,0.9)', 'rgba(16,185,129,0.4)');
      if (d.expense > 0) drawBar(d.expense, gap / 2,            'rgba(251,113,133,0.9)', 'rgba(244,63,94,0.4)');

      // X label
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      ctx.font = `600 ${10 * dpr / dpr}px Inter, sans-serif`;
      ctx.fillText(d.label, x, H - padB + 16);
    });
  }
};

// ══════════════════════════════════════════════════════
// KEYBOARD + SWIPE
// ══════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && UI._modalOpen) UI._hideModal(UI._modalOpen);
});

// Swipe down to dismiss modal
(function() {
  let startY = 0;
  let startX = 0;
  document.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const deltaY = e.changedTouches[0].clientY - startY;
    const deltaX = Math.abs(e.changedTouches[0].clientX - startX);
    if (UI._modalOpen && deltaY > 80 && deltaX < 60) {
      UI._hideModal(UI._modalOpen);
    }
  }, { passive: true });
})();

// ══════════════════════════════════════════════════════
// BOOTSTRAP
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  UI.init();
});

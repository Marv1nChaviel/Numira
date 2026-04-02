'use strict';

let db;
try { const { createClient } = window.supabase; db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
catch(e) { console.error('Supabase init failed:', e); }

const CATEGORIES = [
  { id:'food',      emoji:'🍔', label:'Comida',    color:'#fb923c' },
  { id:'home',      emoji:'🏠', label:'Hogar',     color:'#60a5fa' },
  { id:'health',    emoji:'💊', label:'Salud',     color:'#34d399' },
  { id:'fun',       emoji:'🎮', label:'Ocio',      color:'#a78bfa' },
  { id:'work',      emoji:'💼', label:'Trabajo',   color:'#818cf8' },
  { id:'travel',    emoji:'✈️', label:'Viaje',     color:'#22d3ee' },
  { id:'shopping',  emoji:'🛒', label:'Compras',   color:'#f472b6' },
  { id:'education', emoji:'📚', label:'Educación', color:'#fbbf24' },
  { id:'services',  emoji:'⚡', label:'Servicios', color:'#f87171' },
  { id:'other',     emoji:'➕', label:'Otro',      color:'#9ca3af' },
];
const CURRENCIES = [
  { code:'USD', symbol:'$',   name:'Dólar estadounidense', flag:'🇺🇸' },
  { code:'EUR', symbol:'€',   name:'Euro',                 flag:'🇪🇺' },
  { code:'VES', symbol:'Bs.', name:'Bolívar venezolano',   flag:'🇻🇪' },
  { code:'MXN', symbol:'$',   name:'Peso mexicano',        flag:'🇲🇽' },
  { code:'COP', symbol:'$',   name:'Peso colombiano',      flag:'🇨🇴' },
  { code:'ARS', symbol:'$',   name:'Peso argentino',       flag:'🇦🇷' },
  { code:'CLP', symbol:'$',   name:'Peso chileno',         flag:'🇨🇱' },
  { code:'PEN', symbol:'S/',  name:'Sol peruano',          flag:'🇵🇪' },
  { code:'BRL', symbol:'R$',  name:'Real brasileño',       flag:'🇧🇷' },
];
const GOAL_EMOJIS = ['🎯','🏖️','🚗','🏠','💻','✈️','💍','🎓','🐶','🎸','💪','🌟'];
const MONTHS_ES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ── AUTH ──────────────────────────────────────────────
const Auth = {
  _user: null,
  async getUser() {
    if (this._user) return this._user;
    const { data:{ user } } = await db.auth.getUser();
    this._user = user; return user;
  },
  clearCache() { this._user = null; },
  async register(e) {
    e.preventDefault();
    const name=document.getElementById('reg-name').value.trim(), email=document.getElementById('reg-email').value.trim().toLowerCase(),
          currency=document.getElementById('reg-currency').value, password=document.getElementById('reg-password').value;
    const err=document.getElementById('register-error'); err.classList.add('hidden');
    if (!name||!email||!password) { UI.showFieldError(err,'Completa todos los campos.'); return; }
    if (password.length<6) { UI.showFieldError(err,'Contraseña: mínimo 6 caracteres.'); return; }
    const btn=document.getElementById('btn-register'); btn.disabled=true; btn.querySelector('span').textContent='Creando...';
    const { data, error } = await db.auth.signUp({ email, password, options:{ data:{ display_name:name, currency } } });
    btn.disabled=false; btn.querySelector('span').textContent='Crear cuenta';
    if (error) { UI.showFieldError(err, this._tr(error.message)); return; }
    if (data.user && !data.session) {
      err.style.cssText='background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.3);color:#34d399';
      err.textContent='Revisa tu email para confirmar tu cuenta 📧'; err.classList.remove('hidden');
    }
  },
  async login(e) {
    e.preventDefault();
    const email=document.getElementById('login-email').value.trim().toLowerCase(), password=document.getElementById('login-password').value;
    const err=document.getElementById('login-error'); err.classList.add('hidden');
    const btn=document.getElementById('btn-login'); btn.disabled=true; btn.querySelector('span').textContent='Entrando...';
    const { error } = await db.auth.signInWithPassword({ email, password });
    btn.disabled=false; btn.querySelector('span').textContent='Entrar';
    if (error) UI.showFieldError(err, this._tr(error.message));
  },
  async logout() { this.clearCache(); await db.auth.signOut(); },
  async deleteAccount() {
    const user = await this.getUser(); if (!user) return;
    await db.from('transactions').delete().eq('user_id', user.id);
    await db.from('budgets').delete().eq('user_id', user.id);
    await db.from('savings_goals').delete().eq('user_id', user.id);
    this.clearCache(); await db.auth.signOut(); UI.closeDeleteModal();
  },
  _tr(msg) {
    if (!msg) return 'Error desconocido.';
    if (msg.includes('Invalid login'))       return 'Email o contraseña incorrectos.';
    if (msg.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.';
    if (msg.includes('already registered')) return 'Este email ya está registrado.';
    if (msg.includes('Password should'))    return 'Contraseña: mínimo 6 caracteres.';
    return msg;
  }
};

// ── DATA ──────────────────────────────────────────────
const Data = {
  async getAll() {
    const { data, error } = await db.from('transactions').select('*').order('date',{ascending:false}).order('created_at',{ascending:false});
    if (error) { console.error(error); return []; } return data||[];
  },
  async getByMonth(year, month) {
    const start=`${year}-${String(month+1).padStart(2,'0')}-01`, end=new Date(year,month+1,0).toISOString().split('T')[0];
    const { data,error } = await db.from('transactions').select('*').gte('date',start).lte('date',end).order('date',{ascending:false});
    if (error) { console.error(error); return []; } return data||[];
  },
  async getMonthSummary(year, month) {
    const txs=await this.getByMonth(year,month);
    const income=txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const expense=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    return { income, expense, balance:income-expense, txs };
  },
  async getLast6() {
    const now=new Date(), result=[];
    for (let i=5;i>=0;i--) {
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const s=await this.getMonthSummary(d.getFullYear(),d.getMonth());
      result.push({ year:d.getFullYear(), month:d.getMonth(), label:MONTHS_SHORT[d.getMonth()], ...s });
    }
    return result;
  },
  async getCategoryBreakdown(year, month) {
    const txs=(await this.getByMonth(year,month)).filter(t=>t.type==='expense');
    const total=txs.reduce((s,t)=>s+Number(t.amount),0), map={};
    txs.forEach(t=>{ map[t.category]=(map[t.category]||0)+Number(t.amount); });
    return Object.entries(map).map(([id,amount])=>{ const cat=CATEGORIES.find(c=>c.id===id)||CATEGORIES.at(-1); return {...cat,amount,pct:total>0?(amount/total)*100:0}; }).sort((a,b)=>b.amount-a.amount);
  },
  async add(tx) {
    const user=await Auth.getUser(); if (!user) return null;
    const { data,error } = await db.from('transactions').insert([{...tx,user_id:user.id}]).select().single();
    if (error) { console.error(error); return null; } return data;
  },
  async update(id, updates) {
    const { data,error } = await db.from('transactions').update(updates).eq('id',id).select().single();
    if (error) { console.error(error); return null; } return data;
  },
  async delete(id) {
    const { error } = await db.from('transactions').delete().eq('id',id); if (error) console.error(error);
  },
  async saveTransaction() {
    const id=document.getElementById('tx-edit-id').value;
    const type=document.getElementById('type-income').classList.contains('active')?'income':'expense';
    const amount=parseFloat(document.getElementById('tx-amount').value);
    const desc=document.getElementById('tx-desc').value.trim(), date=document.getElementById('tx-date').value;
    const category=UI.selectedCategory;
    const recurring=document.getElementById('recurring-toggle').getAttribute('aria-pressed')==='true';
    if (!amount||amount<=0) { UI.toast('Ingresa un monto válido','error'); return; }
    if (!desc)              { UI.toast('Agrega una descripción','error'); return; }
    if (!category)          { UI.toast('Selecciona una categoría','error'); return; }
    if (!date)              { UI.toast('Selecciona una fecha','error'); return; }
    const btn=document.getElementById('btn-save-tx'); btn.disabled=true;
    const txData={type,amount,description:desc,category,date,recurring};
    if (id) { await Data.update(id,txData); UI.toast('Transacción actualizada ✓','success'); }
    else    { await Data.add(txData); UI.toast(`${type==='income'?'Ingreso':'Gasto'} registrado ✓`,'success'); }
    btn.disabled=false; UI.closeModal(); UI.refreshAll();
  }
};

// ── BUDGETS ───────────────────────────────────────────
const Budgets = {
  _cache: null,
  async getAll() {
    if (this._cache) return this._cache;
    const { data,error } = await db.from('budgets').select('*');
    this._cache=data||[]; return this._cache;
  },
  clear() { this._cache=null; },
  async save() {
    const cat=document.getElementById('budget-category').value;
    const amount=parseFloat(document.getElementById('budget-amount').value);
    const id=document.getElementById('budget-edit-id').value;
    if (!cat||!amount||amount<=0) { UI.toast('Ingresa categoría y monto','error'); return; }
    const user=await Auth.getUser(); if (!user) return;
    if (id) {
      await db.from('budgets').update({amount}).eq('id',id);
    } else {
      await db.from('budgets').upsert([{user_id:user.id, category:cat, amount}],{onConflict:'user_id,category'});
    }
    this.clear(); UI.closeBudgetModal(); UI.renderBudgets(); UI.toast('Presupuesto guardado ✓','success');
  },
  async delete(id) {
    await db.from('budgets').delete().eq('id',id);
    this.clear(); UI.renderBudgets(); UI.toast('Presupuesto eliminado','info');
  }
};

// ── GOALS ────────────────────────────────────────────
const Goals = {
  _sel: '🎯',
  async getAll() {
    const { data,error } = await db.from('savings_goals').select('*').order('created_at',{ascending:false});
    if (error) { console.error(error); return []; } return data||[];
  },
  async save() {
    const name=document.getElementById('goal-name').value.trim();
    const target=parseFloat(document.getElementById('goal-target').value);
    const deadline=document.getElementById('goal-deadline').value||null;
    const id=document.getElementById('goal-edit-id').value;
    if (!name||!target||target<=0) { UI.toast('Completa nombre y monto','error'); return; }
    const user=await Auth.getUser(); if (!user) return;
    const payload={name, emoji:this._sel, target_amount:target, deadline};
    if (id) { await db.from('savings_goals').update(payload).eq('id',id); }
    else    { await db.from('savings_goals').insert([{...payload, user_id:user.id}]); }
    UI.closeGoalModal(); UI.renderGoals(); UI.toast('Meta guardada ✓','success');
  },
  async addFunds() {
    const id=document.getElementById('funds-goal-id').value;
    const amount=parseFloat(document.getElementById('funds-amount').value);
    if (!amount||amount<=0) { UI.toast('Ingresa un monto válido','error'); return; }
    const { data:goal } = await db.from('savings_goals').select('current_amount,target_amount').eq('id',id).single();
    const newAmt=Number(goal.current_amount)+amount;
    const completed=newAmt>=Number(goal.target_amount);
    await db.from('savings_goals').update({current_amount:newAmt, completed}).eq('id',id);
    UI.closeFundsModal(); UI.renderGoals(); UI.toast(completed?'¡Meta completada! 🎉':'Fondos agregados ✓','success');
  },
  async deleteGoal() {
    const id=document.getElementById('funds-goal-id').value;
    await db.from('savings_goals').delete().eq('id',id);
    UI.closeFundsModal(); UI.renderGoals(); UI.toast('Meta eliminada','info');
  }
};

// ── UI ────────────────────────────────────────────────
const UI = {
  currentPage:'dashboard', currentFilter:'all',
  currentMonth:new Date().getMonth(), currentYear:new Date().getFullYear(),
  selectedCategory:null, _modalOpen:false,

  init() {
    db.auth.onAuthStateChange((event,session)=>{ Auth.clearCache(); if(session) this.showApp(); else this.showAuth(); });
    db.auth.getSession().then(({data:{session}})=>{ if(session) this.showApp(); else this.showAuth(); });
  },

  showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.switchAuthTab('login');
  },
  async showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    await this._applyTheme();
    this.buildCategoryGrid();
    await this.navigate('dashboard');
    this.updateProfileView();
  },

  // ── Theme ─────────────────────────────────────────
  async _applyTheme() {
    const user=await Auth.getUser();
    const theme=(user?.user_metadata||{}).theme||'dark';
    document.documentElement.setAttribute('data-theme',theme);
    const isLight=theme==='light';
    const tog=document.getElementById('theme-toggle');
    if (tog) tog.setAttribute('aria-pressed', isLight?'true':'false');
    const lbl=document.getElementById('theme-label');
    if (lbl) lbl.textContent=isLight?'Claro':'Oscuro';
    const ico=document.getElementById('theme-icon');
    if (ico) ico.textContent=isLight?'☀️':'🌙';
  },
  async toggleTheme() {
    const user=await Auth.getUser(); if (!user) return;
    const cur=(user.user_metadata||{}).theme||'dark';
    const next=cur==='dark'?'light':'dark';
    await db.auth.updateUser({data:{theme:next}});
    Auth.clearCache(); this._applyTheme();
  },

  // ── Auth Tabs ──────────────────────────────────────
  switchAuthTab(tab) {
    const panels={login:document.getElementById('panel-login'),reg:document.getElementById('panel-register')};
    const tabs={login:document.getElementById('tab-login'),reg:document.getElementById('tab-register')};
    const ind=document.querySelector('.auth-tab-indicator');
    const isLogin=tab==='login';
    panels.login.classList.toggle('hidden',!isLogin); panels.reg.classList.toggle('hidden',isLogin);
    tabs.login.classList.toggle('active',isLogin); tabs.reg.classList.toggle('active',!isLogin);
    tabs.login.setAttribute('aria-selected',isLogin); tabs.reg.setAttribute('aria-selected',!isLogin);
    if (ind) ind.classList.toggle('right',!isLogin);
  },
  showFieldError(el,msg) { el.textContent=msg; el.style=''; if(msg) el.classList.remove('hidden'); else el.classList.add('hidden'); },
  togglePassword(inputId,btn) {
    const input=document.getElementById(inputId), h=input.type==='password';
    input.type=h?'text':'password';
    btn.innerHTML=h?`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  },

  // ── Navigation ─────────────────────────────────────
  async navigate(page) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
    document.getElementById(`nav-${page}`)?.classList.add('active');
    this.currentPage=page;
    if (page==='dashboard')    await this.renderDashboard();
    if (page==='transactions') await this.renderTransactions();
    if (page==='stats')        await this.renderStats();
    if (page==='profile')      { this.updateProfileView(); this.renderGoals(); }
  },
  async refreshAll() {
    if (this.currentPage==='dashboard')    await this.renderDashboard();
    if (this.currentPage==='transactions') await this.renderTransactions();
    if (this.currentPage==='stats')        await this.renderStats();
  },
  _skeleton(id) {
    const el=document.getElementById(id); if (!el) return;
    el.innerHTML=`<div class="skeleton-list">${Array(3).fill(`<div class="skeleton-item"><div class="skeleton-circle"></div><div class="skeleton-lines"><div class="skeleton-line w70"></div><div class="skeleton-line w40"></div></div><div class="skeleton-line w20"></div></div>`).join('')}</div>`;
  },

  // ── Dashboard ──────────────────────────────────────
  async renderDashboard() {
    const user=await Auth.getUser(); if (!user) return;
    const now=new Date(), meta=user.user_metadata||{};
    const currency=this.getCurrencySymbol(meta.currency||'USD');
    const firstName=(meta.display_name||user.email||'Usuario').split(' ')[0];
    const hour=now.getHours();
    document.getElementById('dash-greeting').textContent=hour<12?'Buenos días':hour<18?'Buenas tardes':'Buenas noches';
    document.getElementById('dash-name').textContent=`${firstName} 👋`;
    document.getElementById('dash-avatar-letter').textContent=firstName[0].toUpperCase();
    document.getElementById('dash-period').textContent=`${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`;
    document.getElementById('modal-currency-symbol').textContent=currency;
    this._skeleton('dash-recent');

    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const [curr,prev] = await Promise.all([
      Data.getMonthSummary(now.getFullYear(), now.getMonth()),
      Data.getMonthSummary(prevYear, prevMonth)
    ]);
    const { income,expense,balance }=curr;
    document.getElementById('dash-balance').textContent=this.formatMoney(balance,currency);
    document.getElementById('dash-income').textContent=this.formatMoney(income,currency);
    document.getElementById('dash-expense').textContent=this.formatMoney(expense,currency);

    // Badges comparativos
    this._badge('income-compare',income,prev.income);
    this._badge('expense-compare',expense,prev.expense);

    Charts.drawDonut('donut-chart',income,expense);
    const pct=income>0?Math.round(((income-expense)/income)*100):null;
    document.getElementById('donut-pct').textContent=pct!==null?`${Math.max(0,pct)}%`:'—';

    // Budget alerts
    await this._renderBudgetAlerts(currency);

    const allTx=await Data.getAll(), container=document.getElementById('dash-recent');
    container.innerHTML = allTx.length===0
      ? `<div class="empty-state glass"><span class="empty-icon">💸</span><p>Aún no hay transacciones</p><small>Toca + para agregar tu primera</small></div>`
      : allTx.slice(0,5).map(tx=>this.renderTxItem(tx,currency)).join('');
    this._initSwipe();
  },

  _badge(elId,current,prev) {
    const el=document.getElementById(elId); if (!el) return;
    if (prev===0) { el.innerHTML=''; return; }
    const pct=Math.round(((current-prev)/prev)*100);
    const cls=pct>0?'up':pct<0?'down':'flat';
    const arrow=pct>0?'↑':pct<0?'↓':'→';
    el.innerHTML=`<span class="compare-badge ${cls}">${arrow} ${Math.abs(pct)}%</span>`;
  },

  async _renderBudgetAlerts(currency) {
    const now=new Date(), budgets=await Budgets.getAll();
    if (!budgets.length) { ['budget-alerts','budget-alerts-stats'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=''; }); return; }
    const breakdown=await Data.getCategoryBreakdown(now.getFullYear(),now.getMonth());
    const alerts=[];
    for (const b of budgets) {
      const spent=breakdown.find(c=>c.id===b.category)?.amount||0;
      const pct=spent/Number(b.amount);
      if (pct>=0.8) {
        const cat=CATEGORIES.find(c=>c.id===b.category)||CATEGORIES.at(-1);
        const over=pct>=1;
        alerts.push(`<div class="budget-alert"><span class="budget-alert-emoji">${cat.emoji}</span><span class="budget-alert-text">${over?'<strong>Superaste</strong> el presupuesto de':'<strong>Cuidado:</strong> casi alcanzas el presupuesto de'} <strong>${cat.label}</strong> (${this.formatMoney(spent,currency)} / ${this.formatMoney(Number(b.amount),currency)})</span></div>`);
      }
    }
    const html=alerts.join('');
    ['budget-alerts','budget-alerts-stats'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=html; });
  },

  // ── Transactions ───────────────────────────────────
  async renderTransactions() {
    const user=await Auth.getUser(); if (!user) return;
    const currency=this.getCurrencySymbol((user.user_metadata||{}).currency||'USD');
    document.getElementById('month-label').textContent=`${MONTHS_ES[this.currentMonth]} ${this.currentYear}`;
    this._skeleton('tx-list');
    let txs=await Data.getByMonth(this.currentYear,this.currentMonth);
    if (this.currentFilter!=='all') txs=txs.filter(t=>t.type===this.currentFilter);
    const search=document.getElementById('search-input')?.value.trim().toLowerCase()||'';
    if (search) txs=txs.filter(t=>t.description.toLowerCase().includes(search)||(CATEGORIES.find(c=>c.id===t.category)?.label||'').toLowerCase().includes(search));
    const container=document.getElementById('tx-list');
    if (!txs.length) { container.innerHTML=`<div class="empty-state glass"><span class="empty-icon">🔍</span><p>Sin transacciones</p><small>Intenta cambiar el filtro o mes</small></div>`; return; }
    const grouped={};
    txs.forEach(tx=>{ if (!grouped[tx.date]) grouped[tx.date]={date:new Date(tx.date+'T00:00:00'),txs:[]}; grouped[tx.date].txs.push(tx); });
    let html='';
    const today=new Date(); today.setHours(0,0,0,0);
    const yesterday=new Date(today); yesterday.setDate(today.getDate()-1);
    Object.keys(grouped).sort((a,b)=>b.localeCompare(a)).forEach(dk=>{
      const {date,txs:d}=grouped[dk];
      let lbl=date.toDateString()===today.toDateString()?'Hoy':date.toDateString()===yesterday.toDateString()?'Ayer':`${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
      html+=`<div class="tx-date-group">${lbl}</div>`;
      html+=d.map(tx=>this._txWrapper(tx,currency)).join('');
    });
    container.innerHTML=html;
    this._initSwipe();
  },

  _txWrapper(tx,currency) {
    return `<div class="tx-swipe-wrapper"><div class="tx-delete-bg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>Eliminar</div>${this.renderTxItem(tx,currency)}</div>`;
  },

  renderTxItem(tx,currency) {
    const cat=CATEGORIES.find(c=>c.id===tx.category)||CATEGORIES.at(-1);
    const sign=tx.type==='income'?'+':'-', d=new Date(tx.date+'T00:00:00');
    const recBadge=tx.recurring?`<span class="recurring-badge">🔄 Recurrente</span>`:'';
    return `<div class="tx-item glass" data-id="${tx.id}" onclick="UI.openEditModal('${tx.id}')"><div class="tx-emoji">${cat.emoji}</div><div class="tx-info"><div class="tx-desc">${this.escapeHtml(tx.description)}${recBadge}</div><div class="tx-meta"><span>${cat.label}</span><span class="tx-dot"></span><span>${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}</span></div></div><div class="tx-amount ${tx.type}">${sign}${this.formatMoney(Number(tx.amount),currency)}</div></div>`;
  },

  _initSwipe() {
    document.querySelectorAll('.tx-swipe-wrapper').forEach(wrapper=>{
      const item=wrapper.querySelector('.tx-item'); if (!item) return;
      let sX=0, cur=0; const MAX=80;
      item.addEventListener('touchstart',e=>{ sX=e.touches[0].clientX; cur=0; item.classList.add('swiping'); },{passive:true});
      item.addEventListener('touchmove',e=>{
        const dx=sX-e.touches[0].clientX; cur=Math.max(0,Math.min(dx,MAX));
        item.style.transform=`translateX(-${cur}px)`;
      },{passive:true});
      item.addEventListener('touchend',async ()=>{
        item.classList.remove('swiping');
        if (cur>MAX*0.7) {
          const id=item.dataset.id;
          item.style.transform=`translateX(-120%)`;
          item.style.opacity='0';
          setTimeout(async ()=>{ await Data.delete(id); UI.refreshAll(); UI.toast('Transacción eliminada','info'); },250);
        } else { item.style.transform=''; }
      });
    });
  },

  setFilter(filter,btn) { this.currentFilter=filter; document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); this.renderTransactions(); },
  changeMonth(delta) {
    this.currentMonth+=delta;
    if (this.currentMonth>11){this.currentMonth=0;this.currentYear++;} if(this.currentMonth<0){this.currentMonth=11;this.currentYear--;}
    this.renderTransactions();
  },
  toggleSearch() { const b=document.getElementById('search-bar'); b.classList.toggle('hidden'); if(!b.classList.contains('hidden'))document.getElementById('search-input').focus(); else{document.getElementById('search-input').value='';this.renderTransactions();} },
  clearSearch() { document.getElementById('search-input').value=''; this.renderTransactions(); },

  // ── Stats ──────────────────────────────────────────
  async renderStats() {
    const user=await Auth.getUser(); if (!user) return;
    const currency=this.getCurrencySymbol((user.user_metadata||{}).currency||'USD');
    const now=new Date();
    const [data6,breakdown,allTx]=await Promise.all([Data.getLast6(),Data.getCategoryBreakdown(now.getFullYear(),now.getMonth()),Data.getAll()]);
    Charts.drawBars('bar-chart',data6,currency);
    const catC=document.getElementById('category-breakdown');
    catC.innerHTML=breakdown.length===0?`<div class="empty-state glass" style="padding:24px"><span class="empty-icon">📭</span><p>Sin gastos este mes</p></div>`:breakdown.map(cat=>`<div class="cat-item glass"><div class="cat-emoji">${cat.emoji}</div><div class="cat-info"><div class="cat-name">${cat.label}</div><div class="cat-bar-track"><div class="cat-bar-fill" style="width:${cat.pct.toFixed(1)}%"></div></div></div><div class="cat-amount">${this.formatMoney(cat.amount,currency)}</div></div>`).join('');
    const maxI=data6.reduce((m,d)=>d.income>m.v?{v:d.income,l:d.label}:m,{v:0,l:'—'});
    const maxE=data6.reduce((m,d)=>d.expense>m.v?{v:d.expense,l:d.label}:m,{v:0,l:'—'});
    const saved=data6.reduce((s,d)=>s+Math.max(0,d.income-d.expense),0);
    document.getElementById('stats-insights').innerHTML=`<div class="insight-card glass"><span class="insight-label">Mejor mes</span><span class="insight-value" style="color:var(--color-income)">${maxI.l}</span><span class="insight-sub">${this.formatMoney(maxI.v,currency)}</span></div><div class="insight-card glass"><span class="insight-label">Mayor gasto</span><span class="insight-value" style="color:var(--color-expense)">${maxE.l}</span><span class="insight-sub">${this.formatMoney(maxE.v,currency)}</span></div><div class="insight-card glass"><span class="insight-label">Total ahorrado</span><span class="insight-value" style="color:var(--color-accent)">${this.formatMoney(saved,currency)}</span><span class="insight-sub">Últimos 6 meses</span></div><div class="insight-card glass"><span class="insight-label">Transacciones</span><span class="insight-value">${allTx.length}</span><span class="insight-sub">Historial total</span></div>`;
    await this.renderBudgets();
  },

  switchStatsTab(tab) {
    const isCharts=tab==='charts';
    document.getElementById('stats-tab-charts').classList.toggle('hidden',!isCharts);
    document.getElementById('stats-tab-budgets').classList.toggle('hidden',isCharts);
    document.getElementById('stab-charts').classList.toggle('active',isCharts);
    document.getElementById('stab-budgets').classList.toggle('active',!isCharts);
    if (!isCharts) this.renderBudgets();
  },

  async renderBudgets() {
    const user=await Auth.getUser(); if (!user) return;
    const currency=this.getCurrencySymbol((user.user_metadata||{}).currency||'USD');
    const now=new Date(), [budgets, breakdown] = await Promise.all([Budgets.getAll(), Data.getCategoryBreakdown(now.getFullYear(),now.getMonth())]);
    const container=document.getElementById('budgets-list'); if (!container) return;
    if (!budgets.length) { container.innerHTML=`<div class="empty-state glass" style="padding:24px"><span class="empty-icon">💰</span><p>Sin presupuestos</p><small>Agrega un límite por categoría</small></div>`; return; }
    container.innerHTML=budgets.map(b=>{
      const cat=CATEGORIES.find(c=>c.id===b.category)||CATEGORIES.at(-1);
      const spent=breakdown.find(c=>c.id===b.category)?.amount||0;
      const pct=Math.min((spent/Number(b.amount))*100,100);
      const cls=pct>=100?'danger':pct>=80?'warning':'';
      return `<div class="budget-card glass"><div class="budget-card-header"><div class="budget-card-emoji">${cat.emoji}</div><div class="budget-card-info"><div class="budget-card-name">${cat.label}</div><div class="budget-card-meta">${this.formatMoney(spent,currency)} de ${this.formatMoney(Number(b.amount),currency)}</div></div><button class="btn-ghost" style="padding:6px 10px;font-size:12px" onclick="UI.openBudgetModal('${b.id}','${b.category}',${b.amount})">Editar</button><button class="btn-ghost" style="padding:6px 10px;font-size:12px;color:var(--color-expense)" onclick="Budgets.delete('${b.id}')">✕</button></div><div class="budget-progress-track"><div class="budget-progress-fill ${cls}" style="width:${pct}%"></div></div></div>`;
    }).join('');
    await this._renderBudgetAlerts(currency);
  },

  // ── Goals ──────────────────────────────────────────
  async renderGoals() {
    const user=await Auth.getUser(); if (!user) return;
    const currency=this.getCurrencySymbol((user.user_metadata||{}).currency||'USD');
    const goals=await Goals.getAll();
    const container=document.getElementById('goals-list'); if (!container) return;
    if (!goals.length) { container.innerHTML=`<div class="empty-state glass" style="padding:20px"><span class="empty-icon">🎯</span><p>Sin metas aún</p></div>`; return; }
    container.innerHTML=goals.map(g=>{
      const pct=Math.min((Number(g.current_amount)/Number(g.target_amount))*100,100);
      const hue=parseInt(g.color?.replace('#','')||'8b5cf6',16);
      const dlLabel=g.deadline?`Hasta ${new Date(g.deadline+'T00:00:00').toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}`:'Sin fecha límite';
      return `<div class="goal-card glass ${g.completed?'goal-completed':''}" onclick="UI.openFundsModal('${g.id}','${g.name}',${g.current_amount},${g.target_amount})"><div class="goal-card-header"><div class="goal-emoji">${g.emoji}</div><div class="goal-info"><div class="goal-name">${this.escapeHtml(g.name)}</div><div class="goal-deadline">${dlLabel}</div></div><div class="goal-pct">${Math.round(pct)}%</div></div><div class="goal-thermometer"><div class="goal-thermometer-fill" style="width:${pct}%;background:${g.color||'var(--color-accent)'}"></div></div><div class="goal-card-footer"><div class="goal-amounts"><strong>${this.formatMoney(Number(g.current_amount),currency)}</strong></div><div>${this.formatMoney(Number(g.target_amount),currency)}</div></div></div>`;
    }).join('');
  },

  // ── Profile ────────────────────────────────────────
  async updateProfileView() {
    const user=await Auth.getUser(); if (!user) return;
    const meta=user.user_metadata||{}, name=meta.display_name||user.email||'Usuario';
    const cur=CURRENCIES.find(c=>c.code===(meta.currency||'USD'));
    document.getElementById('profile-display-name').textContent=name;
    document.getElementById('profile-username-display').textContent=user.email;
    document.getElementById('profile-avatar-display').textContent=name[0].toUpperCase();
    document.getElementById('profile-currency').textContent=cur?`${cur.flag} ${cur.code}`:'USD';
    document.getElementById('dash-avatar-letter').textContent=name[0].toUpperCase();
    this._applyTheme();
  },

  // ── Modals: Transaction ────────────────────────────
  openModal() {
    this.selectedCategory=null;
    ['tx-edit-id','tx-amount','tx-desc'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('tx-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('modal-title').textContent='Nueva transacción';
    document.getElementById('btn-save-label').textContent='Guardar';
    document.getElementById('recurring-toggle').setAttribute('aria-pressed','false');
    document.getElementById('btn-repeat-tx').classList.add('hidden');
    this.setType('expense'); this.buildCategoryGrid();
    this._showModal('modal-transaction');
    setTimeout(()=>document.getElementById('tx-amount').focus(),300);
  },
  async openEditModal(id) {
    const all=await Data.getAll(), tx=all.find(t=>t.id===id); if (!tx) return;
    document.getElementById('tx-edit-id').value=tx.id;
    document.getElementById('tx-amount').value=tx.amount;
    document.getElementById('tx-desc').value=tx.description;
    document.getElementById('tx-date').value=tx.date;
    document.getElementById('modal-title').textContent='Editar transacción';
    document.getElementById('btn-save-label').textContent='Actualizar';
    document.getElementById('recurring-toggle').setAttribute('aria-pressed',tx.recurring?'true':'false');
    document.getElementById('btn-repeat-tx').classList.remove('hidden');
    this.setType(tx.type); this.selectedCategory=tx.category; this.buildCategoryGrid();
    this._showModal('modal-transaction');
  },
  repeatTransaction() {
    document.getElementById('tx-edit-id').value='';
    document.getElementById('tx-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('btn-save-tx').click(); // Re-saves as new!
  },
  toggleRecurring() {
    const btn=document.getElementById('recurring-toggle');
    btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed')==='true'?'false':'true');
  },
  closeModal() { this._hideModal('modal-transaction'); },
  setType(type) {
    const bI=document.getElementById('type-income'), bE=document.getElementById('type-expense');
    bI.classList.toggle('active',type==='income'); bE.classList.toggle('active',type==='expense');
    bI.setAttribute('aria-pressed',type==='income'); bE.setAttribute('aria-pressed',type==='expense');
  },
  buildCategoryGrid() {
    const g=document.getElementById('category-grid'); if (!g) return;
    g.innerHTML=CATEGORIES.map(cat=>`<button class="cat-pill ${this.selectedCategory===cat.id?'selected':''}" onclick="UI.selectCategory('${cat.id}')" aria-label="${cat.label}" aria-pressed="${this.selectedCategory===cat.id}">${cat.emoji}<span>${cat.label}</span></button>`).join('');
  },
  selectCategory(id) { this.selectedCategory=id; this.buildCategoryGrid(); },

  // ── Modals: Budget ─────────────────────────────────
  async openBudgetModal(id,cat,amount) {
    const user=await Auth.getUser(); if (!user) return;
    const currency=this.getCurrencySymbol((user.user_metadata||{}).currency||'USD');
    document.getElementById('budget-currency-symbol').textContent=currency;
    document.getElementById('budget-edit-id').value=id||'';
    document.getElementById('budget-amount').value=amount||'';
    const sel=document.getElementById('budget-category');
    sel.innerHTML=CATEGORIES.map(c=>`<option value="${c.id}" ${cat===c.id?'selected':''}>${c.emoji} ${c.label}</option>`).join('');
    if (cat) sel.value=cat;
    document.getElementById('budget-modal-title').textContent=id?'Editar presupuesto':'Nuevo presupuesto';
    this._showModal('modal-budget');
  },
  closeBudgetModal() { this._hideModal('modal-budget'); },

  // ── Modals: Goal ───────────────────────────────────
  openGoalModal(id) {
    Goals._sel='🎯';
    document.getElementById('goal-edit-id').value=id||'';
    document.getElementById('goal-name').value='';
    document.getElementById('goal-target').value='';
    document.getElementById('goal-deadline').value='';
    document.getElementById('goal-modal-title').textContent='Nueva meta';
    document.getElementById('goal-save-label').textContent='Crear meta';
    const picker=document.getElementById('goal-emoji-picker');
    picker.innerHTML=GOAL_EMOJIS.map(e=>`<button class="emoji-option ${e==='🎯'?'selected':''}" onclick="UI._selEmoji('${e}',this)">${e}</button>`).join('');
    this._showModal('modal-goal');
  },
  _selEmoji(e,btn) {
    Goals._sel=e;
    document.querySelectorAll('.emoji-option').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
  },
  closeGoalModal() { this._hideModal('modal-goal'); },

  // ── Modals: Funds ──────────────────────────────────
  async openFundsModal(id,name,current,target) {
    const user=await Auth.getUser(); if (!user) return;
    const currency=this.getCurrencySymbol((user.user_metadata||{}).currency||'USD');
    document.getElementById('funds-modal-title').textContent=name;
    document.getElementById('funds-goal-id').value=id;
    document.getElementById('funds-amount').value='';
    document.getElementById('funds-current').textContent=this.formatMoney(current,currency);
    document.getElementById('funds-target-label').textContent=`de ${this.formatMoney(target,currency)}`;
    this._showModal('modal-funds');
  },
  closeFundsModal() { this._hideModal('modal-funds'); },

  // ── Modals: Currency/Delete ────────────────────────
  async openCurrencyModal() {
    const user=await Auth.getUser(), cur=(user?.user_metadata||{}).currency||'USD';
    document.getElementById('currency-options').innerHTML=CURRENCIES.map(c=>`<button class="currency-option ${cur===c.code?'selected':''}" onclick="UI.selectCurrency('${c.code}')"><span>${c.flag} ${c.code} — ${c.name}</span><svg class="currency-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></button>`).join('');
    this._showModal('modal-currency');
  },
  async selectCurrency(code) {
    await db.auth.updateUser({data:{currency:code}}); Auth.clearCache();
    this.closeCurrencyModal(); await this.updateProfileView(); await this.renderDashboard(); this.toast('Moneda actualizada ✓','success');
  },
  closeCurrencyModal() { this._hideModal('modal-currency'); },
  showDeleteConfirm() { this._showModal('modal-delete'); },
  closeDeleteModal()  { this._hideModal('modal-delete'); },

  _showModal(id) {
    document.getElementById('modal-backdrop').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow='hidden'; this._modalOpen=id;
  },
  _hideModal(id) {
    const m=document.getElementById(id); m.classList.add('closing');
    setTimeout(()=>{ m.classList.remove('hidden','closing'); m.classList.add('hidden'); },280);
    if (this._modalOpen===id) { document.getElementById('modal-backdrop').classList.add('hidden'); document.body.style.overflow=''; this._modalOpen=false; }
  },

  // ── Export ─────────────────────────────────────────
  async exportCSV() {
    const user=await Auth.getUser(), txs=await Data.getAll();
    if (!txs.length) { this.toast('No hay transacciones para exportar','info'); return; }
    const cur=(user?.user_metadata||{}).currency||'USD';
    const header='Fecha,Tipo,Descripción,Categoría,Monto,Moneda,Recurrente\n';
    const rows=txs.map(t=>`${t.date},${t.type==='income'?'Ingreso':'Gasto'},"${t.description.replace(/"/g,'""')}",${CATEGORIES.find(c=>c.id===t.category)?.label||t.category},${t.amount},${cur},${t.recurring?'Sí':'No'}`).join('\n');
    const blob=new Blob(['\uFEFF'+header+rows],{type:'text/csv;charset=utf-8;'});
    const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`numira_${cur}_${new Date().toISOString().split('T')[0]}.csv`});
    a.click(); URL.revokeObjectURL(a.href); this.toast('CSV exportado ✓','success');
  },

  // ── Toast / Helpers ────────────────────────────────
  toast(msg,type='info') {
    const el=document.getElementById('toast'); el.textContent=msg; el.className=`toast glass ${type}`; el.classList.add('show');
    clearTimeout(this._tt); this._tt=setTimeout(()=>el.classList.remove('show'),3000);
  },
  formatMoney(amount,symbol='$') {
    const a=Math.abs(amount);
    if (a>=1e6) return `${symbol}${(a/1e6).toFixed(1)}M`;
    if (a>=1e4) return `${symbol}${(a/1e3).toFixed(1)}K`;
    return `${symbol}${a.toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  },
  getCurrencySymbol(code) { return CURRENCIES.find(c=>c.code===code)?.symbol||'$'; },
  escapeHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
};

// ── CHARTS ────────────────────────────────────────────
const Charts = {
  drawDonut(cid,income,expense) {
    const cv=document.getElementById(cid); if (!cv) return;
    const ctx=cv.getContext('2d'), dpr=window.devicePixelRatio||1, sz=120;
    cv.width=sz*dpr; cv.height=sz*dpr; cv.style.width=sz+'px'; cv.style.height=sz+'px'; ctx.scale(dpr,dpr);
    const cx=sz/2, cy=sz/2, r=48, inner=34, total=income+expense;
    ctx.clearRect(0,0,sz,sz);
    if (!total) { ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.arc(cx,cy,inner,Math.PI*2,0,true); ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fill(); return; }
    const ds=(s,e,c1,c2)=>{ const g=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r); g.addColorStop(0,c1); g.addColorStop(1,c2); ctx.beginPath(); ctx.arc(cx,cy,r,s,e); ctx.arc(cx,cy,inner,e,s,true); ctx.closePath(); ctx.fillStyle=g; ctx.fill(); };
    const st=-Math.PI/2, iA=(income/total)*Math.PI*2, eA=(expense/total)*Math.PI*2;
    if(income>0) ds(st,st+iA,'rgba(52,211,153,.9)','rgba(16,185,129,.7)');
    if(expense>0) ds(st+iA,st+iA+eA,'rgba(251,113,133,.9)','rgba(244,63,94,.7)');
  },
  drawBars(cid,data,currency='$') {
    const cv=document.getElementById(cid); if (!cv) return;
    const ctx=cv.getContext('2d'), dpr=window.devicePixelRatio||1, W=cv.offsetWidth||340, H=180;
    cv.width=W*dpr; cv.height=H*dpr; cv.style.height=H+'px'; ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);
    const mx=Math.max(...data.map(d=>Math.max(d.income,d.expense)),1), pL=40,pR=12,pT=10,pB=36, cW=W-pL-pR, cH=H-pT-pB;
    const gW=cW/data.length, bW=Math.min(gW*.36,18), gap=4;
    ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=1;
    [.25,.5,.75,1].forEach(p=>{ const y=pT+cH*(1-p); ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke(); });
    ctx.fillStyle='rgba(255,255,255,.3)'; ctx.font='10px Inter,sans-serif'; ctx.textAlign='right';
    [.5,1].forEach(p=>{ const y=pT+cH*(1-p)+4,v=mx*p; ctx.fillText(v>=1000?`${(v/1000).toFixed(0)}K`:v.toFixed(0),pL-5,y); });
    data.forEach((d,i)=>{
      const x=pL+i*gW+gW/2;
      const bar=(val,ox,c1,c2)=>{ const bH=(val/mx)*cH,bx=x+ox,by=pT+cH-bH,rd=Math.min(5,bW/2); const g=ctx.createLinearGradient(0,by,0,by+bH); g.addColorStop(0,c1); g.addColorStop(1,c2); ctx.beginPath(); ctx.moveTo(bx+rd,by); ctx.lineTo(bx+bW-rd,by); ctx.quadraticCurveTo(bx+bW,by,bx+bW,by+rd); ctx.lineTo(bx+bW,by+bH); ctx.lineTo(bx,by+bH); ctx.lineTo(bx,by+rd); ctx.quadraticCurveTo(bx,by,bx+rd,by); ctx.closePath(); ctx.fillStyle=g; ctx.fill(); };
      if(d.income>0)  bar(d.income, -(bW+gap/2),'rgba(52,211,153,.9)','rgba(16,185,129,.4)');
      if(d.expense>0) bar(d.expense, gap/2,'rgba(251,113,133,.9)','rgba(244,63,94,.4)');
      ctx.fillStyle='rgba(255,255,255,.45)'; ctx.textAlign='center'; ctx.font='600 10px Inter,sans-serif'; ctx.fillText(d.label,x,H-pB+16);
    });
  }
};

// ── SKELETON CSS ──────────────────────────────────────
(()=>{ const s=document.createElement('style'); s.textContent=`.skeleton-list{display:flex;flex-direction:column;gap:10px}.skeleton-item{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.05)}.skeleton-circle{width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.08);flex-shrink:0;animation:shimmer 1.4s infinite}.skeleton-lines{flex:1;display:flex;flex-direction:column;gap:8px}.skeleton-line{height:10px;border-radius:999px;background:rgba(255,255,255,.08);animation:shimmer 1.4s infinite}.skeleton-line.w70{width:70%}.skeleton-line.w40{width:40%}.skeleton-line.w20{width:20%}@keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}`; document.head.appendChild(s); })();

// ── KEYBOARD + SWIPE ──────────────────────────────────
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&UI._modalOpen) UI._hideModal(UI._modalOpen); });
(()=>{ let sY=0,sX=0; document.addEventListener('touchstart',e=>{sY=e.touches[0].clientY;sX=e.touches[0].clientX;},{passive:true}); document.addEventListener('touchend',e=>{ const dY=e.changedTouches[0].clientY-sY,dX=Math.abs(e.changedTouches[0].clientX-sX); if(UI._modalOpen&&dY>80&&dX<60)UI._hideModal(UI._modalOpen); },{passive:true}); })();

// ── BOOTSTRAP ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{ if(!db){console.error('Supabase no init'); return;} UI.init(); });

/* app.js — shared for multi-page Bank of Mel demo
   - Uses localStorage to persist accounts & transactions
   - Exposes page-specific initialization based on body[data-page]
*/

(() => {
  /* ---------- Utilities ---------- */
  const uid = (p='id') => p + '_' + Math.random().toString(36).slice(2,9);
  const nowISO = () => new Date().toISOString();
  const currency = (n) => 'R ' + (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const STORAGE_KEY = 'bankOfMel:v1';

  /* ---------- Simple PIN hashing (demo only) ---------- */
function hashPIN(pin){
  return btoa(pin + '::bankofmel'); // simple obfuscation for demo
}
function verifyPIN(input, hash){
  return hashPIN(input) === hash;
}

  /* ---------- State & persistence ---------- */
  let state = { accounts: [], selectedAccountId: null };

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){ state = defaultDemo(); saveState(); return; }
      state = JSON.parse(raw);
      if(!Array.isArray(state.accounts)) state.accounts = [];
      if(!state.selectedAccountId && state.accounts.length) state.selectedAccountId = state.accounts[0].id;
    }catch(e){
      console.error('load error', e);
      state = defaultDemo(); saveState();
    }
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  /* ---------- Default demo data ---------- */
  function defaultDemo(){
    const a1 = { id: uid('acc'), name: 'Anandi Kiva', number: '549322605480', balance: 2000.00, createdAt: nowISO(), transactions: [] };
    // seed one deposit tx
    a1.transactions.unshift({ id: uid('tx'), type:'deposit', amount:2000.00, balanceAfter:2000.00, desc:'Initial deposit', meta:{}, date: nowISO() });
    return { accounts:[a1], selectedAccountId:a1.id };
  }

  /* ---------- Account helpers ---------- */
  function findAccount(id){ return state.accounts.find(a=>a.id===id) || null; }

  function createAccount(name, number, initial, pin){
    const acc = { id: uid('acc'), name: name || 'New Account', number: number || (Math.floor(Math.random()*900000000)+100000000).toString(), balance: +Number(initial||0).toFixed(2),pinHash: hashPIN(pin),createdAt: nowISO(), transactions: [] };
    if(Number(initial) > 0){
      acc.transactions.unshift({ id: uid('tx'), type:'deposit', amount:+Number(initial), balanceAfter: acc.balance, desc:'Initial deposit', meta:{}, date: nowISO() });
    }
    state.accounts.unshift(acc);
    state.selectedAccountId = acc.id;
    saveState();
  }

  function deleteAccount(id){
    const idx = state.accounts.findIndex(a=>a.id===id); if(idx===-1) return false;
    state.accounts.splice(idx,1);
    if(state.accounts.length) state.selectedAccountId = state.accounts[0].id; else state.selectedAccountId = null;
    saveState(); return true;
  }

  /* ---------- Transactions ---------- */
  function addTransaction(accountId, type, amount, desc='', meta={}){
    const acc = findAccount(accountId);
    if(!acc) throw new Error('Account not found');
    amount = +Number(amount).toFixed(2);
    if(amount <= 0) throw new Error('Amount must be > 0');

    if(type === 'withdraw' && acc.balance < amount) throw new Error('Insufficient funds');

    if(type === 'deposit') acc.balance = +(acc.balance + amount).toFixed(2);
    else if(type === 'withdraw') acc.balance = +(acc.balance - amount).toFixed(2);
    else throw new Error('Unknown tx type');

    acc.transactions.unshift({ id: uid('tx'), type, amount, balanceAfter: acc.balance, desc, meta, date: nowISO() });
    saveState();
  }

  /* ---------- CSV export ---------- */
  function exportAccountCSV(accountId){
    const acc = findAccount(accountId); if(!acc) return;
    const rows = [['date','type','amount','balanceAfter','description']];
    acc.transactions.slice().reverse().forEach(tx => rows.push([tx.date, tx.type, tx.amount, tx.balanceAfter, tx.desc || '']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadBlob(csv, `${acc.name.replace(/\s+/g,'_')}_transactions.csv`, 'text/csv');
  }
  function downloadBlob(content, filename, mime='text/csv'){ const b = new Blob([content],{type:mime}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); }

  /* ---------- Rendering utilities for select lists ---------- */
  function populateAccountSelect(selectEl, includeEmpty=false){
    if(!selectEl) return;
    selectEl.innerHTML = '';
    if(includeEmpty) selectEl.appendChild(optionEl('','-- select account --'));
    state.accounts.forEach(acc => selectEl.appendChild(optionEl(acc.id, `${acc.name} — ${acc.number}`)));
    // preserve previous selection if present
    if(state.selectedAccountId) selectEl.value = state.selectedAccountId;
  }
  function optionEl(val, text){ const o = document.createElement('option'); o.value = val; o.textContent = text; return o; }

  /* ---------- Page initializers ---------- */

  function initCreatePage(){
    const form = document.getElementById('createAccountForm');
    form && form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('createFullName').value.trim();
      const number = document.getElementById('createAccountNumber').value.trim();
       const init = parseFloat(document.getElementById('createInitial').value) || 0;
       const pin = document.getElementById('createPIN').value;
       
       if(!/^\d{4}$/.test(pin)){
  return alert('PIN must be exactly 4 digits');
}
createAccount(name, number, init, pin);
        alert('Account created');
        // clear
        form.reset();
      }catch(err){ alert(err.message); }
    });
  }

  function initDepositPage(){
    const sel = document.getElementById('depositAccount');
    const form = document.getElementById('depositForm');
    populateAccountSelect(sel, true);
    form && form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const accId = sel.value;
      const amount = parseFloat(document.getElementById('depositAmount').value) || 0;
      if(!accId) return alert('Select account');
      try{
        addTransaction(accId, 'deposit', amount, 'Deposit via UI');
        alert('Deposit successful');
        form.reset();
      }catch(err){ alert(err.message); }
    });
  }

  function initWithdrawPage(){
    const sel = document.getElementById('withdrawAccount');
    const form = document.getElementById('withdrawForm');
    populateAccountSelect(sel, true);
    form && form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const accId = sel.value;
      const amount = parseFloat(document.getElementById('withdrawAmount').value) || 0;
      if(!accId) return alert('Select account');
      try{
        addTransaction(accId, 'withdraw', amount, 'Withdrawal via UI');
        alert('Withdrawal successful');
        form.reset();
      }catch(err){ alert(err.message); }
    });
  }

  function initBalancePage(){
    const el = document.getElementById('balanceAmount');
    // pick selected account if present
    const acc = findAccount(state.selectedAccountId) || state.accounts[0] || null;
    if(acc){
      el.textContent = currency(acc.balance);
    } else {
      el.textContent = currency(0);
    }
  }

  function renderHistoryList(accountId){
    const wrap = document.getElementById('historyList');
    if(!wrap) return;
    wrap.innerHTML = '';
    const acc = findAccount(accountId) || null;
    if(!acc){ wrap.innerHTML = '<div class="small muted">No account selected</div>'; return; }
    if(!acc.transactions.length){ wrap.innerHTML = '<div class="small muted">No transactions</div>'; return; }
    acc.transactions.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="left">
          <div class="what">${tx.type[0].toUpperCase()+tx.type.slice(1)}</div>
          <div class="meta">${new Date(tx.date).toLocaleString()} · ${tx.desc || ''}</div>
        </div>
        <div class="right">
          <div class="history-amount">${tx.type === 'withdraw' ? '-' : '+'}${currency(tx.amount)}</div>
          <div class="small muted">Balance: ${currency(tx.balanceAfter)}</div>
        </div>
      `;
      wrap.appendChild(item);
    });
  }

  function initHistoryPage(){
    const sel = document.getElementById('historyAccount');
    populateAccountSelect(sel, true);
    if(sel) sel.addEventListener('change', ()=> renderHistoryList(sel.value));
    // initial render
    renderHistoryList(sel && sel.value ? sel.value : state.accounts[0] && state.accounts[0].id);
    const exp = document.getElementById('exportHistory');
    exp && exp.addEventListener('click', ()=> {
      const accId = sel.value;
      if(!accId) return alert('Select account first');
      exportAccountCSV(accId);
    });
  }

  function renderAccountOverview(accountId){
    const wrap = document.getElementById('accountOverview');
    if(!wrap) return;
    wrap.innerHTML = '';
    const acc = findAccount(accountId);
    if(!acc){ wrap.innerHTML = '<div class="small muted">No account selected</div>'; return; }

    const html = `
      <div class="account-overview-inner">
        <div style="padding:18px; border-radius:12px; background:linear-gradient(135deg,#7c3aed,#b56cff); color:white">
          <div style="opacity:0.95; font-size:13px">Account Holder</div>
          <div style="font-size:20px; font-weight:700; margin-top:8px">${escapeHtml(acc.name)}</div>
          <div style="opacity:0.85; margin-top:12px">Account Number</div>
          <div style="font-weight:600; margin-top:6px"># ${escapeHtml(acc.number)}</div>
          <div style="opacity:0.85; margin-top:12px">Current Balance</div>
          <div style="font-size:22px; font-weight:800; margin-top:8px">${currency(acc.balance)}</div>
        </div>

        <div style="display:flex; gap:12px; margin-top:12px; flex-wrap:wrap">
          <div style="flex:1; min-width:200px; background:#fff; border-radius:10px; padding:12px; border:1px solid rgba(124,58,237,0.05)">
            <div class="small">Account Status</div>
            <div style="font-weight:700; margin-top:6px">Active</div>
          </div>
          <div style="flex:1; min-width:200px; background:#fff; border-radius:10px; padding:12px; border:1px solid rgba(124,58,237,0.05)">
            <div class="small">Account Type</div>
            <div style="font-weight:700; margin-top:6px">Standard</div>
          </div>
          <div style="flex:1; min-width:200px; background:#fff; border-radius:10px; padding:12px; border:1px solid rgba(124,58,237,0.05)">
            <div class="small">Member Since</div>
            <div style="font-weight:700; margin-top:6px">${new Date(acc.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    `;
    wrap.innerHTML = html;

    // wire actions
    const exportBtn = document.getElementById('exportAccountCSV');
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if(exportBtn) exportBtn.onclick = () => exportAccountCSV(acc.id);
    if(deleteBtn) deleteBtn.onclick = () => {
      if(confirm(`Delete account "${acc.name}"? This cannot be undone locally.`)){
        deleteAccount(acc.id);
        // refresh selects and overview
        populateAllSelects();
        renderAccountOverview(state.accounts[0] ? state.accounts[0].id : null);
      }
    };
  }

  function initDetailsPage(){
    const sel = document.getElementById('detailsAccount');
    populateAccountSelect(sel, true);
    if(sel) sel.addEventListener('change', ()=> renderAccountOverview(sel.value));
    // initial render
    renderAccountOverview(sel && sel.value ? sel.value : (state.accounts[0] && state.accounts[0].id));
  }

  /* ---------- Helpers ---------- */
  function populateAllSelects(){
    const els = document.querySelectorAll('select');
    els.forEach(s => {
      // for selects that expect a blank default, keep current behaviour by calling populateAccountSelect.
      // We'll replace content if they are one of our known selects.
      if(s.id === 'depositAccount' || s.id === 'withdrawAccount' || s.id === 'historyAccount' || s.id === 'detailsAccount'){
        populateAccountSelect(s, true);
      }
    });
  }

  function escapeHtml(s){
    if(s == null) return '';
    return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
  }

  /* ---------- Page boot ---------- */
  function init(){
    loadState();
    populateAllSelects();

    const page = document.body.getAttribute('data-page');
    try{
      if(page === 'create') initCreatePage();
      if(page === 'deposit') initDepositPage();
      if(page === 'withdraw') initWithdrawPage();
      if(page === 'balance') initBalancePage();
      if(page === 'history') initHistoryPage();
      if(page === 'details') initDetailsPage();
    }catch(err){
      console.error('init error', err);
    }

    // update nav active state (in case server/browser cache shows wrong)
    document.querySelectorAll('.main-nav .nav-item').forEach(a=>{
      a.classList.toggle('active', a.getAttribute('href') === location.pathname.split('/').pop() || (a.getAttribute('href') === 'index.html' && (location.pathname.split('/').pop() === '' || location.pathname.split('/').pop()==='index.html')));
    });
  }

  /* Run on load */
  document.addEventListener('DOMContentLoaded', init);

  /* Expose some things for console debugging (optional) */
  window._BankOfMel = {
    state,
    createAccount,
    addTransaction,
    exportAccountCSV,
    deleteAccount,
    reload: () => { loadState(); init(); }
  };
})();

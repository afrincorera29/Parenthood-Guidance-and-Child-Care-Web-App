/* ====== CONFIG: paste your free API key here (see steps) ====== */
const API_KEY = '73PAyppOa4gNZLgVnsy7n7U6xq6s0KhqXxRIhc6F';
const API_URL = 'https://api.api-ninjas.com/v1/facts';

/* ====== helpers ====== */
const L = k => JSON.parse(localStorage.getItem(k) || '[]');
const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = s => document.querySelector(s);
const DAY = 864e5;
async function hash(p) {                       // NFR3: passwords hashed
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  return btoa(p);
}
const ageM = dob => Math.max(0, Math.floor((Date.now() - new Date(dob)) / (30.44 * DAY)));
const ageTxt = dob => { const m = ageM(dob); return m < 24 ? m + ' months' : (m / 12).toFixed(1) + ' years'; };

/* sample vaccination schedule: [name, days after birth] – confirm with your paediatrician */
const VAX = [['BCG',0],['Hepatitis B (birth dose)',0],['OPV / Pentavalent – dose 1',42],['Pentavalent – dose 2',70],
  ['Pentavalent – dose 3',98],['MMR – dose 1',270],['MMR – dose 2',480],['DPT Booster',480]];
const vdone = () => JSON.parse(localStorage.getItem('vdone') || '{}');

const SEED_TIPS = [
  {min:0,max:6,text:'Feed on demand and ensure plenty of skin-to-skin contact. Always place baby on the back to sleep.'},
  {min:0,max:6,text:'Tummy time for a few minutes several times a day builds neck and shoulder strength.'},
  {min:6,max:12,text:'Start soft, iron-rich complementary foods around 6 months while continuing milk feeds.'},
  {min:6,max:12,text:'Baby-proof your home: cover sockets and keep small objects out of reach.'},
  {min:12,max:36,text:'Read picture books daily and name objects to boost language development.'},
  {min:12,max:36,text:'Keep a consistent bedtime routine; toddlers need 11–14 hours of sleep per day.'},
  {min:36,max:144,text:'Limit screen time, encourage outdoor play, and let children help with small chores.'}
];

/* ====== state ====== */
let U = null, tab = 'children', cid = null, editId = null, mode = 'login';

async function init() {
  let users = L('users');
  if (!users.length) {
    users.push({id: uid(), name: 'Administrator', email: 'admin@parentcare.com', hash: await hash('Admin@123'), role: 'admin'});
    S('users', users);
  }
  if (!L('tips').length) S('tips', SEED_TIPS.map(t => ({...t, id: uid()})));
  const sid = sessionStorage.getItem('sid');
  U = users.find(u => u.id === sid) || null;
  render();
}

/* ====== AUTH (FR1) ====== */
function authView() {
  $('#nav').hidden = true; $('#who').innerHTML = '';
  $('#app').innerHTML = `<div class="card auth"><h2>${mode === 'login' ? 'Login' : 'Create account'}</h2>
  <form onsubmit="doAuth(event)">
   ${mode === 'register' ? '<label>Full name</label><input id="an" required>' : ''}
   <label>Email</label><input id="ae" type="email" required>
   <label>Password</label><input id="ap" type="password" minlength="6" required>
   <button class="p" type="submit">${mode === 'login' ? 'Login' : 'Register'}</button>
   <button class="s" type="button" onclick="mode='${mode === 'login' ? 'register' : 'login'}';render()">${mode === 'login' ? 'New user? Register' : 'Have an account? Login'}</button>
  </form><p class="muted" id="msg"></p>
  <p class="muted">Admin demo: admin@parentcare.com / Admin@123</p></div>`;
}
async function doAuth(e) {
  e.preventDefault();
  const email = $('#ae').value.trim().toLowerCase(), h = await hash($('#ap').value);
  const users = L('users');
  if (mode === 'register') {
    if (users.some(u => u.email === email)) return $('#msg').textContent = 'Email already registered.';
    const u = {id: uid(), name: $('#an').value.trim(), email, hash: h, role: 'parent'};
    users.push(u); S('users', users); U = u;
  } else {
    const u = users.find(x => x.email === email && x.hash === h);
    if (!u) return $('#msg').textContent = 'Invalid email or password.';
    U = u;
  }
  sessionStorage.setItem('sid', U.id); tab = U.role === 'admin' ? 'admin' : 'children'; render();
}
function logout() { sessionStorage.removeItem('sid'); U = null; mode = 'login'; render(); }

/* ====== data access (NFR4: only the owner's children) ====== */
const myKids = () => L('children').filter(c => c.uid === U.id);
const kid = () => { const k = myKids(); if (!k.find(c => c.id === cid)) cid = k[0]?.id || null; return k.find(c => c.id === cid); };
function kidPicker() {
  const k = myKids();
  if (!k.length) return '<p class="muted">Add a child profile first.</p>';
  kid();
  return `<label>Child</label><select onchange="cid=this.value;render()">${k.map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
}

/* ====== main render ====== */
function render() {
  if (!U) return authView();
  $('#who').innerHTML = `<small>${esc(U.name)} (${U.role})</small> <button class="s" style="margin:0 0 0 8px" onclick="logout()">Logout</button>`;
  const tabs = U.role === 'admin' ? [['admin','Manage Tips']] :
    [['children','Children'],['growth','Growth'],['vaccines','Vaccines'],['tips','Tips']];
  const n = $('#nav'); n.hidden = false;
  n.innerHTML = tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" onclick="tab='${t[0]}';editId=null;render()">${t[1]}</button>`).join('');
  const views = {children, growth, vaccines, tips, admin};
  $('#app').innerHTML = (U.role === 'parent' ? reminders() : '') + views[tab]();
}

/* ====== FR4: reminders ====== */
function reminders() {
  const done = vdone(), out = [];
  myKids().forEach(c => VAX.forEach(v => {
    if (done[c.id + '|' + v[0]]) return;
    const d = Math.ceil((new Date(c.dob).getTime() + v[1] * DAY - Date.now()) / DAY);
    if (d < 0) out.push(['red', `⚠️ ${esc(c.name)}: <b>${v[0]}</b> is overdue by ${-d} day(s).`]);
    else if (d <= 14) out.push(['', `🔔 ${esc(c.name)}: <b>${v[0]}</b> is due in ${d} day(s).`]);
  }));
  return out.map(o => `<div class="alert ${o[0]}">${o[1]}</div>`).join('');
}

/* ====== FR2: child profiles ====== */
function children() {
  const e = L('children').find(c => c.id === editId) || {};
  const list = myKids();
  return `<div class="card"><h2>${editId ? 'Edit' : 'Add'} child</h2>
  <form onsubmit="saveChild(event)"><div class="row">
   <div><label>Name</label><input id="cn" value="${esc(e.name)}" required></div>
   <div><label>Date of birth</label><input id="cd" type="date" max="${new Date().toISOString().slice(0,10)}" value="${e.dob || ''}" required></div>
   <div><label>Gender</label><select id="cg">${['Girl','Boy','Other'].map(g => `<option ${e.gender === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
  </div><button class="p">${editId ? 'Update' : 'Add'}</button>${editId ? '<button type="button" class="s" onclick="editId=null;render()">Cancel</button>' : ''}</form></div>
  <div class="card"><h2>My children</h2>${list.length ? `<div class="tw"><table><tr><th>Name</th><th>DOB</th><th>Age</th><th>Gender</th><th></th></tr>
  ${list.map(c => `<tr><td>${esc(c.name)}</td><td>${c.dob}</td><td>${ageTxt(c.dob)}</td><td>${c.gender}</td>
  <td><button class="s" onclick="editId='${c.id}';render()">Edit</button><button class="d" onclick="delChild('${c.id}')">Delete</button></td></tr>`).join('')}</table></div>` : '<p class="muted">No children added yet.</p>'}</div>`;
}
function saveChild(e) {
  e.preventDefault();
  let all = L('children');
  const d = {name: $('#cn').value.trim(), dob: $('#cd').value, gender: $('#cg').value};
  if (editId) all = all.map(c => c.id === editId ? {...c, ...d} : c);
  else all.push({id: uid(), uid: U.id, ...d});
  S('children', all); editId = null; render();
}
function delChild(id) {
  if (!confirm('Delete this child and all their records?')) return;
  S('children', L('children').filter(c => c.id !== id));
  S('records', L('records').filter(r => r.cid !== id)); render();
}

/* ====== FR3: growth & milestones ====== */
function growth() {
  const c = kid();
  const recs = c ? L('records').filter(r => r.cid === c.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  return `<div class="card"><h2>Growth &amp; milestones</h2>${kidPicker()}
  ${c ? `<form onsubmit="saveRec(event)"><div class="row">
   <div><label>Date</label><input id="rd" type="date" value="${new Date().toISOString().slice(0,10)}" required></div>
   <div><label>Height (cm)</label><input id="rh" type="number" step="0.1" min="0" required></div>
   <div><label>Weight (kg)</label><input id="rw" type="number" step="0.01" min="0" required></div></div>
   <label>Milestone (optional)</label><input id="rm" placeholder="e.g. First steps">
   <button class="p">Save record</button></form>` : ''}</div>
  ${c ? `<div class="card"><h2>History</h2>${recs.length ? `<div class="tw"><table><tr><th>Date</th><th>Height</th><th>Weight</th><th>Milestone</th><th></th></tr>
  ${recs.map(r => `<tr><td>${r.date}</td><td>${r.h} cm</td><td>${r.w} kg</td><td>${esc(r.m)}</td><td><button class="d" onclick="delRec('${r.id}')">✕</button></td></tr>`).join('')}</table></div>` : '<p class="muted">No records yet.</p>'}</div>` : ''}`;
}
function saveRec(e) {
  e.preventDefault();
  const r = L('records');
  r.push({id: uid(), cid: kid().id, date: $('#rd').value, h: $('#rh').value, w: $('#rw').value, m: $('#rm').value.trim()});
  S('records', r); render();
}
function delRec(id) { S('records', L('records').filter(r => r.id !== id)); render(); }

/* ====== vaccination tracker ====== */
function vaccines() {
  const c = kid(), done = vdone();
  let rows = '';
  if (c) rows = VAX.map(v => {
    const due = new Date(new Date(c.dob).getTime() + v[1] * DAY), d = Math.ceil((due - Date.now()) / DAY), k = c.id + '|' + v[0];
    const st = done[k] ? ['Given','done'] : d < 0 ? ['Overdue','over'] : d <= 14 ? ['Due soon','soon'] : ['Upcoming','up'];
    return `<tr><td>${v[0]}</td><td>${due.toISOString().slice(0,10)}</td><td><span class="tag ${st[1]}">${st[0]}</span></td>
    <td><input type="checkbox" style="width:auto" ${done[k] ? 'checked' : ''} onchange="toggleV('${k}',this.checked)"></td></tr>`;
  }).join('');
  return `<div class="card"><h2>Vaccination tracker</h2>${kidPicker()}
  ${c ? `<div class="tw"><table><tr><th>Vaccine</th><th>Due date</th><th>Status</th><th>Given?</th></tr>${rows}</table></div>
  <p class="muted">Sample schedule for demonstration. Always follow your paediatrician's advice.</p>` : ''}</div>`;
}
function toggleV(k, on) { const d = vdone(); on ? d[k] = true : delete d[k]; localStorage.setItem('vdone', JSON.stringify(d)); render(); }

/* ====== FR5: age-based tips + free API ====== */
function tips() {
  const c = kid(), m = c ? ageM(c.dob) : 0;
  const t = c ? L('tips').filter(x => m >= x.min && m < x.max) : [];
  return `<div class="card"><h2>Parenting tips</h2>${kidPicker()}
  ${c ? `<p class="muted">Tips for ${esc(c.name)} (${ageTxt(c.dob)})</p>
  ${t.length ? t.map(x => `<div class="tip">${esc(x.text)}</div>`).join('') : '<p class="muted">No tips for this age yet.</p>'}` : ''}</div>
  <div class="card"><h2>💡 Fresh tip from API</h2>
  <button class="p" style="margin-top:0" onclick="apiTip()">Get new tip</button>
  <div id="apiOut" class="muted" style="margin-top:10px"></div></div>`;
}
async function apiTip() {
  const o = $('#apiOut'); o.textContent = 'Loading…';
  try {
    if (API_KEY === 'YOUR_API_KEY_HERE') throw new Error('API key not set');
    const r = await fetch(API_URL, {headers: {'X-Api-Key': API_KEY}});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    o.innerHTML = `<div class="tip">${esc(j[0].fact || j[0].quote || JSON.stringify(j[0]))}</div>`;
  } catch (err) {
    o.innerHTML = `<div class="alert red">Could not load API data (${esc(err.message)}). Check your API key in the code.</div>`;
  }
}

/* ====== FR6: admin manages tips ====== */
function admin() {
  const e = L('tips').find(t => t.id === editId) || {};
  const tl = L('tips').sort((a, b) => a.min - b.min);
  return `<div class="card"><h2>${editId ? 'Update' : 'Add'} tip</h2>
  <form onsubmit="saveTip(event)"><div class="row">
   <div><label>From age (months)</label><input id="tmin" type="number" min="0" value="${e.min ?? 0}" required></div>
   <div><label>To age (months)</label><input id="tmax" type="number" min="1" value="${e.max ?? 12}" required></div></div>
   <label>Tip text</label><textarea id="tt" rows="3" required>${esc(e.text)}</textarea>
   <button class="p">${editId ? 'Update' : 'Add'}</button>${editId ? '<button type="button" class="s" onclick="editId=null;render()">Cancel</button>' : ''}</form></div>
  <div class="card"><h2>All tips</h2><div class="tw"><table><tr><th>Ages (months)</th><th>Tip</th><th></th></tr>
  ${tl.map(t => `<tr><td>${t.min}–${t.max}</td><td>${esc(t.text)}</td>
  <td><button class="s" onclick="editId='${t.id}';render()">Edit</button><button class="d" onclick="delTip('${t.id}')">Delete</button></td></tr>`).join('')}</table></div></div>`;
}
function saveTip(e) {
  e.preventDefault();
  let t = L('tips');
  const d = {min: +$('#tmin').value, max: +$('#tmax').value, text: $('#tt').value.trim()};
  if (editId) t = t.map(x => x.id === editId ? {...x, ...d} : x); else t.push({id: uid(), ...d});
  S('tips', t); editId = null; render();
}
function delTip(id) { if (confirm('Delete this tip?')) { S('tips', L('tips').filter(t => t.id !== id)); render(); } }

init();
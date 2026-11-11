'use strict';

const APP_VERSION = 'v3.6';

// ---------- スマホ内の保存（IndexedDB） ----------
// 日報と点検を同じ保存場所に入れ、type で区別する（'nippo' / 'inspection'）
const DB_NAME = 'nippo';
const STORE = 'reports';
const SAMPLE_STORE = 'samples'; // 見本の実写（key: 項目ID_ok / 項目ID_ng）
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(SAMPLE_STORE)) db.createObjectStore(SAMPLE_STORE, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn, store = STORE) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

const putRecord = (r) => tx('readwrite', (s) => s.put(r));
const deleteRecord = (id) => tx('readwrite', (s) => s.delete(id));
const getAllRecords = async () => (await tx('readonly', (s) => s.getAll())).map((r) => ({ type: 'nippo', ...r }));
const getRecord = async (id) => (await getAllRecords()).find((r) => r.id === id);

// ---------- 見本の実写 ----------
const sampleUrls = {}; // 'oil_ok' -> 表示用URL

async function loadSamples() {
  const list = await tx('readonly', (s) => s.getAll(), SAMPLE_STORE);
  Object.keys(sampleUrls).forEach((k) => { URL.revokeObjectURL(sampleUrls[k]); delete sampleUrls[k]; });
  list.forEach((r) => { sampleUrls[r.key] = URL.createObjectURL(r.blob); });
}

async function saveSample(key, blob) {
  await tx('readwrite', (s) => s.put({ key, blob, updatedAt: new Date().toISOString() }), SAMPLE_STORE);
  await loadSamples();
}

async function removeSample(key) {
  await tx('readwrite', (s) => s.delete(key), SAMPLE_STORE);
  await loadSamples();
}

// 見本の表示：実写があれば実写、なければイラスト
function samplePic(it, ok) {
  const url = sampleUrls[`${it.id}_${ok ? 'ok' : 'ng'}`];
  if (url) return `<img class="sample-photo" src="${url}" alt="${esc(it.name)}の${ok ? 'OK' : 'NG'}見本写真">`;
  return it.img ? ILLUST[it.img](ok) : '';
}

// 見本写真の登録・変更は管理者モード中だけ
const sampleEditEnabled = () => adminUnlocked;

// ---------- 管理者（担当者）ロック ----------
// ※デモ版の簡易ロックです。本番ではSupabaseのログインと権限で管理者を判定します。
const DEFAULT_PIN = '1234';
let adminUnlocked = false;

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nippo-admin:' + pin));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function checkPin(pin) {
  const saved = getSetting('pinHash');
  return (await hashPin(pin)) === (saved || (await hashPin(DEFAULT_PIN)));
}

function setAdmin(on) {
  adminUnlocked = on;
  $('#lock-form').hidden = on;
  $('#settings-body').hidden = !on;
  $('#admin-pill').hidden = !on;
  $('#nav-lock').style.display = on ? 'none' : '';
  if (on && sampleId && $('#sample').open) renderSampleDialog();
}

// ---------- 設定（ブラウザ保存） ----------
function getSetting(key) {
  try { return localStorage.getItem('nippo.' + key) || ''; } catch { return ''; }
}
function setSetting(key, value) {
  try { localStorage.setItem('nippo.' + key, value); } catch { /* 保存できない環境では無視 */ }
}

// デモ用の仮の車両（ナンバーは架空）。設定画面で変更できます。
const DEFAULT_VEHICLES = ['1号車 相模100あ12-34', '2号車 相模100い56-78', '3号車 相模130う90-12', '4号車 相模800え34-56'];
function getVehicles() {
  const v = getSetting('vehicles').split('\n').map((s) => s.trim()).filter(Boolean);
  return v.length ? v : DEFAULT_VEHICLES;
}

// デモ用のルート（コース）。管理画面のダッシュボードと同じ名前。設定画面で変更できます。
const DEFAULT_ROUTES = ['A 町田・八王子方面', 'B 横浜方面', 'C 県央方面', 'D 湘南方面', 'E 横持ち（工場→センター）'];
function getRoutes() {
  const v = getSetting('routes').split('\n').map((s) => s.trim()).filter(Boolean);
  return v.length ? v : DEFAULT_ROUTES;
}

// ---------- 便利関数 ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const pad = (n) => String(n).padStart(2, '0');
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

// 写真を縮小して保存容量を抑える（長辺1280px・JPEG）
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を変換できませんでした'))), 'image/jpeg', 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした')); };
    img.src = url;
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// 一時的に表示している写真のURL（閉じたら解放する）
const objectUrls = new Set();
function photoUrl(blob) {
  const u = URL.createObjectURL(blob);
  objectUrls.add(u);
  return u;
}
function releaseUrls(prefix) {
  objectUrls.forEach((u) => { if (!prefix || u.startsWith(prefix)) URL.revokeObjectURL(u); });
  objectUrls.clear();
}

// ---------- 共通の画面更新 ----------
function fillVehicleSelects() {
  const vehicles = getVehicles();
  const last = getSetting('vehicle') || LOGIN_VEHICLE;
  $$('.vehicle-select').forEach((sel) => {
    const current = sel.value || last;
    sel.innerHTML = '<option value="">選択してください</option>' +
      vehicles.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (vehicles.includes(current)) sel.value = current;
  });
  updateVehiclePill();
}

// 日報のルート欄（1便目は前回と同じルートを最初から選んでおく）
function fillRouteSelects(reset = false) {
  const routes = getRoutes();
  const opts = routes.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const r1 = $('#route1'), r2 = $('#route2');
  const cur1 = reset ? '' : r1.value, cur2 = reset ? '' : r2.value;
  r1.innerHTML = '<option value="">選択してください</option>' + opts;
  r2.innerHTML = '<option value="">なし</option>' + opts;
  const want1 = cur1 || getSetting('route1') || routes[0];
  if (routes.includes(want1)) r1.value = want1;
  if (routes.includes(cur2)) r2.value = cur2;
}

// 選択中の車両：点検・日報の両方とヘッダーに反映
function setCurrentVehicle(v) {
  setSetting('vehicle', v);
  $$('.vehicle-select').forEach((sel) => { if (sel.value !== v) sel.value = v; });
  updateVehiclePill();
  updateInspStatus();
}

// デモ：ログイン中の車両（本番はログインしたアカウントに紐づく車両を表示する）
const LOGIN_VEHICLE = DEFAULT_VEHICLES[0];
const LOGIN_NUMBER = '12-34';

function updateVehiclePill() {
  $('#vehicle-name').textContent = LOGIN_NUMBER;
  $('#vehicle-pill').setAttribute('aria-label', 'ログイン中の車両 ' + LOGIN_NUMBER);
}

$$('.vehicle-select').forEach((sel) => sel.addEventListener('change', () => setCurrentVehicle(sel.value)));

async function refreshPending() {
  const records = await getAllRecords();
  const n = records.filter((r) => r.status === 'pending').length;
  const el = $('#nav-pending');
  el.textContent = n > 99 ? '99+' : String(n);
  el.hidden = n === 0;
}

function updateNetStatus() {
  const el = $('#net');
  const label = navigator.onLine ? 'オンライン' : 'オフライン';
  $('#net-text').textContent = label;
  el.title = label;
  el.className = 'pill net ' + (navigator.onLine ? 'online' : 'offline');
}

async function refreshAll() {
  await refreshPending();
  await renderHistory();
  await updateInspStatus();
}

// =====================================================
// 運行前点検
// =====================================================
const ALL_ITEMS = CHECKLIST.flatMap((c) => c.items.map((i) => ({ ...i, category: c.category })));
let inspState = {}; // id -> { result: 'ok'|'ng', comment, photos: [Blob] }

function renderChecklist() {
  releaseUrls();
  $('#insp-list').innerHTML = `<p class="marks">${CHECK_NOTES.map(([m, t]) => `<span><b>${m}</b> ${esc(t)}</span>`).join('')}</p>` + CHECKLIST.map((cat) => `
    <h3 class="sub">${esc(cat.category)}</h3>
    ${cat.items.map((it) => `
      <div class="item" data-id="${it.id}">
        <div class="item-head">
          <div>
            <div class="item-name">${esc(it.group)}</div>
            <div class="item-point">${esc(it.point)}</div>
          </div>
          <button type="button" class="sample-btn" data-act="sample">見本</button>
        </div>
        <div class="judge">
          <button type="button" class="judge-btn ok" data-act="ok">OK</button>
          <button type="button" class="judge-btn ng" data-act="ng">NG</button>
        </div>
        <div class="judge-view" hidden></div>
        <div class="ng-area" hidden>
          <label>NGの状況<textarea rows="2" data-field="comment" placeholder="例：右前タイヤの溝が少ない"></textarea></label>
        </div>
        <div class="photo-area" hidden>
          <div class="thumbs"></div>
          <label class="photo-btn">📷 写真を撮る・選ぶ<input type="file" accept="image/*" capture="environment" data-field="photo" hidden></label>
        </div>
      </div>`).join('')}
  `).join('');
  updateProgress();
}

function renderItem(id) {
  const el = $(`.item[data-id="${id}"]`);
  const it = ALL_ITEMS.find((i) => i.id === id);
  const st = inspState[id] || {};
  el.classList.toggle('is-ok', st.result === 'ok');
  el.classList.toggle('is-ng', st.result === 'ng');
  $('.judge-btn.ok', el).classList.toggle('selected', st.result === 'ok');
  $('.judge-btn.ng', el).classList.toggle('selected', st.result === 'ng');

  // OK/NGを押したら、その状態の見本を表示する
  const view = $('.judge-view', el);
  if (st.result) {
    const ok = st.result === 'ok';
    const pic = samplePic(it, ok);
    view.innerHTML = `${pic ? `<div class="judge-pic">${pic}</div>` : ''}
      <div class="judge-text ${ok ? 'ok' : 'ng'}"><strong>${ok ? 'OK（正常）の目安' : 'NG（異常）の例'}</strong><br>${esc(ok ? it.ok : it.ng)}</div>`;
    view.hidden = false;
  } else {
    view.hidden = true;
  }

  $('.ng-area', el).hidden = st.result !== 'ng';
  $('.photo-area', el).hidden = !st.result;
  const photos = st.photos || [];
  $('.thumbs', el).innerHTML = photos.map((b, i) =>
    `<div class="thumb"><img src="${photoUrl(b)}" alt="点検写真${i + 1}" data-act="zoom"><button type="button" data-act="remove-photo" data-index="${i}" aria-label="写真を削除">×</button></div>`).join('');
  $('.photo-btn', el).firstChild.textContent = photos.length ? '📷 写真を追加' : (st.result === 'ng' ? '📷 NG箇所の写真を撮る' : '📷 写真を撮る（任意）');
}

function updateProgress() {
  const total = ALL_ITEMS.length;
  const done = ALL_ITEMS.filter((i) => inspState[i.id]?.result).length;
  const ng = ALL_ITEMS.filter((i) => inspState[i.id]?.result === 'ng').length;
  $('#insp-bar').style.width = `${(done / total) * 100}%`;

  $('#insp-count').textContent = `${done} / ${total} 項目`;
  const ngEl = $('#insp-ng');
  ngEl.textContent = `NG ${ng}件`;
  ngEl.hidden = ng === 0;
}

let sampleId = null;

function renderSampleDialog() {
  const it = ALL_ITEMS.find((i) => i.id === sampleId);
  $('#sample-title').textContent = it.name;
  $('#sample-point').textContent = `${it.group}：${it.point}`;
  for (const state of ['ok', 'ng']) {
    const ok = state === 'ok';
    const hasPhoto = !!sampleUrls[`${it.id}_${state}`];
    const pic = samplePic(it, ok);
    $(`#sample-${state}-img`).innerHTML = pic
      ? pic + (hasPhoto ? '' : '<div class="sample-tag">イラスト（実写未登録）</div>')
      : '<div class="sample-none">見本なし</div>';
    $(`#sample-${state}-text`).textContent = ok ? it.ok : it.ng;
    $(`.sample-edit[data-state="${state}"]`).innerHTML = sampleEditEnabled()
      ? `<label class="sample-upload">📷 ${hasPhoto ? '実写を変更' : '実写を登録'}<input type="file" accept="image/*" capture="environment" hidden></label>
         ${hasPhoto ? '<button type="button" class="sample-reset">イラストに戻す</button>' : ''}`
      : '';
  }
}

function openSample(id) {
  sampleId = id;
  renderSampleDialog();
  $('#sample').showModal();
}

// 見本の実写を登録・変更
$('#sample').addEventListener('change', async (e) => {
  const box = e.target.closest('.sample-edit');
  if (!box || !e.target.files.length) return;
  try {
    await saveSample(`${sampleId}_${box.dataset.state}`, await compressImage(e.target.files[0]));
    renderSampleDialog();
    if (inspState[sampleId]?.result) renderItem(sampleId);
    toast('見本の写真を登録しました');
  } catch (err) {
    toast(err.message);
  }
});

$('#sample').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('sample-reset')) return;
  const box = e.target.closest('.sample-edit');
  if (!confirm('登録した見本写真を削除して、イラストに戻しますか？')) return;
  await removeSample(`${sampleId}_${box.dataset.state}`);
  renderSampleDialog();
  if (inspState[sampleId]?.result) renderItem(sampleId);
});

$('#insp-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.item').dataset.id;
  const act = btn.dataset.act;
  if (act === 'sample') { openSample(id); return; }
  if (act === 'zoom') { openPhoto(btn.src); return; }
  const st = inspState[id] || (inspState[id] = { comment: '', photos: [] });
  if (act === 'ok' || act === 'ng') {
    st.result = act;
    renderItem(id);
    updateProgress();
  } else if (act === 'remove-photo') {
    st.photos.splice(Number(btn.dataset.index), 1);
    renderItem(id);
  }
});

$('#insp-list').addEventListener('input', (e) => {
  if (e.target.dataset.field !== 'comment') return;
  const id = e.target.closest('.item').dataset.id;
  (inspState[id] || (inspState[id] = { photos: [] })).comment = e.target.value;
});

$('#insp-list').addEventListener('change', async (e) => {
  if (e.target.dataset.field !== 'photo' || !e.target.files.length) return;
  const id = e.target.closest('.item').dataset.id;
  const st = inspState[id];
  try {
    for (const f of e.target.files) st.photos.push(await compressImage(f));
    renderItem(id);
  } catch (err) {
    toast(err.message);
  }
  e.target.value = '';
});

$('#insp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (!f.inspector.value.trim() || !f.vehicle.value || !f.date.value || !f.weather.value) {
    toast('日付・点検者・車両・天気を入力してください');
    return;
  }
  const missing = ALL_ITEMS.find((i) => !inspState[i.id]?.result);
  if (missing) {
    toast(`「${missing.name}」がまだ点検されていません`);
    $(`.item[data-id="${missing.id}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const ngItems = ALL_ITEMS.filter((i) => inspState[i.id].result === 'ng');
  const noPhoto = ngItems.filter((i) => !inspState[i.id].photos.length);
  if (noPhoto.length && !confirm(`NGの項目に写真がありません（${noPhoto.map((i) => i.name).join('、')}）。このまま保存しますか？`)) return;

  const record = {
    id: uuid(),
    type: 'inspection',
    date: f.date.value,
    time: nowTime(),
    inspector: f.inspector.value.trim(),
    vehicle: f.vehicle.value,
    weather: f.weather.value,
    defects: f.defects.value.trim(),
    items: ALL_ITEMS.map((i) => ({
      id: i.id,
      category: i.category,
      name: i.name,
      result: inspState[i.id].result,
      comment: (inspState[i.id].comment || '').trim(),
      photos: inspState[i.id].photos,
    })),
    ngCount: ngItems.length,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  await putRecord(record);
  setSetting('driver', record.inspector);
  setSetting('vehicle', record.vehicle);
  requestPersistentStorage();

  inspState = {};
  f.defects.value = '';
  renderChecklist();
  window.scrollTo({ top: 0 });
  await refreshAll();

  if (ngItems.length) {
    alert(`NGが${ngItems.length}件あります。\n運行前に運行管理者へ報告してください。\n\n${ngItems.map((i) => '・' + i.name).join('\n')}`);
  } else {
    toast('点検結果を保存しました（異常なし・運行可）');
  }
  sync();
});

// =====================================================
// 運転日報
// =====================================================
const STOP_KINDS = ['積込', '荷降ろし', '休憩', '待機', 'その他'];

function addStop(data = {}) {
  const div = document.createElement('div');
  div.className = 'stop';
  div.innerHTML = `
    <div class="stop-row">
      <input type="time" data-k="time" value="${esc(data.time || '')}" aria-label="時刻">
      <select data-k="kind" aria-label="区分">${STOP_KINDS.map((k) => `<option ${k === data.kind ? 'selected' : ''}>${k}</option>`).join('')}</select>
      <button type="button" class="stop-remove" aria-label="この行を削除">×</button>
    </div>
    <input type="text" data-k="place" placeholder="場所（例：〇〇物流センター）" value="${esc(data.place || '')}">
    <input type="text" data-k="detail" placeholder="内容（例：パレット12枚・待機20分）" value="${esc(data.detail || '')}">`;
  $('#stops').appendChild(div);
}

$('#add-stop').addEventListener('click', () => {
  addStop({ time: nowTime(), kind: $$('#stops .stop').length ? '荷降ろし' : '積込' });
});

$('#stops').addEventListener('click', (e) => {
  if (e.target.classList.contains('stop-remove')) e.target.closest('.stop').remove();
});

function updateDistance() {
  const f = $('#nippo-form');
  const a = parseFloat(f.outOdo.value), b = parseFloat(f.inOdo.value);
  const el = $('#distance');
  if (Number.isFinite(a) && Number.isFinite(b)) {
    const d = b - a;
    el.textContent = d >= 0 ? `${d.toLocaleString()} km` : 'メーターの値を確認してください';
    el.classList.toggle('warn', d < 0);
  } else {
    el.textContent = '— km';
    el.classList.remove('warn');
  }
}

// 日報の画面に「今日の運行前点検」の状況を表示
async function updateInspStatus() {
  const f = $('#nippo-form');
  const box = $('#insp-status');
  if (!f.vehicle.value) { box.innerHTML = ''; return; }
  const list = (await getAllRecords())
    .filter((r) => r.type === 'inspection' && r.date === f.date.value && r.vehicle === f.vehicle.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!list.length) {
    box.className = 'insp-status warn';
    box.innerHTML = '運行前点検：<strong>未実施</strong> <button type="button" class="link" id="go-inspect">点検する</button>';
  } else if (list[0].ngCount) {
    box.className = 'insp-status ng';
    box.innerHTML = `運行前点検：<strong>NG ${list[0].ngCount}件</strong>（${esc(list[0].time)}）運行管理者に確認してください`;
  } else {
    box.className = 'insp-status ok';
    box.innerHTML = `運行前点検：<strong>異常なし</strong>（${esc(list[0].time)} ${esc(list[0].inspector)}）`;
  }
}

$('#insp-status').addEventListener('click', (e) => {
  if (e.target.id === 'go-inspect') {
    const f = $('#insp-form');
    f.vehicle.value = $('#nippo-form').vehicle.value;
    f.date.value = $('#nippo-form').date.value;
    showTab('inspect');
  }
});

const nippoForm = $('#nippo-form');
nippoForm.outOdo.addEventListener('input', updateDistance);
nippoForm.inOdo.addEventListener('input', updateDistance);
nippoForm.vehicle.addEventListener('change', updateInspStatus);
nippoForm.date.addEventListener('change', updateInspStatus);

function resetNippoForm() {
  nippoForm.reset();
  nippoForm.date.value = today();
  nippoForm.driver.value = getSetting('driver') || getSetting('staff');
  fillVehicleSelects();
  fillRouteSelects(true);
  $('#stops').innerHTML = '';
  addStop({ kind: '積込' });
  updateDistance();
  updateInspStatus();
}

nippoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (!f.driver.value.trim() || !f.vehicle.value || !f.date.value || !f.route1.value) {
    toast('日付・乗務員・車両・ルート（1便目）を入力してください');
    return;
  }
  const num = (v) => (v === '' ? null : Number(v));
  const stops = $$('#stops .stop').map((s) => ({
    time: $('[data-k="time"]', s).value,
    kind: $('[data-k="kind"]', s).value,
    place: $('[data-k="place"]', s).value.trim(),
    detail: $('[data-k="detail"]', s).value.trim(),
  })).filter((s) => s.time || s.place || s.detail);
  const outOdo = num(f.outOdo.value), inOdo = num(f.inOdo.value);
  const record = {
    id: uuid(),
    type: 'nippo',
    date: f.date.value,
    driver: f.driver.value.trim(),
    vehicle: f.vehicle.value,
    routes: [f.route1.value, f.route2.value].filter(Boolean), // 便ごとのルート（1便目、2便目）
    outTime: f.outTime.value,
    inTime: f.inTime.value,
    outOdo,
    inOdo,
    distance: outOdo != null && inOdo != null ? inOdo - outOdo : null,
    alcOut: num(f.alcOut.value),
    alcIn: num(f.alcIn.value),
    stops,
    fuel: num(f.fuel.value),
    toll: num(f.toll.value),
    note: f.note.value.trim(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  await putRecord(record);
  setSetting('driver', record.driver);
  setSetting('vehicle', record.vehicle);
  setSetting('route1', record.routes[0]);
  requestPersistentStorage();
  resetNippoForm();
  window.scrollTo({ top: 0 });
  await refreshAll();
  toast(navigator.onLine ? '日報を保存しました。送信します…' : '日報を保存しました（オフライン）。ネットにつながると自動で送信します。');
  sync();
});

// =====================================================
// 履歴
// =====================================================
function syncBadge(r) {
  if (r.status === 'pending') return '<span class="badge pending">未送信</span>';
  return r.demo ? '<span class="badge demo">送信済み（デモ）</span>' : '<span class="badge sent">送信済み</span>';
}

async function renderHistory() {
  const records = await getAllRecords();
  records.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  $('#history-list').innerHTML = records.map((r) => {
    if (r.type === 'inspection') {
      const result = r.ngCount ? `<span class="badge ng">NG ${r.ngCount}件</span>` : '<span class="badge ok">異常なし</span>';
      return `<li data-id="${esc(r.id)}">
        <div class="head"><span class="kind insp">点検</span><span class="date">${esc(r.date)} ${esc(r.time)}</span>${syncBadge(r)}</div>
        <div class="line">${esc(r.vehicle)}　${esc(r.inspector)}　${result}</div>
      </li>`;
    }
    const who = r.driver || r.staff || '';
    const summary = r.type === 'nippo' && r.stops
      ? [r.vehicle, r.routes && r.routes.length ? r.routes.join(' → ') : '', r.distance != null ? `${r.distance}km` : '', r.stops.length ? `運行記録${r.stops.length}件` : ''].filter(Boolean).join('　')
      : (r.work || '');
    return `<li data-id="${esc(r.id)}">
      <div class="head"><span class="kind nippo">日報</span><span class="date">${esc(r.date)}</span>${syncBadge(r)}</div>
      <div class="line">${esc(who)}　${esc(summary)}</div>
    </li>`;
  }).join('');
  $('#empty').hidden = records.length > 0;
}

let detailId = null;

$('#history-list').addEventListener('click', async (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const r = await getRecord(li.dataset.id);
  if (!r) return;
  detailId = r.id;
  const state = r.status === 'pending' ? '未送信' : `送信済み${r.demo ? '（デモ）' : ''}　${formatDateTime(r.sentAt)}`;
  const row = (k, v) => (v === null || v === undefined || v === '' ? '' : `<dt>${k}</dt><dd>${esc(v)}</dd>`);

  let html = '';
  if (r.type === 'inspection') {
    html = `<h3>運行前点検</h3><dl>
      ${row('日時', `${r.date} ${r.time}`)}${row('車両', r.vehicle)}${row('天気', r.weather)}${row('点検者', r.inspector)}
      ${row('結果', r.ngCount ? `NG ${r.ngCount}件` : '異常なし')}${row('不良箇所及びその処理', r.defects)}${row('状態', state)}</dl>
      <ul class="detail-items">${r.items.map((i) => `
        <li class="${i.result}">
          <span class="badge ${i.result}">${i.result === 'ok' ? 'OK' : 'NG'}</span> ${esc(i.name)}
          ${i.comment ? `<div class="detail-comment">${esc(i.comment)}</div>` : ''}
          ${i.photos && i.photos.length ? `<div class="thumbs">${i.photos.map((b) => `<div class="thumb"><img src="${photoUrl(b)}" alt="${esc(i.name)}の写真" data-act="zoom"></div>`).join('')}</div>` : ''}
        </li>`).join('')}</ul>`;
  } else if (r.stops) {
    const stops = r.stops.map((s) => `<li><strong>${esc(s.time || '--:--')} ${esc(s.kind)}</strong> ${esc(s.place)}${s.detail ? `<br><span class="hint">${esc(s.detail)}</span>` : ''}</li>`).join('');
    html = `<h3>運転日報</h3><dl>
      ${row('日付', r.date)}${row('乗務員', r.driver)}${row('車両', r.vehicle)}
      ${row('ルート', (r.routes || []).map((x, i) => `${i + 1}便目 ${x}`).join('　'))}
      ${row('出庫', [r.outTime, r.outOdo != null ? `${r.outOdo}km` : ''].filter(Boolean).join('　'))}
      ${row('帰庫', [r.inTime, r.inOdo != null ? `${r.inOdo}km` : ''].filter(Boolean).join('　'))}
      ${row('走行距離', r.distance != null ? `${r.distance}km` : '')}
      ${row('アルコール（出庫前／帰庫後）', r.alcOut != null || r.alcIn != null ? `${r.alcOut ?? '-'} ／ ${r.alcIn ?? '-'} mg/L` : '')}
      ${row('給油', r.fuel != null ? `${r.fuel}L` : '')}${row('高速代', r.toll != null ? `${r.toll.toLocaleString()}円` : '')}
      </dl>
      ${stops ? `<h4>運行記録</h4><ul class="detail-stops">${stops}</ul>` : ''}
      <dl>${row('特記事項', r.note)}${row('状態', state)}</dl>`;
  } else {
    html = `<h3>日報（旧形式）</h3><dl>${row('日付', r.date)}${row('担当者', r.staff)}${row('現場名', r.site)}${row('作業内容', r.work)}${row('備考', r.note)}${row('状態', state)}</dl>`;
  }
  $('#detail-body').innerHTML = html;
  $('#detail').showModal();
});

$('#detail-body').addEventListener('click', (e) => {
  if (e.target.dataset.act === 'zoom') openPhoto(e.target.src);
});

$('#detail-close').addEventListener('click', () => $('#detail').close());

$('#detail-delete').addEventListener('click', async () => {
  if (!detailId) return;
  const r = await getRecord(detailId);
  const msg = r && r.status === 'pending'
    ? 'この記録はまだ送信されていません。削除すると元に戻せません。削除しますか？'
    : 'このスマホから削除します（送信済みのデータはサーバーに残ります）。削除しますか？';
  if (!confirm(msg)) return;
  await deleteRecord(detailId);
  $('#detail').close();
  await refreshAll();
  toast('削除しました');
});

$('#sync-now').addEventListener('click', () => sync({ manual: true }));

// ---------- 写真の拡大・見本ダイアログ ----------
function openPhoto(src) {
  $('#photo-view-img').src = src;
  $('#photo-view').showModal();
}
$('#photo-view-close').addEventListener('click', () => $('#photo-view').close());
$('#sample-close').addEventListener('click', () => $('#sample').close());

// =====================================================
// 送信（同期）
// =====================================================
let syncing = false;

async function sync({ manual = false } = {}) {
  if (syncing) return;
  if (!navigator.onLine) {
    if (manual) toast('オフラインのため送信できません。ネットにつながると自動で送信します。');
    return;
  }
  const pending = (await getAllRecords()).filter((r) => r.status === 'pending');
  if (!pending.length) {
    if (manual) toast('未送信の記録はありません');
    return;
  }

  syncing = true;
  const endpoint = getSetting('endpoint');
  let sent = 0;
  try {
    for (const r of pending) {
      const ok = endpoint ? await sendToServer(endpoint, r) : await demoSend();
      if (!ok) break; // 失敗したら残りは次回に回す
      await putRecord({ ...r, status: 'sent', demo: !endpoint, sentAt: new Date().toISOString() });
      sent++;
    }
  } finally {
    syncing = false;
  }
  await refreshAll();
  if (sent) toast(`${sent}件を送信しました${endpoint ? '' : '（デモ）'}`);
  else if (manual) toast('送信できませんでした。電波の良いところで再度お試しください。');
}

async function sendToServer(endpoint, record) {
  try {
    const { status, demo, ...payload } = record;
    if (payload.type === 'inspection') {
      // 写真は文字データ（Base64）に変換して一緒に送る
      payload.items = await Promise.all(payload.items.map(async (i) => ({
        ...i, photos: await Promise.all((i.photos || []).map(blobToDataURL)),
      })));
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function demoSend() {
  return new Promise((resolve) => setTimeout(() => resolve(true), 400));
}

// =====================================================
// 設定
// =====================================================
$('#save-settings').addEventListener('click', () => {
  const url = $('#endpoint').value.trim();
  if (url && !/^https:\/\//.test(url)) {
    toast('送信先URLは https:// で始まるものを入力してください');
    return;
  }
  setSetting('endpoint', url);
  setSetting('vehicles', $('#vehicles').value.split('\n').map((s) => s.trim()).filter(Boolean).join('\n'));
  $('#vehicles').value = getVehicles().join('\n');
  fillVehicleSelects();
  setSetting('routes', $('#routes').value.split('\n').map((s) => s.trim()).filter(Boolean).join('\n'));
  $('#routes').value = getRoutes().join('\n');
  fillRouteSelects();
  toast('設定を保存しました');
  sync();
});

$('#lock-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#pin-input');
  if (await checkPin(input.value)) {
    input.value = '';
    setAdmin(true);
    toast('管理者モードにしました');
  } else {
    input.value = '';
    toast('PINが違います');
  }
});

$('#lock-now').addEventListener('click', () => {
  setAdmin(false);
  toast('設定をロックしました');
});

$('#change-pin').addEventListener('click', async () => {
  const pin = $('#new-pin').value.trim();
  if (!/^\d{4,8}$/.test(pin)) { toast('PINは4〜8桁の数字で入力してください'); return; }
  setSetting('pinHash', await hashPin(pin));
  $('#new-pin').value = '';
  toast('管理者PINを変更しました');
});

function downloadCSV(name, head, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${name}_${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#export-nippo').addEventListener('click', async () => {
  const list = (await getAllRecords()).filter((r) => r.type === 'nippo' && r.stops).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) { toast('書き出す日報がありません'); return; }
  downloadCSV('運転日報',
    ['日付', '乗務員', '車両', 'ルート1便目', 'ルート2便目', '出庫時刻', '帰庫時刻', '出庫メーター', '帰庫メーター', '走行距離', 'アルコール出庫前', 'アルコール帰庫後', '運行記録', '給油量', '高速代', '特記事項', '状態'],
    list.map((r) => [r.date, r.driver, r.vehicle, (r.routes || [])[0], (r.routes || [])[1], r.outTime, r.inTime, r.outOdo, r.inOdo, r.distance, r.alcOut, r.alcIn,
      r.stops.map((s) => `${s.time} ${s.kind} ${s.place} ${s.detail}`.trim()).join(' / '), r.fuel, r.toll, r.note,
      r.status === 'pending' ? '未送信' : '送信済み']));
});

$('#export-insp').addEventListener('click', async () => {
  const list = (await getAllRecords()).filter((r) => r.type === 'inspection').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (!list.length) { toast('書き出す点検記録がありません'); return; }
  downloadCSV('運行前点検',
    ['日付', '時刻', '車両', '天気', '点検者', '結果', 'NG項目', '不良箇所及びその処理', ...ALL_ITEMS.map((i) => i.name), '状態'],
    list.map((r) => [r.date, r.time, r.vehicle, r.weather, r.inspector, r.ngCount ? `NG ${r.ngCount}件` : '異常なし',
      r.items.filter((i) => i.result === 'ng').map((i) => `${i.name}${i.comment ? `（${i.comment}）` : ''}`).join(' / '),
      r.defects,
      ...ALL_ITEMS.map((a) => { const i = r.items.find((x) => x.id === a.id); return i ? i.result.toUpperCase() : ''; }),
      r.status === 'pending' ? '未送信' : '送信済み']));
});

async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch { /* 対応していない環境では無視 */ }
  showStorageInfo();
}

async function showStorageInfo() {
  try {
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    $('#storage-info').textContent = persisted
      ? 'データ保護：有効（スマホの容量不足でも自動で消されにくい状態です）'
      : 'データ保護：未設定（ホーム画面に追加して使うと有効になりやすくなります）';
  } catch { /* 無視 */ }
}

// ---------- タブ切り替え ----------
function showTab(name) {
  $$('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
  if (name === 'history') renderHistory();
  if (name === 'nippo') {
    // 点検で入力した名前・車両を日報にも引き継ぐ
    if (!nippoForm.driver.value) nippoForm.driver.value = getSetting('driver');
    if (!nippoForm.vehicle.value) fillVehicleSelects();
    updateInspStatus();
  }
  if (name === 'inspect') {
    if (!inspForm.inspector.value) inspForm.inspector.value = getSetting('driver');
    if (!inspForm.vehicle.value) fillVehicleSelects();
  }
  window.scrollTo({ top: 0 });
}
$$('.bottom-nav button').forEach((btn) => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

// ---------- 起動 ----------
window.addEventListener('online', () => { updateNetStatus(); sync(); });
window.addEventListener('offline', updateNetStatus);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
setInterval(() => sync(), 60 * 1000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* ローカル環境などでは失敗しても続行 */ });
}

$('#version').textContent = APP_VERSION;
$('#endpoint').value = getSetting('endpoint');
$('#vehicles').value = getVehicles().join('\n');
$('#routes').value = getRoutes().join('\n');
setAdmin(false);
fillVehicleSelects();
fillRouteSelects();
const inspForm = $('#insp-form');
inspForm.date.value = today();
inspForm.inspector.value = getSetting('driver') || getSetting('staff');
renderChecklist();
resetNippoForm();
updateNetStatus();
showStorageInfo();
loadSamples().catch(() => {}).finally(() => refreshAll().then(() => sync()));

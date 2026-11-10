'use strict';

const APP_VERSION = 'v1';

// ---------- スマホ内の保存（IndexedDB） ----------
const DB_NAME = 'nippo';
const STORE = 'reports';
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

const putReport = (r) => tx('readwrite', (s) => s.put(r));
const deleteReport = (id) => tx('readwrite', (s) => s.delete(id));
const getAllReports = () => tx('readonly', (s) => s.getAll());

// ---------- 設定（ブラウザ保存） ----------
function getSetting(key) {
  try { return localStorage.getItem('nippo.' + key) || ''; } catch { return ''; }
}
function setSetting(key, value) {
  try { localStorage.setItem('nippo.' + key, value); } catch { /* 保存できない環境では無視 */ }
}

// ---------- 便利関数 ----------
const $ = (sel) => document.querySelector(sel);

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- 画面の更新 ----------
async function refresh() {
  const reports = await getAllReports();
  reports.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const pendingEl = $('#pending');
  pendingEl.textContent = `未送信 ${pendingCount}件`;
  pendingEl.hidden = pendingCount === 0;

  const list = $('#report-list');
  list.innerHTML = reports.map((r) => {
    const badge = r.status === 'pending'
      ? '<span class="badge pending">未送信</span>'
      : r.demo
        ? '<span class="badge demo">送信済み（デモ）</span>'
        : '<span class="badge sent">送信済み</span>';
    return `<li data-id="${esc(r.id)}">
      <div class="head"><span class="date">${esc(r.date)}　${esc(r.staff)}</span>${badge}</div>
      ${r.site ? `<div class="site">${esc(r.site)}</div>` : ''}
      <div class="work">${esc(r.work)}</div>
    </li>`;
  }).join('');
  $('#empty').hidden = reports.length > 0;
}

function updateNetStatus() {
  const el = $('#net');
  if (navigator.onLine) {
    el.textContent = 'オンライン';
    el.className = 'pill online';
  } else {
    el.textContent = 'オフライン';
    el.className = 'pill offline';
  }
}

// ---------- 送信（同期） ----------
let syncing = false;

async function sync({ manual = false } = {}) {
  if (syncing) return;
  if (!navigator.onLine) {
    if (manual) toast('オフラインのため送信できません。ネットにつながると自動で送信します。');
    return;
  }
  const pending = (await getAllReports()).filter((r) => r.status === 'pending');
  if (pending.length === 0) {
    if (manual) toast('未送信の日報はありません');
    return;
  }

  syncing = true;
  const endpoint = getSetting('endpoint');
  let sent = 0;
  try {
    for (const r of pending) {
      const ok = endpoint ? await sendToServer(endpoint, r) : await demoSend();
      if (!ok) break; // 失敗したら残りは次回に回す
      await putReport({ ...r, status: 'sent', demo: !endpoint, sentAt: new Date().toISOString() });
      sent++;
    }
  } finally {
    syncing = false;
  }
  await refresh();
  if (sent > 0) toast(`${sent}件の日報を送信しました${endpoint ? '' : '（デモ）'}`);
  else if (manual) toast('送信できませんでした。電波の良いところで再度お試しください。');
}

async function sendToServer(endpoint, report) {
  try {
    const { status, demo, ...payload } = report;
    const res = await fetch(endpoint, {
      method: 'POST',
      // text/plain にすると Google Apps Script などでも受け取りやすい
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

// ---------- 入力フォーム ----------
function resetForm() {
  const form = $('#report-form');
  form.reset();
  form.date.value = today();
  form.staff.value = getSetting('staff');
}

$('#report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const report = {
    id: uuid(),
    date: f.date.value,
    staff: f.staff.value.trim(),
    site: f.site.value.trim(),
    start: f.start.value,
    end: f.end.value,
    work: f.work.value.trim(),
    note: f.note.value.trim(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  await putReport(report);
  setSetting('staff', report.staff);
  requestPersistentStorage();
  resetForm();
  await refresh();
  toast(navigator.onLine ? '保存しました。送信します…' : '保存しました（オフライン）。ネットにつながると自動で送信します。');
  sync();
});

// ---------- 一覧・詳細 ----------
let detailId = null;

$('#report-list').addEventListener('click', async (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const r = (await getAllReports()).find((x) => x.id === li.dataset.id);
  if (!r) return;
  detailId = r.id;
  const time = r.start || r.end ? `${r.start || '—'} 〜 ${r.end || '—'}` : '';
  const state = r.status === 'pending' ? '未送信' : `送信済み${r.demo ? '（デモ）' : ''}　${formatDateTime(r.sentAt)}`;
  $('#detail-body').innerHTML = `<dl>
    <dt>日付</dt><dd>${esc(r.date)}</dd>
    <dt>担当者</dt><dd>${esc(r.staff)}</dd>
    ${r.site ? `<dt>現場名</dt><dd>${esc(r.site)}</dd>` : ''}
    ${time ? `<dt>時間</dt><dd>${esc(time)}</dd>` : ''}
    <dt>作業内容</dt><dd>${esc(r.work)}</dd>
    ${r.note ? `<dt>備考・連絡事項</dt><dd>${esc(r.note)}</dd>` : ''}
    <dt>状態</dt><dd>${esc(state)}</dd>
  </dl>`;
  $('#detail').showModal();
});

$('#detail-close').addEventListener('click', () => $('#detail').close());

$('#detail-delete').addEventListener('click', async () => {
  if (!detailId) return;
  const r = (await getAllReports()).find((x) => x.id === detailId);
  const msg = r && r.status === 'pending'
    ? 'この日報はまだ送信されていません。削除すると元に戻せません。削除しますか？'
    : 'このスマホから削除します（送信済みのデータはサーバーに残ります）。削除しますか？';
  if (!confirm(msg)) return;
  await deleteReport(detailId);
  $('#detail').close();
  await refresh();
  toast('削除しました');
});

$('#sync-now').addEventListener('click', () => sync({ manual: true }));

// ---------- 設定 ----------
$('#save-settings').addEventListener('click', () => {
  const url = $('#endpoint').value.trim();
  if (url && !/^https:\/\//.test(url)) {
    toast('送信先URLは https:// で始まるものを入力してください');
    return;
  }
  setSetting('endpoint', url);
  toast(url ? '送信先を保存しました' : 'デモモードにしました');
  sync();
});

$('#export-csv').addEventListener('click', async () => {
  const reports = await getAllReports();
  if (reports.length === 0) { toast('書き出す日報がありません'); return; }
  reports.sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  const cols = ['date', 'staff', 'site', 'start', 'end', 'work', 'note', 'status', 'createdAt', 'id'];
  const head = ['日付', '担当者', '現場名', '開始', '終了', '作業内容', '備考', '状態', '作成日時', 'ID'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = reports.map((r) => cols.map((c) => cell(c === 'status' ? (r.status === 'pending' ? '未送信' : '送信済み') : r[c])).join(','));
  const csv = '﻿' + [head.map(cell).join(','), ...rows].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `日報_${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
document.querySelectorAll('.tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + btn.dataset.tab));
    if (btn.dataset.tab === 'list') refresh();
  });
});

// ---------- 起動 ----------
window.addEventListener('online', () => { updateNetStatus(); sync(); });
window.addEventListener('offline', updateNetStatus);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
setInterval(() => sync(), 60 * 1000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* 開発中のローカル環境などでは失敗しても続行 */ });
}

$('#version').textContent = APP_VERSION;
$('#endpoint').value = getSetting('endpoint');
resetForm();
updateNetStatus();
showStorageInfo();
refresh().then(() => sync());

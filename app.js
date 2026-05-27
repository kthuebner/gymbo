/* ═══════════════════════════════════════════════════════════
   app.js — Workout Tracker
   ═══════════════════════════════════════════════════════════ */

/* ── Storage keys ─────────────────────────────────────────── */
const STORAGE_LOGS   = 'workout_logs';   // { "2026-05-27": "push-power", ... }
const STORAGE_LAST   = 'workout_last';   // { "push-power": "2026-05-27", ... }

/* ── State ────────────────────────────────────────────────── */
let workouts      = [];
let openWorkoutId = null;
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();

/* Timer state */
let timerTotal    = 60;
let timerRemain   = 60;
let timerRunning  = false;
let timerInterval = null;
let beepCtx       = null;

/* ── Helpers ──────────────────────────────────────────────── */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(key) {
  if (!key) return 'Never';
  const [y, m, d] = key.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(d)}`;
}

function getLogs()     { return JSON.parse(localStorage.getItem(STORAGE_LOGS) || '{}'); }
function getLastDates() { return JSON.parse(localStorage.getItem(STORAGE_LAST) || '{}'); }

function saveLogs(logs)         { localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs)); }
function saveLastDates(lastMap) { localStorage.setItem(STORAGE_LAST, JSON.stringify(lastMap)); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

/* ── Load workouts.json ───────────────────────────────────── */
async function loadWorkouts() {
  try {
    const res = await fetch('workouts.json');
    workouts = await res.json();
  } catch(e) {
    console.error('Could not load workouts.json', e);
    workouts = [];
  }
  renderCards();
}

/* ── Workout cards ────────────────────────────────────────── */
function renderCards() {
  const grid = document.getElementById('workoutGrid');
  const lastMap = getLastDates();
  grid.innerHTML = '';

  workouts.forEach(w => {
    const card = document.createElement('div');
    card.className = `wo-card ${w.type}`;
    card.dataset.id = w.id;
    if (openWorkoutId && openWorkoutId !== w.id) card.classList.add('faded');
    if (openWorkoutId && openWorkoutId === w.id) card.classList.add('active');

    const lastDate = lastMap[w.id] ? `Last: ${formatDate(lastMap[w.id])}` : 'Never done';
    card.innerHTML = `
      <div class="wo-type">${w.typeLabel}</div>
      <div class="wo-name">${w.name}</div>
      <div class="wo-last">${lastDate}</div>
    `;
    card.addEventListener('click', () => toggleWorkout(w.id));
    grid.appendChild(card);
  });
}

function toggleWorkout(id) {
  if (openWorkoutId === id) {
    closeWorkout();
  } else {
    openWorkout(id);
  }
}

function openWorkout(id) {
  openWorkoutId = id;
  const w = workouts.find(x => x.id === id);
  if (!w) return;

  renderCards();

  const panel = document.getElementById('workoutOpen');
  const logs = getLogs();
  const alreadyLogged = logs[todayKey()] === id;

  let exCount = w.blocks.reduce((sum, b) => sum + b.exercises.length, 0);

  let blocksHtml = w.blocks.map(b => `
    <div class="block">
      <div class="block-header">
        <span class="block-title">${b.title}</span>
        <span class="block-rest">${b.rest}</span>
      </div>
      ${b.exercises.map(ex => `
        <div class="ex-row">
          <div class="ex-info">
            <div class="ex-name">${ex.name}</div>
            <div class="ex-tip">${ex.tip}</div>
          </div>
          <div class="ex-right">
            <div class="ex-sets">${ex.sets}</div>
            ${ex.note ? `<div class="ex-note">${ex.note}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  panel.innerHTML = `
    <div class="open-header">
      <div class="open-meta">
        <div class="open-name">${w.name}</div>
        <div class="open-sub">${w.typeLabel} · ${exCount} exercises</div>
      </div>
      <button class="open-close" onclick="closeWorkout()" aria-label="Close workout">&#x2715;</button>
    </div>
    <div class="open-body">
      ${blocksHtml}
      <div class="progression-box">
        <div class="prog-label">Progression</div>
        <div class="prog-text">${w.progression}</div>
      </div>
      <button class="log-btn${alreadyLogged ? ' logged' : ''}" id="logBtn" onclick="logWorkout('${w.id}')">
        ${alreadyLogged
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Logged today`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Log workout — mark today done`
        }
      </button>
    </div>
  `;

  panel.classList.add('visible');

  // Scroll open panel into view smoothly
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function closeWorkout() {
  openWorkoutId = null;
  const panel = document.getElementById('workoutOpen');
  panel.classList.remove('visible');
  renderCards();
}

function logWorkout(id) {
  const key = todayKey();
  const logs = getLogs();
  const lastMap = getLastDates();

  logs[key] = id;
  lastMap[id] = key;

  saveLogs(logs);
  saveLastDates(lastMap);

  // Update button
  const btn = document.getElementById('logBtn');
  if (btn) {
    btn.classList.add('logged');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Logged today`;
  }

  // Refresh calendar & cards
  renderCalendar();
  renderCards();
  showToast('Workout logged — nice work.');
}

/* ── Calendar ─────────────────────────────────────────────── */
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function renderCalendar() {
  const logs = getLogs();
  const today = new Date();
  const todayStr = todayKey();

  document.getElementById('calMonth').textContent = `${MONTHS[calMonth]} ${calYear}`;

  const grid = document.getElementById('calDays');
  grid.innerHTML = '';

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el = document.createElement('div');
    let cls = 'cal-day';
    if (logs[key]) cls += ' worked';
    if (key === todayStr) cls += ' today';
    el.className = cls;
    el.textContent = d;
    el.title = logs[key] ? `Logged: ${workouts.find(w=>w.id===logs[key])?.name || 'workout'}` : '';
    el.addEventListener('click', () => toggleDay(key));
    grid.appendChild(el);
  }

  updateStreak();
}

function toggleDay(key) {
  const logs = getLogs();
  if (logs[key]) {
    delete logs[key];
  } else {
    logs[key] = 'manual';
  }
  saveLogs(logs);
  renderCalendar();
}

function updateStreak() {
  const logs = getLogs();
  const today = new Date();
  let streak = 0;
  let d = new Date(today);

  // If today isn't logged yet, start checking from yesterday
  const todayStr = todayKey();
  if (!logs[todayStr]) d.setDate(d.getDate() - 1);

  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (logs[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Count sessions in current view month
  const sessionsThisMonth = Object.keys(logs).filter(k => {
    const [y, m] = k.split('-');
    return parseInt(y) === calYear && parseInt(m) === calMonth + 1;
  }).length;

  document.getElementById('streakCount').textContent = streak;
  document.getElementById('streakSessions').textContent = `${sessionsThisMonth} session${sessionsThisMonth !== 1 ? 's' : ''}`;
  document.getElementById('streakMonthLabel').textContent = `${MONTHS[calMonth].toLowerCase().slice(0,3)}`;
}

function calPrev() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function calNext() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

/* ── Timer ────────────────────────────────────────────────── */
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function renderTimerDisplay() {
  document.getElementById('timerDisplay').textContent = formatTime(timerRemain);
}

function setPreset(secs, btn) {
  stopTimer();
  timerTotal   = secs;
  timerRemain  = secs;
  renderTimerDisplay();
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('customTime').value = '';
}

function setCustomTime() {
  const val = parseInt(document.getElementById('customTime').value);
  if (isNaN(val) || val <= 0) return;
  stopTimer();
  timerTotal  = val;
  timerRemain = val;
  renderTimerDisplay();
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

function startTimer() {
  if (timerRunning) return;
  if (timerRemain <= 0) timerRemain = timerTotal;
  timerRunning = true;
  updateTimerBtn();
  timerInterval = setInterval(() => {
    timerRemain--;
    renderTimerDisplay();
    if (timerRemain <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerFinished();
    }
  }, 1000);
}

function pauseTimer() {
  if (!timerRunning) return;
  clearInterval(timerInterval);
  timerRunning = false;
  updateTimerBtn();
}

function stopTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
}

function resetTimer() {
  stopTimer();
  timerRemain = timerTotal;
  renderTimerDisplay();
  updateTimerBtn();
}

function updateTimerBtn() {
  const btn = document.getElementById('startPauseBtn');
  if (timerRunning) {
    btn.textContent = 'Pause';
    btn.classList.add('pause');
    btn.classList.remove('start');
  } else {
    btn.textContent = 'Start';
    btn.classList.remove('pause');
    btn.classList.add('start');
  }
}

function toggleStartPause() {
  if (timerRunning) { pauseTimer(); } else { startTimer(); }
}

function timerFinished() {
  updateTimerBtn();
  // Flash display
  const disp = document.getElementById('timerDisplay');
  disp.classList.add('flash');
  setTimeout(() => disp.classList.remove('flash'), 700);
  // Beep via Web Audio API
  playBeep();
  // Auto-reset after short delay
  setTimeout(() => {
    timerRemain = timerTotal;
    renderTimerDisplay();
  }, 1500);
}

function playBeep() {
  try {
    if (!beepCtx) beepCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = beepCtx;
    // Three short beeps
    [0, 0.22, 0.44].forEach(offset => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch(e) {
    // Audio not available — silent fail
  }
}

/* ── Update date in header ────────────────────────────────── */
function updateHeaderDate() {
  const d = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('appDate').textContent =
    `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

/* ── Init ─────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  renderCalendar();
  loadWorkouts();
  renderTimerDisplay();
  updateTimerBtn();
});

/* Expose functions used in HTML onclick attributes */
window.calPrev           = calPrev;
window.calNext           = calNext;
window.setPreset         = setPreset;
window.setCustomTime     = setCustomTime;
window.toggleStartPause  = toggleStartPause;
window.resetTimer        = resetTimer;
window.logWorkout        = logWorkout;
window.closeWorkout      = closeWorkout;

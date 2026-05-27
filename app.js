/* ═══════════════════════════════════════════════════════════
   app.js — Workout Tracker
   ═══════════════════════════════════════════════════════════ */

/* ── Storage keys ─────────────────────────────────────────── */
const STORAGE_LOGS = 'workout_logs';  // { "2026-05-27": "upper", ... }
const STORAGE_LAST = 'workout_last';  // { "push-power": "2026-05-27", ... }

/* ── Activity type → CSS class & color ───────────────────── */
const ACTIVITY_MAP = {
  upper:  { cls: 'act-upper',  label: 'Upper body' },
  lower:  { cls: 'act-lower',  label: 'Lower body' },
  climb:  { cls: 'act-climb',  label: 'Climbing'   },
  cardio: { cls: 'act-cardio', label: 'Cardio'     },
  yoga:   { cls: 'act-yoga',   label: 'Yoga'       },
  walk:   { cls: 'act-walk',   label: 'Walk / Other'},
};

/* ── State ────────────────────────────────────────────────── */
let workouts      = [];
let openWorkoutId = null;
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();

/* Timer */
let timerTotal   = 60;
let timerRemain  = 60;
let timerRunning = false;
let timerInterval = null;
let beepCtx      = null;

/* ── Helpers ──────────────────────────────────────────────── */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2,'0'); }
function dateKey(y,m,d) { return `${y}-${pad(m+1)}-${pad(d)}`; }

function formatDate(key) {
  if (!key) return 'Never';
  const [,m,d] = key.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(d)}`;
}

function getLogs()      { return JSON.parse(localStorage.getItem(STORAGE_LOGS) || '{}'); }
function getLastDates() { return JSON.parse(localStorage.getItem(STORAGE_LAST) || '{}'); }
function saveLogs(l)    { localStorage.setItem(STORAGE_LOGS, JSON.stringify(l)); }
function saveLastDates(l){ localStorage.setItem(STORAGE_LAST, JSON.stringify(l)); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

/* ── Load workouts ────────────────────────────────────────── */
async function loadWorkouts() {
  try {
    const res = await fetch('workouts.json');
    workouts = await res.json();
  } catch(e) {
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
    if (openWorkoutId && openWorkoutId !== w.id) card.classList.add('faded');
    if (openWorkoutId && openWorkoutId === w.id)  card.classList.add('active');
    const lastDate = lastMap[w.id] ? `Last: ${formatDate(lastMap[w.id])}` : 'Never done';
    card.innerHTML = `
      <div class="wo-type">${w.typeLabel}</div>
      <div class="wo-name">${w.name}</div>
      <div class="wo-last">${lastDate}</div>`;
    card.addEventListener('click', () => toggleWorkout(w.id));
    grid.appendChild(card);
  });
}

function toggleWorkout(id) {
  openWorkoutId === id ? closeWorkout() : openWorkout(id);
}

function openWorkout(id) {
  openWorkoutId = id;
  const w = workouts.find(x => x.id === id);
  if (!w) return;
  renderCards();

  const logs = getLogs();
  const alreadyLogged = logs[todayKey()] === w.type;
  const exCount = w.blocks.reduce((s,b) => s + b.exercises.length, 0);

  const blocksHtml = w.blocks.map((b, bi) => `
    <div class="block">
      <div class="block-header">
        <input type="checkbox" class="block-check" id="chk-${bi}" aria-label="Mark block ${bi+1} complete">
        <div class="block-meta">
          <div class="block-title">${b.title}</div>
          <div class="block-rest">${b.rest}</div>
        </div>
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
        </div>`).join('')}
    </div>`).join('');

  const checkSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  const panel = document.getElementById('workoutOpen');
  panel.innerHTML = `
    <div class="open-header">
      <div>
        <div class="open-name">${w.name}</div>
        <div class="open-sub">${w.typeLabel} · ${exCount} exercises</div>
      </div>
      <button class="open-close" onclick="closeWorkout()" aria-label="Close">&#x2715;</button>
    </div>
    <div class="open-body">
      ${blocksHtml}
      <div class="progression-box">
        <div class="prog-label">Progression</div>
        <div class="prog-text">${w.progression}</div>
      </div>
      <button class="log-btn${alreadyLogged ? ' logged' : ''}" id="logBtn" onclick="logWorkout('${w.id}','${w.type}')">
        ${checkSvg} ${alreadyLogged ? 'Logged today' : 'Log workout — mark today done'}
      </button>
    </div>`;

  panel.classList.add('visible');
  setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
}

function closeWorkout() {
  openWorkoutId = null;
  document.getElementById('workoutOpen').classList.remove('visible');
  renderCards();
}

function logWorkout(id, type) {
  const key = todayKey();
  const logs = getLogs();
  const lastMap = getLastDates();
  logs[key] = type;
  lastMap[id] = key;
  saveLogs(logs);
  saveLastDates(lastMap);

  const btn = document.getElementById('logBtn');
  if (btn) {
    btn.classList.add('logged');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Logged today`;
  }
  renderCalendar();
  renderCards();
  refreshQuickBtns();
  showToast('Workout logged — nice work.');
}

/* ── Quick log ────────────────────────────────────────────── */
function quickLog(type) {
  const key = todayKey();
  const logs = getLogs();
  // Toggle off if same type already logged
  if (logs[key] === type) {
    delete logs[key];
    saveLogs(logs);
  } else {
    logs[key] = type;
    saveLogs(logs);
    showToast(`${ACTIVITY_MAP[type].label} logged.`);
  }
  renderCalendar();
  refreshQuickBtns();
}

function refreshQuickBtns() {
  const logs = getLogs();
  const todayType = logs[todayKey()];
  ['climb','cardio','yoga','walk'].forEach(t => {
    const btn = document.getElementById(`qbtn-${t}`);
    if (!btn) return;
    btn.classList.toggle('active-today', todayType === t);
  });
}

/* ── Calendar ─────────────────────────────────────────────── */
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function renderCalendar() {
  const logs    = getLogs();
  const todayStr = todayKey();

  document.getElementById('calMonth').textContent = `${MONTHS[calMonth]} ${calYear}`;

  const grid = document.getElementById('calDays');
  grid.innerHTML = '';

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key  = dateKey(calYear, calMonth, d);
    const type = logs[key];
    const el   = document.createElement('div');
    let cls = 'cal-day';
    if (type && ACTIVITY_MAP[type]) cls += ` ${ACTIVITY_MAP[type].cls}`;
    if (key === todayStr) cls += ' today';
    el.className = cls;
    el.textContent = d;
    if (type) el.title = ACTIVITY_MAP[type]?.label || type;
    el.addEventListener('click', () => toggleDay(key));
    grid.appendChild(el);
  }

  updateStreak();
  refreshQuickBtns();
}

function toggleDay(key) {
  const logs = getLogs();
  if (logs[key]) { delete logs[key]; } else { logs[key] = 'walk'; }
  saveLogs(logs);
  renderCalendar();
}

function updateStreak() {
  const logs = getLogs();
  const todayStr = todayKey();
  let streak = 0;
  const d = new Date();
  if (!logs[todayStr]) d.setDate(d.getDate() - 1);

  while (true) {
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (logs[key]) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }

  const sessionsThisMonth = Object.keys(logs).filter(k => {
    const [y,m] = k.split('-');
    return parseInt(y) === calYear && parseInt(m) === calMonth+1;
  }).length;

  document.getElementById('streakCount').textContent = streak;
  document.getElementById('streakSessions').textContent = `${sessionsThisMonth} session${sessionsThisMonth !== 1 ? 's' : ''}`;
  document.getElementById('streakMonthLabel').textContent = MONTHS[calMonth].toLowerCase().slice(0,3);
}

function calPrev() { calMonth--; if (calMonth < 0)  { calMonth=11; calYear--; } renderCalendar(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth=0;  calYear++; } renderCalendar(); }

/* ── Timer ────────────────────────────────────────────────── */
function formatTime(s) { return `${pad(Math.floor(s/60))}:${pad(s%60)}`; }
function renderTimerDisplay() { document.getElementById('timerDisplay').textContent = formatTime(timerRemain); }

function setPreset(secs, btn) {
  stopTimer(); timerTotal = secs; timerRemain = secs; renderTimerDisplay();
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('customTime').value = '';
}

function setCustomTime() {
  const val = parseInt(document.getElementById('customTime').value);
  if (isNaN(val) || val <= 0) return;
  stopTimer(); timerTotal = val; timerRemain = val; renderTimerDisplay();
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

function startTimer() {
  if (timerRunning) return;
  if (timerRemain <= 0) timerRemain = timerTotal;
  timerRunning = true; updateTimerBtn();
  timerInterval = setInterval(() => {
    timerRemain--;
    renderTimerDisplay();
    if (timerRemain <= 0) { clearInterval(timerInterval); timerRunning = false; timerFinished(); }
  }, 1000);
}

function pauseTimer()  { if (!timerRunning) return; clearInterval(timerInterval); timerRunning = false; updateTimerBtn(); }
function stopTimer()   { clearInterval(timerInterval); timerRunning = false; }
function resetTimer()  { stopTimer(); timerRemain = timerTotal; renderTimerDisplay(); updateTimerBtn(); }
function toggleStartPause() { timerRunning ? pauseTimer() : startTimer(); }

function updateTimerBtn() {
  const btn = document.getElementById('startPauseBtn');
  if (timerRunning) { btn.textContent='Pause'; btn.classList.add('pause'); btn.classList.remove('start'); }
  else              { btn.textContent='Start'; btn.classList.remove('pause'); btn.classList.add('start'); }
}

function timerFinished() {
  updateTimerBtn();
  const disp = document.getElementById('timerDisplay');
  disp.classList.add('flash');
  setTimeout(() => disp.classList.remove('flash'), 700);
  playBeep();
  setTimeout(() => { timerRemain = timerTotal; renderTimerDisplay(); }, 1500);
}

function playBeep() {
  try {
    if (!beepCtx) beepCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = beepCtx;
    [0, 0.22, 0.44].forEach(offset => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch(e) {}
}

/* ── Init ─────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const d = new Date();
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('appDate').textContent = `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
  renderCalendar();
  loadWorkouts();
  renderTimerDisplay();
  updateTimerBtn();
});

/* ── Globals for inline handlers ──────────────────────────── */
window.calPrev          = calPrev;
window.calNext          = calNext;
window.setPreset        = setPreset;
window.setCustomTime    = setCustomTime;
window.toggleStartPause = toggleStartPause;
window.resetTimer       = resetTimer;
window.logWorkout       = logWorkout;
window.quickLog         = quickLog;
window.closeWorkout     = closeWorkout;

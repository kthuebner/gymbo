/* ── Constants ─────────────────────────────────────────── */
const STORAGE_LOGS = 'workout_logs';
const STORAGE_LAST = 'workout_last';

const ACTIVITY = {
  upper:  { label: 'Upper body',   cls: 'act-upper'  },
  lower:  { label: 'Lower body',   cls: 'act-lower'  },
  climb:  { label: 'Climbing',     cls: 'act-climb'  },
  cardio: { label: 'Cardio',       cls: 'act-cardio' },
  yoga:   { label: 'Yoga',         cls: 'act-yoga'   },
  walk:   { label: 'Walk / Other', cls: 'act-walk'   },
};

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

/* ── State ──────────────────────────────────────────────── */
let workouts      = [];
let openId        = null;
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();
let timerTotal    = 60;
let timerRemain   = 60;
let timerRunning  = false;
let timerInterval = null;
let audioCtx      = null;

/* ── Storage helpers ────────────────────────────────────── */
function getLogs()     { try { return JSON.parse(localStorage.getItem(STORAGE_LOGS) || '{}'); } catch(e) { return {}; } }
function getLastMap()  { try { return JSON.parse(localStorage.getItem(STORAGE_LAST) || '{}'); } catch(e) { return {}; } }
function saveLogs(o)   { localStorage.setItem(STORAGE_LOGS, JSON.stringify(o)); }
function saveLastMap(o){ localStorage.setItem(STORAGE_LAST, JSON.stringify(o)); }

/* ── Date helpers ───────────────────────────────────────── */
function pad(n) { return String(n).padStart(2, '0'); }
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}
function makeKey(y, m, d) {
  return y + '-' + pad(m+1) + '-' + pad(d);
}
function friendlyDate(key) {
  if (!key) return 'Never';
  const parts = key.split('-');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return mo[parseInt(parts[1])-1] + ' ' + parseInt(parts[2]);
}

/* ── Toast ──────────────────────────────────────────────── */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 2500);
}

/* ── Calendar ───────────────────────────────────────────── */
function renderCalendar() {
  const logs     = getLogs();
  const today    = todayKey();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const lastDay  = new Date(calYear, calMonth+1, 0).getDate();

  document.getElementById('calMonth').textContent = MONTHS[calMonth] + ' ' + calYear;

  const grid = document.getElementById('calDays');
  grid.innerHTML = '';

  for (var i = 0; i < firstDay; i++) {
    var blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  for (var d = 1; d <= lastDay; d++) {
    var key  = makeKey(calYear, calMonth, d);
    var type = logs[key];
    var el   = document.createElement('div');
    el.className = 'cal-day' +
      (type && ACTIVITY[type] ? ' ' + ACTIVITY[type].cls : '') +
      (key === today ? ' today' : '');
    el.textContent = d;
    if (type && ACTIVITY[type]) el.title = ACTIVITY[type].label;
    el.addEventListener('click', (function(k) {
      return function() { toggleDay(k); };
    })(key));
    grid.appendChild(el);
  }

  updateStreak();
  updateQuickBtns();
}

function toggleDay(key) {
  var logs = getLogs();
  if (logs[key]) { delete logs[key]; } else { logs[key] = 'walk'; }
  saveLogs(logs);
  renderCalendar();
}

function updateStreak() {
  var logs    = getLogs();
  var today   = todayKey();
  var streak  = 0;
  var d       = new Date();
  if (!logs[today]) d.setDate(d.getDate() - 1);

  for (var i = 0; i < 365; i++) {
    var key = makeKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (logs[key]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }

  var sessionsThisMonth = Object.keys(logs).filter(function(k) {
    var parts = k.split('-');
    return parseInt(parts[0]) === calYear && parseInt(parts[1]) === calMonth+1;
  }).length;

  document.getElementById('streakCount').textContent    = streak;
  document.getElementById('streakSessions').textContent = sessionsThisMonth + ' session' + (sessionsThisMonth !== 1 ? 's' : '');
  document.getElementById('streakMonthLabel').textContent = MONTHS[calMonth].slice(0,3).toLowerCase();
}

/* ── Quick log buttons ──────────────────────────────────── */
function updateQuickBtns() {
  var logs      = getLogs();
  var todayType = logs[todayKey()];
  document.querySelectorAll('.qbtn').forEach(function(btn) {
    var type = btn.getAttribute('data-type');
    btn.classList.toggle('qbtn-active', type === todayType);
  });
}

function quickLog(type) {
  var logs = getLogs();
  var key  = todayKey();
  if (logs[key] === type) {
    delete logs[key];
  } else {
    logs[key] = type;
    toast(ACTIVITY[type].label + ' logged.');
  }
  saveLogs(logs);
  renderCalendar();
}

/* ── Workout cards ──────────────────────────────────────── */
function renderCards() {
  var grid    = document.getElementById('workoutGrid');
  var lastMap = getLastMap();
  grid.innerHTML = '';

  workouts.forEach(function(w) {
    var card = document.createElement('div');
    card.className = 'wo-card ' + w.type +
      (openId && openId !== w.id ? ' faded' : '') +
      (openId && openId === w.id ? ' active' : '');
    card.innerHTML =
      '<div class="wo-type">' + w.typeLabel + '</div>' +
      '<div class="wo-name">' + w.name + '</div>' +
      '<div class="wo-last">' + (lastMap[w.id] ? 'Last: ' + friendlyDate(lastMap[w.id]) : 'Never done') + '</div>';
    card.addEventListener('click', (function(id) {
      return function() { toggleWorkout(id); };
    })(w.id));
    grid.appendChild(card);
  });
}

function toggleWorkout(id) {
  if (openId === id) { closeWorkout(); } else { openWorkout(id); }
}

function openWorkout(id) {
  openId = id;
  var w = null;
  for (var i = 0; i < workouts.length; i++) {
    if (workouts[i].id === id) { w = workouts[i]; break; }
  }
  if (!w) return;
  renderCards();

  var logs          = getLogs();
  var alreadyLogged = logs[todayKey()] === w.type;
  var exCount       = w.blocks.reduce(function(s,b) { return s + b.exercises.length; }, 0);

  var blocksHtml = w.blocks.map(function(b, bi) {
    var exRows = b.exercises.map(function(ex) {
      return '<div class="ex-row">' +
        '<div class="ex-info">' +
          '<div class="ex-name">' + ex.name + '</div>' +
          '<div class="ex-tip">'  + ex.tip  + '</div>' +
        '</div>' +
        '<div class="ex-right">' +
          '<div class="ex-sets">' + ex.sets + '</div>' +
          (ex.note ? '<div class="ex-note">' + ex.note + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="block">' +
      '<div class="block-header">' +
        '<input type="checkbox" class="block-check" id="chk' + bi + '">' +
        '<div class="block-meta">' +
          '<div class="block-title">' + b.title + '</div>' +
          '<div class="block-rest">'  + b.rest  + '</div>' +
        '</div>' +
      '</div>' + exRows + '</div>';
  }).join('');

  var panel = document.getElementById('workoutOpen');
  panel.innerHTML =
    '<div class="open-header">' +
      '<div><div class="open-name">' + w.name + '</div>' +
      '<div class="open-sub">' + w.typeLabel + ' · ' + exCount + ' exercises</div></div>' +
      '<button class="open-close" id="closeBtn">&#x2715;</button>' +
    '</div>' +
    '<div class="open-body">' +
      blocksHtml +
      '<div class="progression-box">' +
        '<div class="prog-label">Progression</div>' +
        '<div class="prog-text">' + w.progression + '</div>' +
      '</div>' +
      '<button class="log-btn' + (alreadyLogged ? ' logged' : '') + '" id="logBtn">' +
        (alreadyLogged ? '✓ Logged today' : '✓ Log workout — mark today done') +
      '</button>' +
    '</div>';

  panel.style.display = 'block';

  document.getElementById('closeBtn').addEventListener('click', function() {
    closeWorkout();
  });

  if (!alreadyLogged) {
    document.getElementById('logBtn').addEventListener('click', function() {
      doLog(w.id, w.type);
    });
  }

  setTimeout(function() {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 60);
}

function closeWorkout() {
  openId = null;
  var panel = document.getElementById('workoutOpen');
  panel.style.display = 'none';
  panel.innerHTML = '';
  renderCards();
}

function doLog(id, type) {
  var key     = todayKey();
  var logs    = getLogs();
  var lastMap = getLastMap();
  logs[key]   = type;
  lastMap[id] = key;
  saveLogs(logs);
  saveLastMap(lastMap);

  var btn = document.getElementById('logBtn');
  if (btn) {
    btn.classList.add('logged');
    btn.textContent = '✓ Logged today';
    btn.removeEventListener('click', doLog);
  }

  renderCalendar();
  renderCards();
  toast('Workout logged — nice work.');
}

/* ── Timer ──────────────────────────────────────────────── */
function fmt(s) { return pad(Math.floor(s/60)) + ':' + pad(s%60); }
function renderTimer() { document.getElementById('timerDisplay').textContent = fmt(timerRemain); }

function setPreset(secs, btn) {
  stopTimer();
  timerTotal  = secs;
  timerRemain = secs;
  renderTimer();
  document.querySelectorAll('.preset-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('customTime').value = '';
}

function setCustom() {
  var v = parseInt(document.getElementById('customTime').value);
  if (!v || v <= 0) return;
  stopTimer();
  timerTotal  = v;
  timerRemain = v;
  renderTimer();
  document.querySelectorAll('.preset-btn').forEach(function(b) { b.classList.remove('active'); });
}

function startTimer() {
  if (timerRunning) return;
  if (timerRemain <= 0) timerRemain = timerTotal;
  timerRunning = true;
  setTimerBtn(true);
  timerInterval = setInterval(function() {
    timerRemain--;
    renderTimer();
    if (timerRemain <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      onTimerDone();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  setTimerBtn(false);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
}

function resetTimer() {
  stopTimer();
  timerRemain = timerTotal;
  renderTimer();
  setTimerBtn(false);
}

function toggleTimer() {
  if (timerRunning) { pauseTimer(); } else { startTimer(); }
}

function setTimerBtn(running) {
  var btn = document.getElementById('startPauseBtn');
  if (running) {
    btn.textContent = 'Pause';
    btn.classList.add('pause');
    btn.classList.remove('start');
  } else {
    btn.textContent = 'Start';
    btn.classList.remove('pause');
    btn.classList.add('start');
  }
}

function onTimerDone() {
  setTimerBtn(false);
  var el = document.getElementById('timerDisplay');
  el.classList.add('flash');
  setTimeout(function() { el.classList.remove('flash'); }, 800);
  beep();
  setTimeout(function() { timerRemain = timerTotal; renderTimer(); }, 1600);
}

function beep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var ctx = audioCtx;
    [0, 0.22, 0.44].forEach(function(t) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'square'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch(e) {}
}

/* ── Load workouts ──────────────────────────────────────── */
function loadWorkouts() {
  fetch('workouts.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { workouts = data; renderCards(); })
    .catch(function() { workouts = []; renderCards(); });
}

/* ── Boot ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {

  // Header date
  var d = new Date();
  var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MO   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('appDate').textContent = DAYS[d.getDay()] + ' ' + MO[d.getMonth()] + ' ' + d.getDate();

  // Calendar nav
  document.getElementById('calPrev').addEventListener('click', function() {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', function() {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
  });

  // Quick log
  document.querySelectorAll('.qbtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      quickLog(btn.getAttribute('data-type'));
    });
  });

  // Timer presets
  document.querySelectorAll('.preset-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setPreset(parseInt(btn.getAttribute('data-secs')), btn);
    });
  });

  // Timer controls
  document.getElementById('startPauseBtn').addEventListener('click', toggleTimer);
  document.getElementById('resetBtn').addEventListener('click', resetTimer);
  document.getElementById('customTime').addEventListener('change', setCustom);
  document.getElementById('customTime').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') setCustom();
  });

  renderCalendar();
  renderTimer();
  loadWorkouts();
});

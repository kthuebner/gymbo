/* ═══════════════════════════════════════════════════
   Workout Tracker — app.js
   ═══════════════════════════════════════════════════ */

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

const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── State ─────────────────────────────────────────── */
var workouts     = [];
var openId       = null;
var calYear      = new Date().getFullYear();
var calMonth     = new Date().getMonth();
var timerTotal   = 60;
var timerRemain  = 60;
var timerRunning = false;
var timerTick    = null;
var audioCtx     = null;

/* ── Storage ────────────────────────────────────────── */
function getLogs()    { try { return JSON.parse(localStorage.getItem(STORAGE_LOGS)||'{}'); } catch(e){ return {}; } }
function getLastMap() { try { return JSON.parse(localStorage.getItem(STORAGE_LAST)||'{}'); } catch(e){ return {}; } }
function saveLogs(o)    { localStorage.setItem(STORAGE_LOGS, JSON.stringify(o)); }
function saveLastMap(o) { localStorage.setItem(STORAGE_LAST, JSON.stringify(o)); }

/* ── Date ───────────────────────────────────────────── */
function pad(n) { return ('0'+n).slice(-2); }

function todayKey() {
  var d = new Date();
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

// m is 0-based
function makeKey(y, m, day) {
  return y+'-'+pad(m+1)+'-'+pad(day);
}

function friendlyDate(key) {
  if (!key) return 'Never';
  var p = key.split('-');
  return MONTHS_SHORT[parseInt(p[1])-1]+' '+parseInt(p[2]);
}

/* ── Toast ──────────────────────────────────────────── */
function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function(){ el.classList.remove('show'); }, 2500);
}

/* ═══════════════════════════════════════════════════
   CALENDAR
   ═══════════════════════════════════════════════════ */
function renderCalendar() {
  var logs     = getLogs();
  var today    = todayKey();
  var firstDay = new Date(calYear, calMonth, 1).getDay();
  var daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  document.getElementById('calMonth').textContent = MONTHS[calMonth]+' '+calYear;

  var grid = document.getElementById('calDays');
  grid.innerHTML = '';

  // blank cells before first day
  for (var i = 0; i < firstDay; i++) {
    var blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  // day cells
  for (var day = 1; day <= daysInMonth; day++) {
    var key  = makeKey(calYear, calMonth, day);
    var type = logs[key] || null;
    var cell = document.createElement('div');
    var cls  = 'cal-day';
    if (type && ACTIVITY[type]) cls += ' '+ACTIVITY[type].cls;
    if (key === today)           cls += ' today';
    cell.className = cls;
    cell.setAttribute('data-day', day);
    if (type && ACTIVITY[type]) cell.title = ACTIVITY[type].label;

    cell.addEventListener('click', (function(k){ return function(){ openDayPicker(k); }; })(key));
    grid.appendChild(cell);
  }

  updateStreak();
  updateQuickBtns();
}

function updateStreak() {
  var logs   = getLogs();
  var today  = todayKey();
  var streak = 0;
  var cur    = new Date();
  if (!logs[today]) cur.setDate(cur.getDate()-1);

  for (var i = 0; i < 400; i++) {
    var k = makeKey(cur.getFullYear(), cur.getMonth(), cur.getDate());
    if (logs[k]) { streak++; cur.setDate(cur.getDate()-1); }
    else break;
  }

  var sessionsThisMonth = 0;
  var prefix = calYear+'-'+pad(calMonth+1)+'-';
  var allKeys = Object.keys(logs);
  for (var j = 0; j < allKeys.length; j++) {
    if (allKeys[j].indexOf(prefix) === 0) sessionsThisMonth++;
  }

  document.getElementById('streakCount').textContent    = streak;
  document.getElementById('streakSessions').textContent = sessionsThisMonth+' session'+(sessionsThisMonth!==1?'s':'');
  document.getElementById('streakMonthLabel').textContent = MONTHS[calMonth].slice(0,3).toLowerCase();
}

/* ═══════════════════════════════════════════════════
   DAY PICKER MODAL
   ═══════════════════════════════════════════════════ */
function openDayPicker(key) {
  var logs      = getLogs();
  var current   = logs[key] || null;
  var isToday   = key === todayKey();
  var label     = isToday ? 'Today' : friendlyDate(key);

  // build options — all 6 activity types
  var opts = Object.keys(ACTIVITY).map(function(type) {
    var act = ACTIVITY[type];
    var active = current === type ? ' dp-opt-active' : '';
    return '<button class="dp-opt'+active+'" data-type="'+type+'">' +
      '<span class="dp-dot '+act.cls+'"></span>' +
      '<span>'+act.label+'</span>' +
    '</button>';
  }).join('');

  var clearBtn = current
    ? '<button class="dp-clear" id="dpClear">Clear this day</button>'
    : '';

  var modal = document.getElementById('dayPickerModal');
  modal.innerHTML =
    '<div class="dp-box">' +
      '<div class="dp-header">' +
        '<span class="dp-title">'+label+'</span>' +
        '<button class="dp-close" id="dpClose">&#x2715;</button>' +
      '</div>' +
      '<div class="dp-opts" id="dpOpts">'+opts+'</div>' +
      clearBtn +
    '</div>';

  modal.style.display = 'flex';

  document.getElementById('dpClose').addEventListener('click', closeDayPicker);
  modal.addEventListener('click', function(e){ if(e.target===modal) closeDayPicker(); });

  document.getElementById('dpOpts').querySelectorAll('.dp-opt').forEach(function(btn){
    btn.addEventListener('click', function(){
      var type = btn.getAttribute('data-type');
      var logs2 = getLogs();
      logs2[key] = type;
      saveLogs(logs2);
      // if it's a known workout type, also update last date for matching workouts
      if (type === 'upper' || type === 'lower') {
        // find the most recently opened workout of this type and stamp it
        // (best effort — user can use the workout card for precise tracking)
      }
      closeDayPicker();
      renderCalendar();
      updateQuickBtns();
      toast(ACTIVITY[type].label+' logged for '+label+'.');
    });
  });

  if (current) {
    document.getElementById('dpClear').addEventListener('click', function(){
      var logs3 = getLogs();
      delete logs3[key];
      saveLogs(logs3);
      closeDayPicker();
      renderCalendar();
      toast('Cleared.');
    });
  }
}

function closeDayPicker() {
  var modal = document.getElementById('dayPickerModal');
  modal.style.display = 'none';
  modal.innerHTML = '';
}

/* ═══════════════════════════════════════════════════
   QUICK LOG
   ═══════════════════════════════════════════════════ */
function updateQuickBtns() {
  var logs      = getLogs();
  var todayType = logs[todayKey()] || null;
  document.querySelectorAll('.qbtn').forEach(function(btn){
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
    toast(ACTIVITY[type].label+' logged.');
  }
  saveLogs(logs);
  renderCalendar();
}

/* ═══════════════════════════════════════════════════
   WORKOUT CARDS
   ═══════════════════════════════════════════════════ */
function renderCards() {
  var grid    = document.getElementById('workoutGrid');
  var lastMap = getLastMap();
  grid.innerHTML = '';

  workouts.forEach(function(w){
    var card = document.createElement('div');
    card.className = 'wo-card '+w.type+
      (openId && openId!==w.id ? ' faded' : '')+
      (openId && openId===w.id ? ' active' : '');
    var lastTxt = lastMap[w.id] ? 'Last: '+friendlyDate(lastMap[w.id]) : 'Never done';
    card.innerHTML =
      '<div class="wo-type">'+w.typeLabel+'</div>'+
      '<div class="wo-name">'+w.name+'</div>'+
      '<div class="wo-last">'+lastTxt+'</div>';
    card.addEventListener('click', (function(id){ return function(){ toggleWorkout(id); }; })(w.id));
    grid.appendChild(card);
  });
}

function toggleWorkout(id) {
  if (openId === id) { closeWorkout(); } else { openWorkout(id); }
}

function openWorkout(id) {
  openId = id;
  var w = null;
  for (var i=0;i<workouts.length;i++){ if(workouts[i].id===id){ w=workouts[i]; break; } }
  if (!w) return;
  renderCards();

  var logs         = getLogs();
  var alreadyLogged = (logs[todayKey()] === w.type);
  var exCount      = w.blocks.reduce(function(s,b){ return s+b.exercises.length; },0);

  var blocksHtml = w.blocks.map(function(b,bi){
    var rows = b.exercises.map(function(ex){
      return '<div class="ex-row">'+
        '<div class="ex-info">'+
          '<div class="ex-name">'+ex.name+'</div>'+
          '<div class="ex-tip">'+ex.tip+'</div>'+
        '</div>'+
        '<div class="ex-right">'+
          '<div class="ex-sets">'+ex.sets+'</div>'+
          (ex.note?'<div class="ex-note">'+ex.note+'</div>':'')+
        '</div>'+
      '</div>';
    }).join('');
    return '<div class="block">'+
      '<div class="block-header">'+
        '<input type="checkbox" class="block-check" id="chk'+bi+'">'+
        '<div class="block-meta">'+
          '<div class="block-title">'+b.title+'</div>'+
          '<div class="block-rest">'+b.rest+'</div>'+
        '</div>'+
      '</div>'+rows+'</div>';
  }).join('');

  var panel = document.getElementById('workoutOpen');
  panel.innerHTML =
    '<div class="open-header">'+
      '<div><div class="open-name">'+w.name+'</div>'+
      '<div class="open-sub">'+w.typeLabel+' · '+exCount+' exercises</div></div>'+
      '<button class="open-close" id="closeBtn">&#x2715;</button>'+
    '</div>'+
    '<div class="open-body">'+
      blocksHtml+
      '<div class="progression-box">'+
        '<div class="prog-label">Progression</div>'+
        '<div class="prog-text">'+w.progression+'</div>'+
      '</div>'+
      '<button class="log-btn'+(alreadyLogged?' logged':'')+'" id="logBtn">'+
        (alreadyLogged ? '&#10003; Logged today' : '&#10003; Log workout &mdash; mark today done')+
      '</button>'+
    '</div>';

  panel.style.display = 'block';

  document.getElementById('closeBtn').addEventListener('click', closeWorkout);

  if (!alreadyLogged) {
    document.getElementById('logBtn').addEventListener('click', function(){
      doLog(w.id, w.type);
    });
  }

  setTimeout(function(){
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
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
    btn.replaceWith(btn.cloneNode(true)); // remove listener
  }

  renderCalendar();
  renderCards();
  toast('Workout logged — nice work.');
}

/* ═══════════════════════════════════════════════════
   TIMER
   ═══════════════════════════════════════════════════ */
function fmtTime(s) { return pad(Math.floor(s/60))+':'+pad(s%60); }
function renderTimer() { document.getElementById('timerDisplay').textContent = fmtTime(timerRemain); }

function setPreset(secs, btn) {
  stopTimer();
  timerTotal = timerRemain = secs;
  renderTimer();
  document.querySelectorAll('.preset-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('customTime').value = '';
}

function setCustom() {
  var v = parseInt(document.getElementById('customTime').value);
  if (!v || v<=0) return;
  stopTimer();
  timerTotal = timerRemain = v;
  renderTimer();
  document.querySelectorAll('.preset-btn').forEach(function(b){ b.classList.remove('active'); });
}

function stopTimer()  { clearInterval(timerTick); timerRunning=false; }
function resetTimer() { stopTimer(); timerRemain=timerTotal; renderTimer(); setTimerBtn(false); }
function toggleTimer(){ timerRunning ? pauseTimer() : startTimer(); }

function startTimer() {
  if (timerRunning) return;
  if (timerRemain<=0) timerRemain=timerTotal;
  timerRunning=true; setTimerBtn(true);
  timerTick = setInterval(function(){
    timerRemain--;
    renderTimer();
    if (timerRemain<=0){ clearInterval(timerTick); timerRunning=false; onTimerDone(); }
  },1000);
}

function pauseTimer() { clearInterval(timerTick); timerRunning=false; setTimerBtn(false); }

function setTimerBtn(running) {
  var btn=document.getElementById('startPauseBtn');
  if(running){ btn.textContent='Pause'; btn.classList.add('pause'); btn.classList.remove('start'); }
  else       { btn.textContent='Start'; btn.classList.remove('pause'); btn.classList.add('start'); }
}

function onTimerDone() {
  setTimerBtn(false);
  var el = document.getElementById('timerDisplay');
  el.classList.add('flash');
  setTimeout(function(){ el.classList.remove('flash'); }, 800);
  beep();
  setTimeout(function(){ timerRemain=timerTotal; renderTimer(); }, 1600);
}

function beep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    var ctx = audioCtx;
    [0,0.22,0.44].forEach(function(t){
      var o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type='square'; o.frequency.value=880;
      g.gain.setValueAtTime(0.25, ctx.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+0.18);
      o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+0.2);
    });
  } catch(e){}
}

/* ═══════════════════════════════════════════════════
   LOAD & BOOT
   ═══════════════════════════════════════════════════ */
function loadWorkouts() {
  fetch('workouts.json')
    .then(function(r){ return r.json(); })
    .then(function(data){ workouts=data; renderCards(); })
    .catch(function(){ workouts=[]; renderCards(); });
}

document.addEventListener('DOMContentLoaded', function(){

  // Header date
  var d=new Date();
  var DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('appDate').textContent = DN[d.getDay()]+' '+MN[d.getMonth()]+' '+d.getDate();

  // Cal nav
  document.getElementById('calPrev').addEventListener('click',function(){
    calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click',function(){
    calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar();
  });

  // Quick log
  document.querySelectorAll('.qbtn').forEach(function(btn){
    btn.addEventListener('click',function(){ quickLog(btn.getAttribute('data-type')); });
  });

  // Timer presets
  document.querySelectorAll('.preset-btn').forEach(function(btn){
    btn.addEventListener('click',function(){ setPreset(parseInt(btn.getAttribute('data-secs')),btn); });
  });

  // Timer controls
  document.getElementById('startPauseBtn').addEventListener('click', toggleTimer);
  document.getElementById('resetBtn').addEventListener('click', resetTimer);
  document.getElementById('customTime').addEventListener('change', setCustom);
  document.getElementById('customTime').addEventListener('keydown',function(e){ if(e.key==='Enter') setCustom(); });

  renderCalendar();
  renderTimer();
  loadWorkouts();
});

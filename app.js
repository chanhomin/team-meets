(function () {
  'use strict';

  var STORAGE_KEY = 'team-meets.v1';

  var gridEl = document.getElementById('grid');
  var weekLabelEl = document.getElementById('week-label');
  var todayBtn = document.getElementById('week-today');
  var noticeEl = document.getElementById('notice');
  var nameInput = document.getElementById('my-name');
  var copyBtn = document.getElementById('copy-code');
  var shareStatusEl = document.getElementById('share-status');
  var shareCodeEl = document.getElementById('share-code');

  // 기본 범위: 평일 9~23시, 30분 단위 (설정은 5단계에서 추가)
  var DAYS = [
    { key: 'mon', label: '월' },
    { key: 'tue', label: '화' },
    { key: 'wed', label: '수' },
    { key: 'thu', label: '목' },
    { key: 'fri', label: '금' }
  ];
  var START_HOUR = 9;
  var END_HOUR = 23;
  var STEP_MIN = 30;

  // ---- 저장소 ----
  // 형식: { name: "홍길동", weeks: { "2026-10-12": ["mon-09:00", ...] } }
  // 슬롯은 칸 번호가 아니라 요일+시각으로 저장한다. 시간 범위가 바뀌어도 데이터가 유지되게 하기 위해서다.

  function emptyState() {
    return { weeks: {} };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.weeks || typeof parsed.weeks !== 'object') {
        return emptyState();
      }
      return parsed;
    } catch (e) {
      showNotice('저장된 데이터를 읽지 못했습니다. 빈 상태로 시작합니다.');
      return emptyState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      showNotice('브라우저에 저장하지 못했습니다. 새로고침하면 이번 변경이 사라질 수 있습니다.');
      return false;
    }
  }

  // ---- 날짜 ----

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function mondayOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var offset = (d.getDay() + 6) % 7; // 월=0 ... 일=6
    d.setDate(d.getDate() - offset);
    return d;
  }

  function addDays(date, n) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  function weekKeyOf(monday) {
    return monday.getFullYear() + '-' + pad2(monday.getMonth() + 1) + '-' + pad2(monday.getDate());
  }

  function shortDate(d) {
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  // ---- 슬롯 ----

  function timeSlots() {
    var list = [];
    for (var m = START_HOUR * 60; m < END_HOUR * 60; m += STEP_MIN) {
      list.push(pad2(Math.floor(m / 60)) + ':' + pad2(m % 60));
    }
    return list;
  }

  var TIMES = timeSlots();

  function slotId(dayKey, time) {
    return dayKey + '-' + time;
  }

  // ---- 상태 ----

  var state = loadState();
  var currentMonday = mondayOf(new Date());
  var selected = {}; // 현재 주의 가능 슬롯 집합

  function currentWeekKey() {
    return weekKeyOf(currentMonday);
  }

  function loadWeek() {
    selected = {};
    var slots = state.weeks[currentWeekKey()];
    if (Array.isArray(slots)) {
      slots.forEach(function (id) {
        if (typeof id === 'string') selected[id] = true;
      });
    }
  }

  function saveWeek() {
    // 격자 순서대로 정렬해서 저장한다. 현재 범위 밖의 슬롯도 지우지 않고 남긴다.
    var prev = state.weeks[currentWeekKey()];
    var outside = Array.isArray(prev) ? prev.filter(function (id) { return !isInGrid(id); }) : [];
    var inside = [];
    DAYS.forEach(function (day) {
      TIMES.forEach(function (t) {
        var id = slotId(day.key, t);
        if (selected[id]) inside.push(id);
      });
    });
    state.weeks[currentWeekKey()] = inside.concat(outside);
    saveState();
  }

  var GRID_IDS = {};
  DAYS.forEach(function (day) {
    TIMES.forEach(function (t) { GRID_IDS[slotId(day.key, t)] = true; });
  });

  function isInGrid(id) {
    return GRID_IDS[id] === true;
  }

  // ---- 화면 ----

  function showNotice(msg) {
    if (!noticeEl) return;
    noticeEl.textContent = msg;
    noticeEl.hidden = false;
  }

  function renderWeekLabel() {
    var friday = addDays(currentMonday, DAYS.length - 1);
    weekLabelEl.textContent =
      currentMonday.getFullYear() + '년 ' + (currentMonday.getMonth() + 1) + '월 ' + currentMonday.getDate() + '일 ~ ' +
      (friday.getMonth() + 1) + '월 ' + friday.getDate() + '일';
    todayBtn.disabled = currentWeekKey() === weekKeyOf(mondayOf(new Date()));
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    gridEl.style.setProperty('--day-count', DAYS.length);

    var corner = document.createElement('div');
    corner.className = 'grid-head';
    gridEl.appendChild(corner);

    DAYS.forEach(function (day, i) {
      var head = document.createElement('div');
      head.className = 'grid-head';
      head.setAttribute('role', 'columnheader');
      head.textContent = day.label;
      var sub = document.createElement('small');
      sub.textContent = shortDate(addDays(currentMonday, i));
      head.appendChild(sub);
      gridEl.appendChild(head);
    });

    TIMES.forEach(function (t, row) {
      var label = document.createElement('div');
      label.className = 'time-label';
      label.textContent = t.slice(3) === '00' ? String(Number(t.slice(0, 2))) + ':00' : '';
      gridEl.appendChild(label);

      DAYS.forEach(function (day, col) {
        var id = slotId(day.key, t);
        var cell = document.createElement('div');
        cell.className = 'cell';
        if (row % 2 === 1) cell.classList.add('hour-end');
        if (col === DAYS.length - 1) cell.classList.add('last-col');
        if (selected[id]) cell.classList.add('on');
        cell.dataset.slot = id;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', day.label + '요일 ' + t);
        cell.setAttribute('aria-selected', selected[id] ? 'true' : 'false');
        gridEl.appendChild(cell);
      });
    });
  }

  function render() {
    renderWeekLabel();
    renderGrid();
  }

  // ---- 드래그 칠하기 (마우스·터치 공통, Pointer Events) ----
  // 처음 누른 칸이 비어 있으면 칠하기, 칠해져 있으면 지우기로 드래그 내내 고정한다.

  var drag = null; // { paint: boolean, changed: boolean }

  function applyToCell(cell) {
    if (!cell || !cell.dataset || !cell.dataset.slot) return;
    var id = cell.dataset.slot;
    var has = selected[id] === true;
    if (has === drag.paint) return;
    if (drag.paint) selected[id] = true;
    else delete selected[id];
    cell.classList.toggle('on', drag.paint);
    cell.setAttribute('aria-selected', drag.paint ? 'true' : 'false');
    drag.changed = true;
  }

  function cellAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (el && el.classList && el.classList.contains('cell') && gridEl.contains(el)) return el;
    return null;
  }

  gridEl.addEventListener('pointerdown', function (e) {
    var cell = e.target.closest ? e.target.closest('.cell') : null;
    if (!cell) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    drag = { paint: selected[cell.dataset.slot] !== true, changed: false };
    applyToCell(cell);
  });

  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    applyToCell(cellAt(e.clientX, e.clientY));
  });

  function endDrag() {
    if (!drag) return;
    var changed = drag.changed;
    drag = null;
    if (changed) {
      saveWeek();
      clearShareOutput();
    }
  }

  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', endDrag);

  // ---- 공유 코드 내보내기 ----
  // 코드 = Base64(UTF-8(JSON {name, week, slots})). 한글 이름 때문에 UTF-8로 바꾼 뒤 Base64로 인코딩한다.

  function encodeShareCode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function buildMyCode(name) {
    var slots = state.weeks[currentWeekKey()];
    return encodeShareCode({
      name: name,
      week: currentWeekKey(),
      slots: Array.isArray(slots) ? slots.slice() : []
    });
  }

  function setShareStatus(msg, isError) {
    shareStatusEl.textContent = msg;
    shareStatusEl.classList.toggle('error', !!isError);
    shareStatusEl.hidden = false;
  }

  function clearShareOutput() {
    shareStatusEl.hidden = true;
    shareCodeEl.hidden = true;
    shareCodeEl.value = '';
  }

  // 클립보드 API가 막힌 환경(일부 브라우저의 file://)을 위해 execCommand로 한 번 더 시도한다.
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      shareCodeEl.hidden = false;
      shareCodeEl.value = text;
      shareCodeEl.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      if (ok) resolve();
      else reject(new Error('copy failed'));
    });
  }

  nameInput.value = typeof state.name === 'string' ? state.name : '';

  nameInput.addEventListener('change', function () {
    state.name = nameInput.value.trim();
    nameInput.value = state.name;
    saveState();
    clearShareOutput();
  });

  copyBtn.addEventListener('click', function () {
    var name = nameInput.value.trim();
    if (!name) {
      setShareStatus('이름을 먼저 입력하세요. 팀원 화면에 이 이름으로 표시됩니다.', true);
      nameInput.focus();
      return;
    }
    if (name !== state.name) {
      state.name = name;
      saveState();
    }

    var code;
    try {
      code = buildMyCode(name);
    } catch (e) {
      setShareStatus('코드를 만들지 못했습니다.', true);
      return;
    }

    shareCodeEl.value = code;
    shareCodeEl.hidden = false;
    var count = (state.weeks[currentWeekKey()] || []).length;
    var weekText = weekLabelEl.textContent;

    copyText(code).then(function () {
      setShareStatus('복사했습니다 (' + weekText + ', 가능 ' + count + '칸). 단톡방에 붙여넣으세요.', false);
    }, function () {
      setShareStatus('자동 복사가 막혀 있습니다. 아래 코드를 직접 선택해서 복사하세요.', true);
      shareCodeEl.select();
    });
  });

  // ---- 주 이동 ----

  function goToWeek(monday) {
    endDrag();
    clearShareOutput();
    currentMonday = monday;
    loadWeek();
    render();
  }

  document.getElementById('week-prev').addEventListener('click', function () {
    goToWeek(addDays(currentMonday, -7));
  });
  document.getElementById('week-next').addEventListener('click', function () {
    goToWeek(addDays(currentMonday, 7));
  });
  todayBtn.addEventListener('click', function () {
    goToWeek(mondayOf(new Date()));
  });

  loadWeek();
  render();
})();

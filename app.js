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
  var tabMine = document.getElementById('tab-mine');
  var tabTeam = document.getElementById('tab-team');
  var screenMine = document.getElementById('screen-mine');
  var screenTeam = document.getElementById('screen-team');
  var pasteInput = document.getElementById('paste-input');
  var pasteAddBtn = document.getElementById('paste-add');
  var pasteResultsEl = document.getElementById('paste-results');
  var membersTitleEl = document.getElementById('members-title');
  var membersListEl = document.getElementById('members-list');
  var heatGridEl = document.getElementById('heat-grid');
  var heatScaleLabelEl = document.getElementById('heat-scale-label');
  var heatDetailEl = document.getElementById('heat-detail');
  var fixedToggleBtn = document.getElementById('fixed-toggle');
  var fixedBannerEl = document.getElementById('fixed-banner');
  var fixedDoneBtn = document.getElementById('fixed-done');
  var fixedStatusEl = document.getElementById('fixed-status');
  var mineHintEl = document.getElementById('mine-hint');
  var mineLegendEl = document.getElementById('mine-legend');
  var weekPrevBtn = document.getElementById('week-prev');
  var weekNextBtn = document.getElementById('week-next');

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
  // 형식: {
  //   name: "홍길동",
  //   weeks: { "2026-10-12": ["mon-09:00", ...] },          내 주별 가능시간
  //   team:  { "2026-10-12": { "김팀원": ["mon-09:00", ...] } } 붙여넣은 팀원 코드 (주별, 이름별)
  //   fixed: ["tue-10:00", ...],                              고정 시간 본체 (매주 반복되는 불가 시간)
  //   weekFixed: { "2026-10-12": ["tue-10:00", ...] },        그 주에 처음 입력할 때 복사해 둔 고정 시간
  //   released:  { "2026-10-12": ["tue-10:00", ...] }         그 주에만 푼 고정 칸 (= 그 주만 가능)
  // }
  // 고정 시간 적용(B안): 입력이 없는 주는 현재 고정 시간을 보여주고, 그 주에 처음 입력하는 순간
  // 고정 시간을 weekFixed에 복사한다. 이후 고정 시간 본체를 바꿔도 이미 입력한 주는 바뀌지 않는다.
  // 슬롯은 칸 번호가 아니라 요일+시각으로 저장한다. 시간 범위가 바뀌어도 데이터가 유지되게 하기 위해서다.

  function emptyState() {
    return { weeks: {}, team: {}, fixed: [], weekFixed: {}, released: {} };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.weeks || typeof parsed.weeks !== 'object') {
        return emptyState();
      }
      if (!isPlainObject(parsed.team)) parsed.team = {};
      if (!Array.isArray(parsed.fixed)) parsed.fixed = [];
      if (!isPlainObject(parsed.weekFixed)) parsed.weekFixed = {};
      if (!isPlainObject(parsed.released)) parsed.released = {};
      return parsed;
    } catch (e) {
      showNotice('저장된 데이터를 읽지 못했습니다. 빈 상태로 시작합니다.');
      return emptyState();
    }
  }

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
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
  var selected = {};  // 현재 주에 칠한 가능 슬롯 집합
  var weekFixed = {};  // 현재 주에 적용되는 고정 칸 집합
  var released = {};   // 현재 주에만 푼 고정 칸 집합
  var editingFixed = false;

  function currentWeekKey() {
    return weekKeyOf(currentMonday);
  }

  function stringSet(list) {
    var set = {};
    if (Array.isArray(list)) {
      list.forEach(function (id) {
        if (typeof id === 'string') set[id] = true;
      });
    }
    return set;
  }

  // 입력이 있는 주 = 칠하기나 풀기를 한 번이라도 한 주
  function hasInput(weekKey) {
    return Array.isArray(state.weeks[weekKey]) || Array.isArray(state.weekFixed[weekKey]);
  }

  function fixedListFor(weekKey) {
    if (Array.isArray(state.weekFixed[weekKey])) return state.weekFixed[weekKey];
    // 고정 시간 기능 이전에 입력한 주는 고정 시간 없이 시작한 주로 본다.
    if (Array.isArray(state.weeks[weekKey])) return [];
    return state.fixed;
  }

  // 공유 코드와 팀 겹침에 쓰는 실제 가능 슬롯 = 칠한 칸(고정 칸 제외) + 그 주에 푼 고정 칸
  function effectiveSlots(weekKey) {
    var fixedSet = stringSet(fixedListFor(weekKey));
    var rel = stringSet(state.released[weekKey]);
    var mine = Array.isArray(state.weeks[weekKey]) ? state.weeks[weekKey] : [];
    var result = {};
    mine.forEach(function (id) {
      if (typeof id === 'string' && !fixedSet[id]) result[id] = true;
    });
    Object.keys(rel).forEach(function (id) {
      if (fixedSet[id]) result[id] = true;
    });
    return sortSlots(Object.keys(result));
  }

  function loadWeek() {
    var key = currentWeekKey();
    selected = stringSet(state.weeks[key]);
    weekFixed = stringSet(fixedListFor(key));
    released = stringSet(state.released[key]);
  }

  // 격자 순서대로 정렬한다. 현재 범위 밖의 슬롯은 지우지 않고 뒤에 남긴다.
  function sortSlots(list) {
    var set = stringSet(list);
    var inside = [];
    DAYS.forEach(function (day) {
      TIMES.forEach(function (t) {
        var id = slotId(day.key, t);
        if (set[id]) inside.push(id);
      });
    });
    var outside = Object.keys(set).filter(function (id) { return !isInGrid(id); }).sort();
    return inside.concat(outside);
  }

  function saveWeek() {
    var key = currentWeekKey();
    // 처음 입력하는 주라면 지금 보이는 고정 시간을 이 주에 복사해 둔다.
    if (!Array.isArray(state.weekFixed[key])) state.weekFixed[key] = sortSlots(Object.keys(weekFixed));
    state.weeks[key] = sortSlots(Object.keys(selected));
    state.released[key] = sortSlots(Object.keys(released));
    saveState();
  }

  function saveFixed() {
    state.fixed = sortSlots(Object.keys(weekFixed));
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

  // 내 격자와 히트맵이 같은 격자 구조를 쓴다. decorate(cell, id)로 칸별 표시만 다르게 한다.
  function buildGrid(container, decorate) {
    container.innerHTML = '';
    container.style.setProperty('--day-count', DAYS.length);

    var corner = document.createElement('div');
    corner.className = 'grid-head';
    container.appendChild(corner);

    DAYS.forEach(function (day, i) {
      var head = document.createElement('div');
      head.className = 'grid-head';
      head.setAttribute('role', 'columnheader');
      head.textContent = day.label;
      var sub = document.createElement('small');
      sub.textContent = shortDate(addDays(currentMonday, i));
      head.appendChild(sub);
      container.appendChild(head);
    });

    TIMES.forEach(function (t, row) {
      var label = document.createElement('div');
      label.className = 'time-label';
      label.textContent = t.slice(3) === '00' ? String(Number(t.slice(0, 2))) + ':00' : '';
      container.appendChild(label);

      DAYS.forEach(function (day, col) {
        var id = slotId(day.key, t);
        var cell = document.createElement('div');
        cell.className = 'cell';
        if (row % 2 === 1) cell.classList.add('hour-end');
        if (col === DAYS.length - 1) cell.classList.add('last-col');
        cell.dataset.slot = id;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', day.label + '요일 ' + t);
        decorate(cell, id);
        container.appendChild(cell);
      });
    });
  }

  function cellState(id) {
    if (editingFixed) return weekFixed[id] ? 'fixed' : 'off';
    if (weekFixed[id]) return released[id] ? 'released' : 'fixed';
    return selected[id] ? 'on' : 'off';
  }

  var STATE_TEXT = { on: '가능', off: '불가', fixed: '고정 불가', released: '이번 주만 가능' };

  function paintCell(cell) {
    var st = cellState(cell.dataset.slot);
    cell.classList.toggle('on', st === 'on');
    cell.classList.toggle('fixed', st === 'fixed');
    cell.classList.toggle('released', st === 'released');
    cell.setAttribute('aria-selected', st === 'on' || st === 'released' ? 'true' : 'false');
    cell.title = STATE_TEXT[st];
  }

  function renderGrid() {
    gridEl.classList.toggle('editing-fixed', editingFixed);
    buildGrid(gridEl, function (cell) {
      paintCell(cell);
    });
  }

  function render() {
    renderWeekLabel();
    renderGrid();
    renderTeam();
  }

  // ---- 드래그 칠하기 (마우스·터치 공통, Pointer Events) ----
  // 처음 누른 칸으로 드래그 동작을 정하고, 드래그 내내 같은 동작만 한다.
  //   고정 편집 모드: 고정 칸 칠하기 / 지우기
  //   일반 모드, 빈 칸·칠한 칸에서 시작: 칠하기 / 지우기 (고정 칸은 건너뜀)
  //   일반 모드, 고정 칸에서 시작: 이번 주만 풀기 (고정 칸에만 적용)
  //   일반 모드, 푼 칸에서 시작: 다시 고정으로 되돌리기 (푼 칸에만 적용)

  var drag = null; // { set: 바꿀 집합, value: 넣기(true)/빼기(false), onlyFixed: boolean|null, changed: boolean }

  function startDrag(id) {
    if (editingFixed) return { set: weekFixed, value: !weekFixed[id], onlyFixed: null, changed: false };
    if (weekFixed[id]) return { set: released, value: !released[id], onlyFixed: true, changed: false };
    return { set: selected, value: !selected[id], onlyFixed: false, changed: false };
  }

  function applyToCell(cell) {
    if (!cell || !cell.dataset || !cell.dataset.slot) return;
    var id = cell.dataset.slot;
    if (drag.onlyFixed === true && !weekFixed[id]) return;
    if (drag.onlyFixed === false && weekFixed[id]) return;
    if ((drag.set[id] === true) === drag.value) return;
    if (drag.value) drag.set[id] = true;
    else delete drag.set[id];
    paintCell(cell);
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
    drag = startDrag(cell.dataset.slot);
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
    if (!changed) return;
    if (editingFixed) {
      saveFixed();
      return;
    }
    saveWeek();
    clearShareOutput();
    renderTeam();
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
    return encodeShareCode({
      name: name,
      week: currentWeekKey(),
      slots: effectiveSlots(currentWeekKey())
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
    renderTeam();
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
    var count = effectiveSlots(currentWeekKey()).length;
    var weekText = weekLabelEl.textContent;

    copyText(code).then(function () {
      setShareStatus('복사했습니다 (' + weekText + ', 가능 ' + count + '칸). 단톡방에 붙여넣으세요.', false);
    }, function () {
      setShareStatus('자동 복사가 막혀 있습니다. 아래 코드를 직접 선택해서 복사하세요.', true);
      shareCodeEl.select();
    });
  });

  // ---- 팀원 코드 붙여넣기 ----

  var WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
  var SLOT_RE = /^(mon|tue|wed|thu|fri|sat|sun)-([01]\d|2[0-3]):[0-5]\d$/;
  var MAX_NAME = 20;
  var MAX_SLOTS = 7 * 48;

  // 잘못된 코드면 Error를 던진다. 호출하는 쪽에서 잡아서 안내만 보여준다.
  function decodeShareCode(text) {
    var bin = atob(text);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!obj || typeof obj !== 'object') throw new Error('형식 오류');
    var name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!name || name.length > MAX_NAME) throw new Error('이름 오류');
    if (typeof obj.week !== 'string' || !WEEK_RE.test(obj.week)) throw new Error('주 오류');
    if (!Array.isArray(obj.slots) || obj.slots.length > MAX_SLOTS) throw new Error('슬롯 오류');
    var seen = {};
    var slots = [];
    obj.slots.forEach(function (id) {
      if (typeof id !== 'string' || !SLOT_RE.test(id)) throw new Error('슬롯 오류');
      if (!seen[id]) {
        seen[id] = true;
        slots.push(id);
      }
    });
    return { name: name, week: obj.week, slots: slots };
  }

  function weekTitle(weekKey) {
    var p = weekKey.split('-');
    return Number(p[1]) + '/' + Number(p[2]) + ' 주';
  }

  function shortCode(code) {
    return code.length > 12 ? code.slice(0, 12) + '…' : code;
  }

  function teamOfWeek() {
    var t = state.team[currentWeekKey()];
    return t && typeof t === 'object' && !Array.isArray(t) ? t : {};
  }

  function myName() {
    return typeof state.name === 'string' ? state.name : '';
  }

  function addCodes(text) {
    var codes = text.split(/\s+/).filter(function (c) { return c.length > 0; });
    var results = [];
    if (codes.length === 0) {
      results.push({ ok: false, text: '붙여넣은 코드가 없습니다.' });
      return results;
    }
    var week = currentWeekKey();
    var team = teamOfWeek();
    var changed = false;

    codes.forEach(function (code) {
      var data;
      try {
        data = decodeShareCode(code);
      } catch (e) {
        results.push({ ok: false, text: '올바른 코드가 아닙니다: ' + shortCode(code) });
        return;
      }
      if (data.week !== week) {
        results.push({ ok: false, text: '무시: ' + data.name + '님의 코드는 ' + weekTitle(data.week) + ' 코드입니다. 지금 보는 주는 ' + weekTitle(week) + '입니다.' });
        return;
      }
      if (myName() && data.name === myName()) {
        results.push({ ok: false, text: '무시: 내 이름(' + data.name + ')과 같은 코드입니다. 내 시간은 자동으로 포함됩니다.' });
        return;
      }
      var existed = Object.prototype.hasOwnProperty.call(team, data.name);
      team[data.name] = data.slots;
      changed = true;
      results.push({ ok: true, text: (existed ? '덮어씀: ' : '추가됨: ') + data.name + ' (가능 ' + data.slots.length + '칸)' });
    });

    if (changed) {
      state.team[week] = team;
      saveState();
    }
    return results;
  }

  function showPasteResults(results) {
    pasteResultsEl.innerHTML = '';
    results.forEach(function (r) {
      var li = document.createElement('li');
      li.className = r.ok ? 'ok' : 'bad';
      li.textContent = r.text;
      pasteResultsEl.appendChild(li);
    });
    pasteResultsEl.hidden = results.length === 0;
  }

  function removeMember(name) {
    var team = teamOfWeek();
    delete team[name];
    state.team[currentWeekKey()] = team;
    saveState();
    showPasteResults([]);
    renderTeam();
  }

  pasteAddBtn.addEventListener('click', function () {
    var results = addCodes(pasteInput.value);
    showPasteResults(results);
    if (results.some(function (r) { return r.ok; })) pasteInput.value = '';
    renderTeam();
  });

  // ---- 겹침 히트맵 ----
  // 나(1단계에서 칠한 시간)는 자동으로 포함한다.

  function teamMembers() {
    var members = [];
    members.push({ name: myName() || '나', me: true, slots: toSet(effectiveSlots(currentWeekKey())) });
    var team = teamOfWeek();
    Object.keys(team).sort(function (a, b) { return a.localeCompare(b, 'ko'); }).forEach(function (name) {
      if (name === myName()) return;
      members.push({ name: name, me: false, slots: toSet(Array.isArray(team[name]) ? team[name] : []) });
    });
    return members;
  }

  function toSet(list) {
    var set = {};
    list.forEach(function (id) { set[id] = true; });
    return set;
  }

  function slotTitle(id) {
    var day = DAYS.filter(function (d) { return d.key === id.slice(0, 3); })[0];
    var start = id.slice(4);
    var m = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + STEP_MIN;
    var end = pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
    return (day ? day.label + ' ' : '') + start + '~' + end;
  }

  var activeHeatCell = null;

  function showHeatDetail(cell) {
    if (!cell || !cell.dataset.slot) return;
    if (activeHeatCell) activeHeatCell.classList.remove('active');
    activeHeatCell = cell;
    cell.classList.add('active');

    var id = cell.dataset.slot;
    var members = teamMembers();
    var yes = [];
    var no = [];
    members.forEach(function (m) {
      var label = m.me ? m.name + '(나)' : m.name;
      (m.slots[id] ? yes : no).push(label);
    });

    heatDetailEl.innerHTML = '';
    var title = document.createElement('strong');
    title.textContent = slotTitle(id) + ' · 가능 ' + yes.length + '/' + members.length + '명' +
      (members.length >= 2 && no.length === 0 ? ' · 전원 가능' : '');
    heatDetailEl.appendChild(title);
    heatDetailEl.appendChild(document.createTextNode('가능: ' + (yes.length ? yes.join(', ') : '없음')));
    heatDetailEl.appendChild(document.createElement('br'));
    heatDetailEl.appendChild(document.createTextNode('불가: ' + (no.length ? no.join(', ') : '없음')));
  }

  function resetHeatDetail() {
    activeHeatCell = null;
    heatDetailEl.textContent = '칸을 가리키거나 누르면 가능/불가 명단이 보입니다.';
  }

  function renderMembers(members) {
    membersTitleEl.textContent = '응답자 ' + members.length + '명' +
      (members.length < 2 ? ' · 팀원 코드를 붙여넣으면 겹치는 시간이 보입니다.' : '');
    membersListEl.innerHTML = '';
    members.forEach(function (m) {
      var li = document.createElement('li');
      if (m.me) {
        li.className = 'me';
        li.textContent = m.name + '(나)';
      } else {
        li.appendChild(document.createTextNode(m.name));
        var del = document.createElement('button');
        del.type = 'button';
        del.textContent = '삭제';
        del.setAttribute('aria-label', m.name + ' 삭제');
        del.addEventListener('click', function () { removeMember(m.name); });
        li.appendChild(del);
      }
      membersListEl.appendChild(li);
    });
  }

  function renderTeam() {
    var members = teamMembers();
    var total = members.length;
    renderMembers(members);
    heatScaleLabelEl.textContent = '가능 1명 → ' + total + '명';

    buildGrid(heatGridEl, function (cell, id) {
      var count = 0;
      members.forEach(function (m) { if (m.slots[id]) count++; });
      cell.dataset.count = String(count);
      if (total >= 2 && count === total) {
        cell.classList.add('all');
      } else if (count > 0) {
        // 비율이 높을수록 진하게. 0명은 흰색 그대로 둔다.
        var alpha = 0.12 + 0.73 * (count / total);
        cell.style.background = 'rgba(47, 125, 91, ' + alpha.toFixed(3) + ')';
      }
      cell.setAttribute('aria-label', cell.getAttribute('aria-label') + ', 가능 ' + count + '/' + total + '명');
    });
    resetHeatDetail();
  }

  heatGridEl.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var cell = e.target.closest ? e.target.closest('.cell') : null;
    if (cell) showHeatDetail(cell);
  });

  heatGridEl.addEventListener('click', function (e) {
    var cell = e.target.closest ? e.target.closest('.cell') : null;
    if (cell) showHeatDetail(cell);
  });

  // ---- 고정 시간 편집 모드 ----
  // 같은 격자를 재사용한다. 편집 중에는 weekFixed가 고정 시간 본체(state.fixed)를 가리킨다.

  function setEditingFixed(on) {
    endDrag();
    editingFixed = on;
    fixedToggleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    fixedBannerEl.hidden = !on;
    mineHintEl.hidden = on;
    mineLegendEl.hidden = on;
    fixedStatusEl.hidden = true;
    clearShareOutput();
    // 고정 시간은 특정 주와 상관없으므로 편집 중에는 주 이동과 코드 복사를 막는다.
    weekPrevBtn.disabled = on;
    weekNextBtn.disabled = on;
    copyBtn.disabled = on;
    if (on) {
      weekFixed = stringSet(state.fixed);
      renderGrid();
      todayBtn.disabled = true;
      return;
    }
    loadWeek();
    render();
    var key = currentWeekKey();
    if (hasInput(key) && !sameList(fixedListFor(key), state.fixed)) {
      fixedStatusEl.textContent = '이 주는 이미 입력한 주라서 바뀐 고정 시간이 적용되지 않습니다. 아직 입력하지 않은 주부터 적용됩니다.';
      fixedStatusEl.hidden = false;
    }
  }

  function sameList(a, b) {
    return sortSlots(a).join(',') === sortSlots(b).join(',');
  }

  fixedToggleBtn.addEventListener('click', function () {
    setEditingFixed(!editingFixed);
  });
  fixedDoneBtn.addEventListener('click', function () {
    setEditingFixed(false);
  });

  // ---- 화면 전환 (탭) ----

  function showScreen(which) {
    var team = which === 'team';
    if (team && editingFixed) setEditingFixed(false);
    tabMine.setAttribute('aria-selected', team ? 'false' : 'true');
    tabTeam.setAttribute('aria-selected', team ? 'true' : 'false');
    screenMine.hidden = team;
    screenTeam.hidden = !team;
    if (team) renderTeam();
  }

  tabMine.addEventListener('click', function () { showScreen('mine'); });
  tabTeam.addEventListener('click', function () { showScreen('team'); });

  // ---- 주 이동 ----

  function goToWeek(monday) {
    endDrag();
    clearShareOutput();
    showPasteResults([]);
    fixedStatusEl.hidden = true;
    currentMonday = monday;
    loadWeek();
    render();
  }

  weekPrevBtn.addEventListener('click', function () {
    goToWeek(addDays(currentMonday, -7));
  });
  weekNextBtn.addEventListener('click', function () {
    goToWeek(addDays(currentMonday, 7));
  });
  todayBtn.addEventListener('click', function () {
    goToWeek(mondayOf(new Date()));
  });

  loadWeek();
  render();
})();

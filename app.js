import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBJlnKimQjeCwzgoxaJpyDA2zronUQNQAI",
  authDomain: "schedule-help.firebaseapp.com",
  projectId: "schedule-help",
  storageBucket: "schedule-help.firebasestorage.app",
  messagingSenderId: "131202591104",
  appId: "1:131202591104:web:1ec24f47b59f3d2edfb965"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State
let currentSemester = "1";
let fullData = [];
let headerRow = [];
let teachers = [];

// Local Storage State
let localState = {
  appPassword: "",
  semester1: { selectedTeachers: [], exclusions: {} },
  semester2: { selectedTeachers: [], exclusions: {} }
};

// Elements
const authOverlay = document.getElementById("auth-overlay");
const mainApp = document.getElementById("main-app");
const appPwdInput = document.getElementById("app-password");
const btnLogin = document.getElementById("btn-login");
const authError = document.getElementById("auth-error");

const semesterSelect = document.getElementById("semester-select");
const navItems = document.querySelectorAll(".nav-item");
const tabPanes = document.querySelectorAll(".tab-pane");

// Initialize App
async function init() {
  loadLocalState();
  
  if (localState.appPassword === "2026") {
    authOverlay.classList.add("hidden");
    mainApp.classList.remove("hidden");
    await loadDataForSemester();
  }

  setupEventListeners();
}

function loadLocalState() {
  const saved = localStorage.getItem("timetableAppState");
  if (saved) {
    try {
      localState = { ...localState, ...JSON.parse(saved) };
    } catch (e) {
      console.error(e);
    }
  }
}

function saveLocalState() {
  localStorage.setItem("timetableAppState", JSON.stringify(localState));
}

// Authentication
btnLogin.addEventListener("click", () => {
  if (appPwdInput.value === "2026") {
    localState.appPassword = "2026";
    saveLocalState();
    authError.classList.add("hidden");
    authOverlay.classList.add("hidden");
    mainApp.classList.remove("hidden");
    loadDataForSemester();
  } else {
    authError.classList.remove("hidden");
  }
});

appPwdInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") btnLogin.click();
});

// Reset Local Settings
document.getElementById("btn-reset-local").addEventListener("click", () => {
  if (confirm("개인 설정(선택된 교사, 교체 불가 설정)을 초기화하시겠습니까?")) {
    localState.semester1 = { selectedTeachers: [], exclusions: {} };
    localState.semester2 = { selectedTeachers: [], exclusions: {} };
    saveLocalState();
    alert("초기화되었습니다.");
    location.reload();
  }
});

// Navigation
navItems.forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    navItems.forEach(nav => nav.classList.remove("active"));
    item.classList.add("active");
    
    tabPanes.forEach(pane => pane.classList.add("hidden"));
    document.getElementById(item.dataset.target).classList.remove("hidden");
  });
});

// Semester Change
semesterSelect.addEventListener("change", async (e) => {
  currentSemester = e.target.value;
  document.querySelectorAll(".current-semester-text").forEach(el => el.textContent = `${currentSemester}학기`);
  await loadDataForSemester();
});

// Data Loading
async function loadDataForSemester() {
  const tableSwap = document.getElementById("table-swap");
  const tableCover = document.getElementById("table-cover");
  const loadingHtml = `<div class="text-center py-5 text-muted">데이터를 불러오는 중입니다...</div>`;
  tableSwap.innerHTML = loadingHtml;
  tableCover.innerHTML = loadingHtml;

  try {
    const docRef = doc(db, `semester_${currentSemester}`, "timetable");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data().data;
      if (data && data.length > 0) {
        processRawData(data);
        renderTimetables();
        renderMeetingTab();
        renderExclusionTab();
      } else {
        showNoData();
      }
    } else {
      showNoData();
    }
  } catch (error) {
    console.error("Error loading data:", error);
    tableSwap.innerHTML = `<div class="text-center py-5 text-danger">오류가 발생했습니다: ${error.message}</div>`;
  }
}

function showNoData() {
  const emptyHtml = `<div class="text-center py-5 text-muted">저장된 시간표 데이터가 없습니다. 관리자 탭에서 데이터를 업로드하세요.</div>`;
  document.getElementById("table-swap").innerHTML = emptyHtml;
  document.getElementById("table-cover").innerHTML = emptyHtml;
  fullData = [];
  headerRow = [];
  teachers = [];
}

function processRawData(rawData) {
  let hasPeriodRow = rawData.length > 1 && rawData[1].some(v => String(v).trim() === "1" || String(v).trim() === "2");
  if (hasPeriodRow) {
    let dayRow = rawData[0];
    let periodRow = rawData[1];
    let newHeader = [dayRow[0] || '교사'];
    let currentDay = "";
    for (let j = 1; j < dayRow.length; j++) {
      let dVal = String(dayRow[j]).trim().replace(/[0-9]/g, '');
      if (dVal !== "") currentDay = dVal;
      newHeader.push(`${currentDay}${String(periodRow[j]).trim()}`);
    }
    rawData.splice(0, 2, newHeader);
  } else {
    let header = rawData[0];
    let currentDay = "";
    let pCount = 1;
    for (let j = 1; j < header.length; j++) {
      let val = String(header[j]).trim();
      if (val !== "") {
        currentDay = val.replace(/[0-9]/g, '').trim();
        pCount = 1;
      } else { pCount++; }
      header[j] = `${currentDay}${pCount}`;
    }
  }

  fullData = rawData;
  headerRow = fullData[0];
  teachers = fullData.slice(1).map(row => row[0]).filter(name => name);
}

// Utils
function isFree(val) {
  if (!val) return true;
  let v = String(val).trim().toLowerCase();
  return v === "" || v === "×" || v === "x";
}

function formatSubject(val) {
  if (!val) return "";
  let str = String(val).trim();
  let match = str.match(/^(\d+)\s*(.+)$/);
  if (match) {
    return `${match[1]}<br>${match[2]}`;
  }
  return str;
}

function isExcluded(teacherName, colIndex) {
  const exclusions = localState[`semester${currentSemester}`].exclusions;
  return exclusions[teacherName] && exclusions[teacherName].includes(colIndex);
}

// Render Timetables
function renderTimetables() {
  document.getElementById("table-swap").innerHTML = generateTableHtml("analyzeSwap");
  document.getElementById("table-cover").innerHTML = generateTableHtml("analyzeCover");
  
  // Search listeners
  document.getElementById("search-swap").addEventListener("input", (e) => highlightRow("table-swap", e.target.value));
  document.getElementById("search-cover").addEventListener("input", (e) => highlightRow("table-cover", e.target.value));
}

function highlightRow(containerId, kw) {
  kw = kw.trim();
  document.querySelectorAll(`#${containerId} tbody tr`).forEach(tr => {
    let nameTd = tr.querySelector('td:first-child');
    if (kw !== "" && nameTd.innerText.includes(kw)) {
      tr.classList.add("my-row-highlight");
      tr.style.backgroundColor = "rgba(255, 193, 7, 0.2)";
    } else {
      tr.classList.remove("my-row-highlight");
      tr.style.backgroundColor = "";
    }
  });
}

function generateTableHtml(actionFunc) {
  if (fullData.length === 0) return "";
  
  let html = `<table class="table"><thead><tr>`;
  let dayClasses = [];

  for (let j = 0; j < headerRow.length; j++) {
    let hStr = headerRow[j];
    let dCls = hStr.includes("월") ? "day-mon" : hStr.includes("화") ? "day-tue" :
               hStr.includes("수") ? "day-wed" : hStr.includes("목") ? "day-thu" :
               hStr.includes("금") ? "day-fri" : "";
    let bCls = (j > 0 && j < headerRow.length - 1 && hStr.replace(/[0-9]/g, '') !== headerRow[j+1].replace(/[0-9]/g, '')) ? "day-border" : (j === headerRow.length -1 ? "day-border" : "");
    dayClasses[j] = `${dCls} ${bCls}`;
    html += `<th class="${dayClasses[j]}">${hStr}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (let i = 1; i < fullData.length; i++) {
    html += `<tr>`;
    for (let j = 0; j < fullData[i].length; j++) {
      let val = fullData[i][j];
      if (j === 0) {
        html += `<td class="text-nowrap" style="white-space:nowrap;">${val}</td>`;
      } else {
        let extraClass = isExcluded(fullData[i][0], j) ? "is-excluded" : "is-clickable";
        let displayVal = isFree(val) ? "" : formatSubject(val);
        html += `<td class="${dayClasses[j]} ${extraClass}" data-action="${actionFunc}" data-row="${i}" data-col="${j}">${displayVal}</td>`;
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

// Delegate events for table cells
document.addEventListener("click", (e) => {
  let td = e.target.closest("td[data-action]");
  if (td) {
    let action = td.dataset.action;
    let row = parseInt(td.dataset.row);
    let col = parseInt(td.dataset.col);
    if (action === "analyzeSwap") analyzeSwap(row, col, td);
    if (action === "analyzeCover") analyzeCover(row, col, td);
  }
});

window.analyzeSwap = analyzeSwap;
window.analyzeCover = analyzeCover;

function analyzeSwap(row, col, tdEl) {
  const rawSubject = fullData[row][col];
  if (isFree(rawSubject) || isExcluded(fullData[row][0], col)) return;

  document.querySelectorAll('#table-swap td').forEach(td => td.classList.remove('is-selected', 'is-partner'));
  tdEl.classList.add('is-selected');

  const myName = fullData[row][0];
  const myPeriod = headerRow[col];
  const classIdMatch = rawSubject.match(/^\d+/);
  const searchTarget = classIdMatch ? classIdMatch[0] : rawSubject.trim();
  
  const partners = [];
  for (let r = 1; r < fullData.length; r++) {
    if (r === row) continue;
    const pName = fullData[r][0];
    if (!isFree(fullData[r][col]) || isExcluded(pName, col)) continue;
    
    for (let c = 1; c < fullData[r].length; c++) {
      const pSubject = fullData[r][c];
      if (!isFree(pSubject) && pSubject.includes(searchTarget) && isFree(fullData[row][c])) {
        partners.push({ name: pName, pPeriod: headerRow[c], pSubject: pSubject, pRow: r, pCol: c });
        const partnerTd = document.querySelector(`#table-swap td[data-row="${r}"][data-col="${c}"]`);
        if(partnerTd) partnerTd.classList.add('is-partner');
      }
    }
  }
  showModal(myName, myPeriod, rawSubject, partners, row, col, 'swap');
}

function analyzeCover(row, col, tdEl) {
  const rawSubject = fullData[row][col];
  if (isFree(rawSubject) || isExcluded(fullData[row][0], col)) return;

  document.querySelectorAll('#table-cover td').forEach(td => td.classList.remove('is-selected', 'is-partner'));
  tdEl.classList.add('is-selected');

  const myName = fullData[row][0];
  const myPeriod = headerRow[col];
  const partners = [];
  
  for (let r = 1; r < fullData.length; r++) {
    if (r === row) continue;
    if (isFree(fullData[r][col]) && !isExcluded(fullData[r][0], col)) {
      partners.push({ name: fullData[r][0], pRow: r, pCol: col });
      const partnerTd = document.querySelector(`#table-cover td[data-row="${r}"][data-col="${col}"]`);
      if(partnerTd) partnerTd.classList.add('is-partner');
    }
  }
  showModal(myName, myPeriod, rawSubject, partners, row, col, 'cover');
}

function showModal(myName, myPeriod, rawSubject, partners, row, col, mode) {
  const modal = document.getElementById("result-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");

  modalTitle.innerHTML = mode === 'swap' ? `<i class="bi bi-arrow-left-right text-success"></i> 수업 교체 매칭 결과` : `<i class="bi bi-person-plus-fill text-info"></i> 대강 매칭 결과`;
  
  if (partners.length === 0) {
    modalBody.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-emoji-frown fs-1 d-block mb-3"></i> 가능한 선생님이 없습니다.</div>`;
  } else {
    let html = `<div class="d-flex" style="flex-direction:column; gap:1rem;">`;
    partners.forEach(p => {
      let summary = "";
      if (mode === 'swap') {
        summary = `
          <div class="glass-panel" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
            <h4 class="text-primary mb-2"><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님과 교체 가능</h4>
            <div class="text-center font-bold" style="font-size: 1.1rem;">
              나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ↔ ${p.name}T의 <span class="text-primary">${p.pPeriod} [${p.pSubject}]</span>
            </div>
          </div>
        `;
      } else {
        summary = `
          <div class="glass-panel" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
            <h4 class="text-primary mb-2"><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님</h4>
            <div class="text-center font-bold" style="font-size: 1.1rem;">
              나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ↔ <span class="text-primary">${p.name} 선생님</span>께 대강 요청
            </div>
          </div>
        `;
      }
      html += summary;
    });
    html += `</div>`;
    modalBody.innerHTML = html;
  }
  
  modal.classList.remove("hidden");
}

document.getElementById("btn-close-modal").addEventListener("click", () => {
  document.getElementById("result-modal").classList.add("hidden");
});

// Admin Features
const btnAdminLogin = document.getElementById("btn-admin-login");
const adminPwdInput = document.getElementById("admin-password-input");
const adminError = document.getElementById("admin-error");
const adminAuthArea = document.getElementById("admin-auth-area");
const adminDashboard = document.getElementById("admin-dashboard");

btnAdminLogin.addEventListener("click", async () => {
  const pwd = adminPwdInput.value;
  try {
    const docRef = doc(db, "settings", "admin");
    let docSnap = await getDoc(docRef);
    let realPwd = "admin";
    if (docSnap.exists()) {
      realPwd = docSnap.data().password;
    } else {
      await setDoc(docRef, { password: "admin" });
    }
    
    if (pwd === realPwd) {
      adminAuthArea.classList.add("hidden");
      adminDashboard.classList.remove("hidden");
      adminError.classList.add("hidden");
    } else {
      adminError.classList.remove("hidden");
    }
  } catch(e) {
    console.error(e);
    alert("오류 발생: " + e.message);
  }
});

// Change Admin Password
document.getElementById("btn-change-admin-pwd").addEventListener("click", async () => {
  const newPwd = document.getElementById("new-admin-password").value;
  if (!newPwd) return alert("비밀번호를 입력하세요.");
  try {
    await setDoc(doc(db, "settings", "admin"), { password: newPwd });
    alert("관리자 비밀번호가 변경되었습니다.");
    document.getElementById("new-admin-password").value = "";
  } catch(e) {
    alert("오류: " + e.message);
  }
});

// Excel Upload
document.getElementById("btn-upload-excel").addEventListener("click", () => {
  const fileInput = document.getElementById("excel-upload");
  if (!fileInput.files.length) return alert("파일을 선택하세요.");
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      
      // Clean names
      const processed = json.map((row, i) => 
        row.map((cell, j) => {
          let val = String(cell).trim();
          if (j === 0 && i > 0) val = val.replace(/\([^)]*\)/g, '').trim();
          return val;
        })
      );
      
      await setDoc(doc(db, `semester_${currentSemester}`, "timetable"), {
        data: processed,
        updatedAt: new Date().toISOString()
      });
      
      alert(`데이터가 ${currentSemester}학기에 성공적으로 업로드되었습니다!`);
      location.reload();
    } catch(err) {
      alert("엑셀 처리 오류: " + err.message);
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
});

// Delete Data
document.getElementById("btn-delete-all-data").addEventListener("click", async () => {
  if(confirm(`정말로 ${currentSemester}학기 데이터를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
    try {
      await deleteDoc(doc(db, `semester_${currentSemester}`, "timetable"));
      alert("삭제되었습니다.");
      location.reload();
    } catch(e) {
      alert("오류: " + e.message);
    }
  }
});

// Meeting Tab
function renderMeetingTab() {
  const clContainer = document.getElementById("meeting-teacher-checklist");
  const selected = localState[`semester${currentSemester}`].selectedTeachers || [];
  
  let html = "";
  teachers.forEach((t, i) => {
    let isChecked = selected.includes(t) ? "checked" : "";
    html += `
      <div class="d-flex align-center gap-2 mb-2 p-1 teacher-chk-item" style="background: rgba(255,255,255,0.6); border-radius: 4px;">
        <input type="checkbox" id="chk-${i}" value="${t}" class="chk-teacher" ${isChecked}>
        <label for="chk-${i}" class="w-100 is-clickable">${t}</label>
      </div>
    `;
  });
  clContainer.innerHTML = html;

  document.querySelectorAll(".chk-teacher").forEach(chk => {
    chk.addEventListener("change", () => {
      const selectedNow = Array.from(document.querySelectorAll(".chk-teacher:checked")).map(c => c.value);
      localState[`semester${currentSemester}`].selectedTeachers = selectedNow;
      saveLocalState();
      updateMeetingTimetable(selectedNow);
    });
  });

  document.getElementById("search-meeting-teacher").addEventListener("input", (e) => {
    const kw = e.target.value.trim();
    document.querySelectorAll(".teacher-chk-item").forEach(div => {
      div.style.display = div.innerText.includes(kw) ? "flex" : "none";
    });
  });

  if (selected.length > 0) updateMeetingTimetable(selected);
}

document.getElementById("btn-clear-meeting").addEventListener("click", () => {
  document.querySelectorAll(".chk-teacher").forEach(chk => chk.checked = false);
  localState[`semester${currentSemester}`].selectedTeachers = [];
  saveLocalState();
  updateMeetingTimetable([]);
});

function updateMeetingTimetable(selected) {
  const area = document.getElementById("meeting-timetable-area");
  if (selected.length === 0) {
    area.innerHTML = `<div class="text-center py-3 text-muted">교사를 선택해주세요.</div>`;
    return;
  }
  
  let html = `<table class="table" style="font-size: 0.7rem; min-width:600px;"><thead><tr>`;
  headerRow.forEach((h, j) => {
    html += `<th>${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  selected.forEach(s => {
    let r = fullData.findIndex(row => row[0] === s);
    if (r > -1) {
      html += `<tr>`;
      fullData[r].forEach((val, j) => {
        let dVal = isFree(val) ? "" : formatSubject(val);
        html += `<td class="${j===0?'font-bold':''}">${dVal}</td>`;
      });
      html += `</tr>`;
    }
  });
  html += `</tbody></table>`;
  area.innerHTML = html;
}

document.getElementById("btn-find-meeting").addEventListener("click", () => {
  const selected = localState[`semester${currentSemester}`].selectedTeachers || [];
  const resultDiv = document.getElementById("meeting-result-area");
  
  if (selected.length < 2) {
    resultDiv.innerHTML = `<div class="text-danger p-3 text-center">교사를 2명 이상 선택하세요.</div>`;
    return;
  }

  let available = [];
  let reasonsHtml = `<div class="mt-3"><h4 class="text-danger mb-2">불가 사유 안내 (수업자)</h4><ul class="text-sm">`;
  let hasReasons = false;

  for (let c = 1; c < headerRow.length; c++) {
    let busy = selected.filter(s => {
      let r = fullData.findIndex(row => row[0] === s);
      return !isFree(fullData[r][c]);
    });
    if (busy.length === 0) {
      available.push(headerRow[c]);
    } else {
      reasonsHtml += `<li><b>${headerRow[c]}</b> : ${busy.join(', ')}</li>`;
      hasReasons = true;
    }
  }
  reasonsHtml += `</ul></div>`;

  if (available.length === 0) {
    resultDiv.innerHTML = `<div class="text-danger text-center p-3 font-bold">모두 공강인 시간이 없습니다.</div>` + (hasReasons ? reasonsHtml : "");
  } else {
    resultDiv.innerHTML = `
      <div id="copyArea" class="glass-panel" style="background: rgba(25, 135, 84, 0.1); border-color: var(--success-color);">
        <div class="font-bold text-success mb-2">✅ 협의회 가능 시간 안내</div>
        <div>▪ <b>참석자:</b> ${selected.join(', ')}</div>
        <div class="mt-1">▪ <b>가능 시간:</b> <span class="text-primary font-bold">${available.join(', ')}</span></div>
      </div>
    ` + (hasReasons ? reasonsHtml : "");
  }
});

document.getElementById("btn-copy-meeting").addEventListener("click", () => {
  const area = document.getElementById("copyArea");
  if (area) {
    navigator.clipboard.writeText(area.innerText).then(() => alert("복사 완료!"));
  } else {
    alert("결과가 없습니다.");
  }
});

// Exclusion Tab
function renderExclusionTab() {
  const select = document.getElementById("exclusion-teacher-select");
  let html = `<option value="">-- 대상 교사 선택 --</option>`;
  teachers.forEach(t => html += `<option value="${t}">${t}</option>`);
  select.innerHTML = html;
  updateExclusionSummary();
}

document.getElementById("exclusion-teacher-select").addEventListener("change", (e) => {
  const tName = e.target.value;
  const gridArea = document.getElementById("exclusion-grid-area");
  const dayBtns = document.getElementById("exclusion-day-buttons");
  
  if (!tName) {
    gridArea.innerHTML = `<div class="text-center py-4 text-muted">교사를 먼저 선택해 주세요.</div>`;
    dayBtns.classList.add("hidden");
    return;
  }
  
  dayBtns.classList.remove("hidden");
  let exclusions = localState[`semester${currentSemester}`].exclusions;
  if (!exclusions[tName]) exclusions[tName] = [];
  
  // Render day buttons
  let uniqueDays = [...new Set(headerRow.slice(1).map(h => h.replace(/[0-9]/g, '').trim()))].filter(Boolean);
  let btnHtml = `<span class="text-sm font-bold align-center d-flex">요일 전체 선택: </span>`;
  uniqueDays.forEach(day => {
    btnHtml += `<button class="btn btn-outline-secondary btn-sm" onclick="toggleDayExclusion('${tName}', '${day}')">${day}</button>`;
  });
  dayBtns.innerHTML = btnHtml;

  renderExclusionGrid(tName);
});

window.toggleDayExclusion = (teacher, dayStr) => {
  let exclusions = localState[`semester${currentSemester}`].exclusions;
  let dayCols = headerRow.reduce((acc, h, i) => { if(h.includes(dayStr)) acc.push(i); return acc; }, []);
  let allExcluded = dayCols.every(c => exclusions[teacher].includes(c));
  
  if (allExcluded) {
    exclusions[teacher] = exclusions[teacher].filter(c => !dayCols.includes(c));
  } else {
    dayCols.forEach(c => { if (!exclusions[teacher].includes(c)) exclusions[teacher].push(c); });
  }
  saveLocalState();
  renderExclusionGrid(teacher);
  updateExclusionSummary();
};

window.toggleExclusionCell = (teacher, colIndex) => {
  let exclusions = localState[`semester${currentSemester}`].exclusions;
  let idx = exclusions[teacher].indexOf(colIndex);
  if (idx > -1) exclusions[teacher].splice(idx, 1);
  else exclusions[teacher].push(colIndex);
  
  saveLocalState();
  renderExclusionGrid(teacher);
  updateExclusionSummary();
};

function renderExclusionGrid(tName) {
  const gridArea = document.getElementById("exclusion-grid-area");
  let exclusions = localState[`semester${currentSemester}`].exclusions;
  let r = fullData.findIndex(row => row[0] === tName);
  
  let html = `<table class="table" style="min-width: 600px;"><thead><tr>`;
  headerRow.slice(1).forEach(h => html += `<th>${h}</th>`);
  html += `</tr></thead><tbody><tr>`;
  
  for (let c = 1; c < fullData[r].length; c++) {
    let isEx = exclusions[tName].includes(c);
    let val = isFree(fullData[r][c]) ? "공강" : formatSubject(fullData[r][c]);
    let cls = isEx ? 'is-excluded' : '';
    html += `<td class="is-clickable ${cls}" style="border:1px solid rgba(0,0,0,0.1);" onclick="toggleExclusionCell('${tName}', ${c})">${val}</td>`;
  }
  html += `</tr></tbody></table>`;
  gridArea.innerHTML = html;
  
  // Re-render timetables to reflect exclusion styles
  renderTimetables();
}

function updateExclusionSummary() {
  const sumArea = document.getElementById("exclusion-summary");
  let exclusions = localState[`semester${currentSemester}`].exclusions;
  let count = 0;
  let html = `<h4 class="mb-2 font-bold"><i class="bi bi-list-check"></i> 설정된 내역 (자동 저장됨)</h4>`;
  
  for (let t in exclusions) {
    if (exclusions[t] && exclusions[t].length > 0) {
      html += `<div class="mb-1"><span class="btn btn-danger btn-sm p-1" style="font-size:0.7rem;">${t}</span> : ${exclusions[t].sort((a,b) => a - b).map(c => headerRow[c]).join(', ')}</div>`;
      count++;
    }
  }
  
  sumArea.innerHTML = count === 0 ? `<div class="text-muted">설정된 교체 불가 내역이 없습니다.</div>` : html;
}

document.getElementById("btn-clear-all-exclusions").addEventListener("click", () => {
  if (confirm("이 기기의 교체 불가 설정을 모두 초기화하시겠습니까?")) {
    localState[`semester${currentSemester}`].exclusions = {};
    saveLocalState();
    const tName = document.getElementById("exclusion-teacher-select").value;
    if (tName) renderExclusionGrid(tName);
    updateExclusionSummary();
    renderTimetables();
  }
});

// Download Excel Template
document.getElementById("btn-download-template").addEventListener("click", () => {
  const ws_data = [
    ["교사", "1", "2", "3", "4", "5", "6", "7", "1", "2", "3", "4", "5", "6", "7"],
    ["", "월", "월", "월", "월", "월", "월", "월", "화", "화", "화", "화", "화", "화", "화"],
    ["홍길동", "101 국어", "102 국어", "", "103 국어", "", "", "", "", "101 국어", "102 국어", "", "103 국어", "", ""]
  ];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "시간표양식");
  XLSX.writeFile(wb, "수업교체시간표_양식.xlsx");
});

init();

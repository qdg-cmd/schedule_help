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
  semester1: { selectedTeachers: [], exclusions: {}, cart: [] },
  semester2: { selectedTeachers: [], exclusions: {}, cart: [] },
  semesterCutoff: "08-10"
};

// Elements
const authOverlay = document.getElementById("auth-overlay");
const mainApp = document.getElementById("main-app");
const appPwdInput = document.getElementById("app-password");
const btnLogin = document.getElementById("btn-login");
const authError = document.getElementById("auth-error");

const modal = document.getElementById("result-modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const btnCloseModal = document.getElementById("btn-close-modal");
const adminPwdInput = document.getElementById("admin-password-input");
const btnAdminLogin = document.getElementById("btn-admin-login");
const cutoffInput = document.getElementById("semester-cutoff-date");
const btnSaveCutoff = document.getElementById("btn-save-cutoff");

// Navigation
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    if(item.classList.contains('admin-nav')) return; 
    document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.add("hidden"));
    item.classList.add("active");
    const target = document.getElementById(item.getAttribute("data-target"));
    if (target) target.classList.remove("hidden");
  });
});

document.querySelector(".admin-nav").addEventListener("click", (e) => {
  e.preventDefault();
  document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.add("hidden"));
  document.querySelector(".admin-nav").classList.add("active");
  document.getElementById("tab-admin").classList.remove("hidden");
  
  if (!sessionStorage.getItem("adminAuth")) {
    document.getElementById("admin-auth-area").classList.remove("hidden");
    document.getElementById("admin-dashboard").classList.add("hidden");
  } else {
    document.getElementById("admin-auth-area").classList.add("hidden");
    document.getElementById("admin-dashboard").classList.remove("hidden");
  }
});

// Initialize App
async function init() {
  const saved = localStorage.getItem("timetableAppState");
  if (saved) {
    try {
      let parsed = JSON.parse(saved);
      if (!parsed.semester1.cart) parsed.semester1.cart = [];
      if (!parsed.semester2.cart) parsed.semester2.cart = [];
      if (!parsed.semesterCutoff) parsed.semesterCutoff = "08-10";
      localState = { ...localState, ...parsed };
    } catch (e) {
      console.error(e);
    }
  }
  
  if (cutoffInput) cutoffInput.value = localState.semesterCutoff;
  autoSelectSemester();
  
  if (localState.appPassword === "2026") {
    authOverlay.classList.add("hidden");
    mainApp.classList.remove("hidden");
    await loadDataForSemester();
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
  if (confirm("개인 설정(선택된 교사, 교체 불가 설정, 결보강 장바구니)을 초기화하시겠습니까?")) {
    localState.semester1 = { selectedTeachers: [], exclusions: {}, cart: [] };
    localState.semester2 = { selectedTeachers: [], exclusions: {}, cart: [] };
    saveLocalState();
    alert("초기화되었습니다.");
    location.reload();
  }
});

// Semester Change
const semesterSelect = document.getElementById("semester-select");
if (semesterSelect) {
  semesterSelect.addEventListener("change", async (e) => {
    currentSemester = parseInt(e.target.value);
    await loadDataForSemester();
  });
}

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
      let data = docSnap.data().data;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      if (data && data.length > 0) {
        processRawData(data);
        renderTimetables();
        renderMeetingTab();
        renderExclusionTab();
        renderCartTab();
      } else {
        showNoData();
      }
    } else {
      showNoData();
    }
  } catch(e) {
    console.error(e);
    showNoData();
  }
}

function autoSelectSemester() {
  const today = new Date();
  const year = today.getFullYear();
  let cutoff = localState.semesterCutoff || "08-10";
  let parts = cutoff.split("-");
  let cutoffMonth = parseInt(parts[0], 10) - 1;
  let cutoffDate = parseInt(parts[1], 10);
  
  const cutoffTime = new Date(year, cutoffMonth, cutoffDate).getTime();
  const currentTime = today.getTime();
  
  if (currentTime >= cutoffTime) {
    currentSemester = 2;
  } else {
    currentSemester = 1;
  }
  
  const semesterSelect = document.getElementById("semester-select");
  if (semesterSelect) {
    semesterSelect.value = currentSemester.toString();
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
  
  const searchSwap = document.getElementById("search-swap");
  const searchCover = document.getElementById("search-cover");
  
  searchSwap.addEventListener("input", (e) => highlightRow("table-swap", e.target.value));
  searchCover.addEventListener("input", (e) => highlightRow("table-cover", e.target.value));
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

function analyzeSwap(row, col, tdEl) {
  const rawSubject = fullData[row][col];
  if (isFree(rawSubject) || isExcluded(fullData[row][0], col)) return;

  const myName = fullData[row][0];
  const myPeriod = headerRow[col];
  const strSubject = String(rawSubject);
  const classIdMatch = strSubject.match(/^\d+/);
  const searchTarget = classIdMatch ? classIdMatch[0] : strSubject.trim();
  
  const partners = [];
  for (let r = 1; r < fullData.length; r++) {
    if (r === row) continue;
    const pName = fullData[r][0];
    if (!isFree(fullData[r][col]) || isExcluded(pName, col)) continue;
    
    for (let c = 1; c < fullData[r].length; c++) {
      const pSubject = fullData[r][c];
      const strPSubject = String(pSubject);
      if (!isFree(strPSubject) && strPSubject.includes(searchTarget) && isFree(fullData[row][c])) {
        partners.push({ name: pName, pPeriod: headerRow[c], pSubject: pSubject, pRow: r, pCol: c });
      }
    }
  }
  showModal("수업 교체 매칭 결과", partners, 'swap', myName, myPeriod, rawSubject);
}

function analyzeCover(row, col, tdEl) {
  const rawSubject = fullData[row][col];
  if (isFree(rawSubject) || isExcluded(fullData[row][0], col)) return;

  const myName = fullData[row][0];
  const myPeriod = headerRow[col];
  const partners = [];
  
  for (let r = 1; r < fullData.length; r++) {
    if (r === row) continue;
    if (isFree(fullData[r][col]) && !isExcluded(fullData[r][0], col)) {
      partners.push({ name: fullData[r][0], pRow: r, pCol: col });
    }
  }
  showModal("대강 매칭 결과", partners, 'cover', myName, myPeriod, rawSubject);
}

function showModal(title, partners, mode, myName, myPeriod, rawSubject) {
  modalTitle.textContent = title;
  
  if (partners.length === 0) {
    modalBody.innerHTML = `<div class="text-center text-muted py-4">가능한 교사가 없습니다.</div>`;
    modal.classList.remove("hidden");
    return;
  }
  
  let html = `<div class="d-flex flex-column gap-3">`;
  partners.forEach((p, idx) => {
    let summary = '';
    let previewTable = '';
    if (mode === 'swap') {
      summary = `
        <div class="glass-panel mb-2" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
          <h4 class="text-primary mb-2 d-flex justify-between align-center">
            <span><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님과 교체 가능</span>
            <button class="btn btn-sm btn-outline-primary btn-add-cart" data-type="swap" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" data-pname="${p.name}" data-pperiod="${p.pPeriod}" data-psubj="${p.pSubject}">장바구니 담기</button>
          </h4>
          <div class="text-center font-bold" style="font-size: 1.1rem;">
            나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ↔ ${p.name}T의 <span class="text-primary">${p.pPeriod} [${p.pSubject}]</span>
          </div>
        </div>
      `;
      previewTable = buildPreviewTableSwap(myName, p.name, row, col, p.pRow, p.pCol, rawSubject, p.pSubject);
    } else {
      summary = `
        <div class="glass-panel mb-2" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
          <h4 class="text-primary mb-2 d-flex justify-between align-center">
            <span><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님</span>
            <button class="btn btn-sm btn-outline-info btn-add-cart" data-type="cover" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" data-pname="${p.name}" data-pperiod="" data-psubj="">장바구니 담기</button>
          </h4>
          <div class="text-center font-bold" style="font-size: 1.1rem;">
            나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ↔ <span class="text-primary">${p.name} 선생님</span>께 대강 요청
          </div>
        </div>
      `;
      previewTable = buildPreviewTableCover(myName, p.name, row, p.pRow, col, rawSubject);
    }
    html += `<div class="mb-4 border-bottom pb-3">${summary}${previewTable}</div>`;
  });
  html += `</div>`;
  modalBody.innerHTML = html;
  
  modalBody.querySelectorAll(".btn-add-cart").forEach(btn => {
    btn.addEventListener("click", () => {
      addToCart(
        btn.dataset.type,
        btn.dataset.myname,
        btn.dataset.myperiod,
        btn.dataset.mysubj,
        btn.dataset.pname,
        btn.dataset.pperiod,
        btn.dataset.psubj
      );
    });
  });
  
  modal.classList.remove("hidden");
}

function buildPreviewTableSwap(myName, pName, row, col, pRow, pCol, rawSubject, pSubject) {
  let pt = `<div class="table-responsive"><table class="table table-sm table-bordered text-center align-middle bg-white" style="table-layout: fixed; width: 100%; min-width: 900px; font-size: 0.8rem;">
    <thead class="table-light"><tr><th style="width: 60px;">교사</th>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let thClass = (j === col || j === pCol) ? 'bg-warning text-dark' : '';
    pt += `<th class="${thClass}">${headerRow[j]}</th>`;
  }
  pt += `</tr></thead><tbody><tr><td class="font-bold bg-light">${myName}</td>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let v = isFree(fullData[row][j]) ? "공강" : formatSubject(fullData[row][j]);
    if (j === col) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(rawSubject)}</td>`;
    else if (j === pCol) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">공강</td>`;
    else pt += `<td>${isFree(fullData[row][j]) ? "" : v}</td>`;
  }
  pt += `</tr><tr><td class="font-bold bg-light">${pName}</td>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let v = isFree(fullData[pRow][j]) ? "공강" : formatSubject(fullData[pRow][j]);
    if (j === col) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">공강</td>`;
    else if (j === pCol) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(pSubject)}</td>`;
    else pt += `<td>${isFree(fullData[pRow][j]) ? "" : v}</td>`;
  }
  return pt + `</tr></tbody></table></div>`;
}

function buildPreviewTableCover(myName, pName, row, pRow, col, rawSubject) {
  let pt = `<div class="table-responsive"><table class="table table-sm table-bordered text-center align-middle bg-white" style="table-layout: fixed; width: 100%; min-width: 900px; font-size: 0.8rem;">
    <thead class="table-light"><tr><th style="width: 60px;">교사</th>`;
    
  for(let j = 1; j < headerRow.length; j++) {
    let thClass = (j === col) ? 'bg-warning text-dark' : '';
    pt += `<th class="${thClass}">${headerRow[j]}</th>`;
  }
  pt += `</tr></thead><tbody><tr><td class="font-bold bg-light">${myName}</td>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let v = isFree(fullData[row][j]) ? "" : formatSubject(fullData[row][j]);
    if (j === col) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(rawSubject)}</td>`;
    else pt += `<td>${v}</td>`;
  }
  pt += `</tr><tr><td class="font-bold bg-light">${pName}</td>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let v = isFree(fullData[pRow][j]) ? "" : formatSubject(fullData[pRow][j]);
    if (j === col) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">공강</td>`;
    else pt += `<td>${v}</td>`;
  }
  return pt + `</tr></tbody></table></div>`;
}

btnCloseModal.addEventListener("click", () => {
  modal.classList.add("hidden");
});


// Admin Features
btnAdminLogin.addEventListener("click", async () => {
  const pwd = adminPwdInput.value;
  try {
    const docRef = doc(db, "settings", "admin");
    let docSnap = await getDoc(docRef);
    let realPwd = docSnap.exists() ? docSnap.data().password : "admin";
    
    if (pwd === realPwd) {
      sessionStorage.setItem("adminAuth", "true");
      document.getElementById("admin-auth-area").classList.add("hidden");
      document.getElementById("admin-dashboard").classList.remove("hidden");
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  } catch(e) {
    alert("오류 발생: " + e.message);
  }
});

if (btnSaveCutoff) {
  btnSaveCutoff.addEventListener("click", () => {
    if (cutoffInput.value.trim() === "") return;
    localState.semesterCutoff = cutoffInput.value.trim();
    saveLocalState();
    alert("학기 전환 기준일이 저장되었습니다.");
    autoSelectSemester();
  });
}

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
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      
      await setDoc(doc(db, `semester_${currentSemester}`, "timetable"), {
        data: JSON.stringify(json),
        updatedAt: new Date().toISOString()
      });
      alert("성공적으로 업로드되었습니다!");
      location.reload();
    } catch(err) {
      alert("처리 오류: " + err.message);
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
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
        <label for="chk-${i}" class="w-100 is-clickable teacher-toggle-btn">${t}</label>
      </div>
    `;
  });
  clContainer.innerHTML = html;

  document.querySelectorAll(".chk-teacher").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const selectedNow = Array.from(document.querySelectorAll(".chk-teacher:checked")).map(c => c.value);
      localState[`semester${currentSemester}`].selectedTeachers = selectedNow;
      saveLocalState();
      updateMeetingTimetable(selectedNow);
    });
  });

  document.getElementById("search-meeting-teacher").addEventListener("input", (e) => {
    const kw = e.target.value.trim();
    document.querySelectorAll(".teacher-chk-item").forEach(div => {
      div.style.display = div.innerText.includes(kw) ? "block" : "none";
    });
  });
  
  updateMeetingTimetable(selected);
}

function updateMeetingTimetable(selected) {
  const container = document.getElementById("meeting-timetable-area");
  if (selected.length === 0) {
    container.innerHTML = `<div class="text-center py-3 text-muted">교사를 선택해주세요.</div>`;
    return;
  }
  
  let html = `<div class="table-responsive"><table class="table table-bordered table-sm text-center" style="font-size: 0.8rem; min-width: 1200px;">
    <thead><tr><th style="width: 80px; position: sticky; left: 0; background: #fff; z-index: 2;">교사</th>`;
  for (let c = 1; c < headerRow.length; c++) {
    html += `<th>${headerRow[c]}</th>`;
  }
  html += `</tr></thead><tbody>`;
  
  selected.forEach(tName => {
    let rowIdx = fullData.findIndex(r => r[0] === tName);
    if (rowIdx === -1) return;
    html += `<tr><td class="font-bold bg-light" style="position: sticky; left: 0; z-index: 1;">${tName}</td>`;
    for (let c = 1; c < fullData[rowIdx].length; c++) {
      let isEx = isExcluded(tName, c);
      let isBusy = !isFree(fullData[rowIdx][c]);
      if (isEx) {
        html += `<td style="background:var(--danger-color);color:white;" title="교체불가">불가</td>`;
      } else if (isBusy) {
        html += `<td style="background:var(--secondary-color);color:white;" title="${fullData[rowIdx][c]}">수업</td>`;
      } else {
        html += `<td class="text-muted" style="background:#f8f9fa;">공강</td>`;
      }
    }
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

document.getElementById("btn-clear-meeting").addEventListener("click", () => {
  document.querySelectorAll(".chk-teacher").forEach(chk => {
    chk.checked = false;
  });
  localState[`semester${currentSemester}`].selectedTeachers = [];
  saveLocalState();
  updateMeetingTimetable([]);
  document.getElementById("meeting-result-area").innerHTML = `<div class="text-center py-4 text-muted">교사를 2명 이상 선택한 후 [공강 찾기]를 누르세요.</div>`;
});

document.getElementById("btn-find-meeting").addEventListener("click", () => {
  const selected = localState[`semester${currentSemester}`].selectedTeachers || [];
  const resultDiv = document.getElementById("meeting-result-area");
  
  if (selected.length < 2) {
    resultDiv.innerHTML = `<div class="text-danger p-3 text-center">교사를 2명 이상 선택하세요.</div>`;
    return;
  }

  let available = [];
  let reasonsHtml = `<div class="mt-3"><div class="unavailable-box"><h4 class="text-danger mb-3 font-bold"><i class="bi bi-info-circle"></i> 불가 사유 안내</h4><div class="d-flex flex-column gap-2">`;
  let hasReasons = false;

  for (let c = 1; c < headerRow.length; c++) {
    let busyReasons = [];
    selected.forEach(s => {
      let r = fullData.findIndex(row => row[0] === s);
      if (r === -1) return;
      let isEx = isExcluded(s, c);
      let hasClass = !isFree(fullData[r][c]);
      if (hasClass) busyReasons.push(`<span class="badge bg-secondary">${s} (수업)</span>`);
      if (isEx) busyReasons.push(`<span class="badge bg-danger">${s} (교체불가)</span>`);
    });
    
    if (busyReasons.length === 0) {
      available.push(headerRow[c]);
    } else {
      reasonsHtml += `
        <div class="d-flex align-center gap-3 border-bottom pb-2">
          <div class="font-bold text-danger" style="min-width: 60px;">${headerRow[c]}</div>
          <div class="d-flex flex-wrap gap-1">${busyReasons.join(' ')}</div>
        </div>
      `;
      hasReasons = true;
    }
  }
  reasonsHtml += `</div></div></div>`;

  if (available.length === 0) {
    resultDiv.innerHTML = `<div class="text-danger text-center p-3 font-bold">모두 공강인 시간이 없습니다.</div>` + (hasReasons ? reasonsHtml : "");
  } else {
    resultDiv.innerHTML = `
      <div id="copyArea" class="glass-panel" style="background: rgba(25, 135, 84, 0.1); border-color: var(--success-color);">
        <div class="font-bold text-success mb-2">✅ 협의회 가능 시간 안내</div>
        <div>▪ <b>참석자:</b> ${selected.join(', ')}</div>
        <div class="mt-1">▪ <b>가능 시간:</b> <span class="text-primary font-bold">${available.join(', ')}</span></div>
      </div>
      <button id="btn-copy-meeting" class="btn btn-outline-success mt-2 w-100"><i class="bi bi-clipboard"></i> 결과 복사하기</button>
    ` + (hasReasons ? reasonsHtml : "");
    
    document.getElementById("btn-copy-meeting").addEventListener("click", () => {
      navigator.clipboard.writeText(document.getElementById("copyArea").innerText).then(() => alert("복사 완료!"));
    });
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
  
  renderTimetables();
}

function updateExclusionSummary() {
  const sumArea = document.getElementById("exclusion-summary");
  const selectedTeacher = document.getElementById("exclusion-teacher-select").value;
  
  let summaryHtml = ``;
  if (selectedTeacher) {
    let list = localState[`semester${currentSemester}`].exclusions[selectedTeacher] || [];
    if (list.length === 0) {
      summaryHtml = `<div class="text-muted">${selectedTeacher} 선생님은 설정된 교체 불가 시간이 없습니다.</div>`;
    } else {
      summaryHtml = `<div class="text-primary font-bold mb-2">${selectedTeacher} 교체 불가 내역:</div><div class="d-flex flex-wrap gap-2">`;
      list.forEach(c => {
        summaryHtml += `<span class="badge bg-danger">${headerRow[c]}</span>`;
      });
      summaryHtml += `</div>`;
    }
  } else {
    summaryHtml = `<div class="text-muted">교사를 선택해주세요.</div>`;
  }
  
  // Render overall Exclusion Grid View
  let gridHtml = `
    <h4 class="mt-4 mb-3 border-top pt-4"><i class="bi bi-calendar-x text-danger"></i> 전체 교체 불가 현황판</h4>
    <table class="table table-sm text-center" style="font-size: 0.85rem; background: white;">
      <thead>
        <tr>
          <th style="width: 50px;">교시</th>
          ${['월','화','수','목','금'].map(d => `<th>${d}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;
  
  let allExclusions = localState[`semester${currentSemester}`].exclusions;
  for (let period = 1; period <= 7; period++) {
    gridHtml += `<tr><td class="font-bold text-muted bg-light">${period}</td>`;
    for (let dayIdx = 1; dayIdx <= 5; dayIdx++) {
      let excludedTeachers = [];
      let c = (dayIdx - 1) * 7 + period; // Calculate global colIndex
      
      Object.keys(allExclusions).forEach(t => {
        if (allExclusions[t].includes(c)) {
          excludedTeachers.push(t);
        }
      });
      
      if (excludedTeachers.length > 0) {
        let badges = excludedTeachers.map(t => `<span class="badge bg-danger m-1 p-1">${t}</span>`).join("");
        gridHtml += `<td>${badges}</td>`;
      } else {
        gridHtml += `<td class="text-muted" style="background:#f8f9fa;">-</td>`;
      }
    }
    gridHtml += `</tr>`;
  }
  gridHtml += `</tbody></table>`;
  
  sumArea.innerHTML = summaryHtml + gridHtml;
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

// --- Cart & Plan Generation ---

window.addToCart = (type, myName, myPeriod, mySubject, partnerName, partnerPeriod, partnerSubject) => {
  const cart = localState[`semester${currentSemester}`].cart;
  cart.push({
    id: Date.now().toString(),
    type,
    myName, myPeriod, mySubject,
    partnerName, partnerPeriod, partnerSubject,
    dateAdded: new Date().toLocaleDateString()
  });
  saveLocalState();
  renderCartTab();
  alert("결보강 장바구니에 담겼습니다!");
};

window.removeFromCart = (id) => {
  let cart = localState[`semester${currentSemester}`].cart;
  localState[`semester${currentSemester}`].cart = cart.filter(item => item.id !== id);
  saveLocalState();
  renderCartTab();
};

document.getElementById("btn-clear-cart").addEventListener("click", () => {
  if(confirm("장바구니를 비우시겠습니까?")) {
    localState[`semester${currentSemester}`].cart = [];
    saveLocalState();
    renderCartTab();
  }
});

function renderCartTab() {
  const cart = localState[`semester${currentSemester}`].cart;
  const container = document.getElementById("cart-list-area");
  
  if (!cart || cart.length === 0) {
    container.innerHTML = `<div class="text-center py-5 text-muted">장바구니가 비어 있습니다. 매칭 결과에서 내역을 담아주세요.</div>`;
    return;
  }
  
  let html = `<table class="table" style="min-width:700px;">
    <thead><tr>
      <th>종류</th><th>원수업 교사</th><th>교체/대강 대상</th><th>나의 수업 시간</th><th>상대방 수업 시간</th><th>관리</th>
    </tr></thead><tbody>`;
    
  cart.forEach(item => {
    let typeBadge = item.type === 'swap' ? '<span class="badge bg-success" style="padding:4px;border-radius:4px;color:white;background:var(--success-color)">교체</span>' : '<span class="badge bg-info" style="padding:4px;border-radius:4px;color:white;background:var(--info-color)">대강</span>';
    
    html += `<tr>
      <td>${typeBadge}</td>
      <td class="font-bold">${item.myName}</td>
      <td class="text-primary font-bold">${item.partnerName}</td>
      <td>${item.myPeriod}<br><small class="text-muted">${item.mySubject}</small></td>
      <td>${item.type === 'swap' ? item.partnerPeriod + '<br><small class="text-muted">' + item.partnerSubject + '</small>' : '-'}</td>
      <td><button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${item.id}')">삭제</button></td>
    </tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

document.getElementById("btn-download-plan").addEventListener("click", () => {
  const cart = localState[`semester${currentSemester}`].cart;
  if (!cart || cart.length === 0) {
    return alert("장바구니가 비어 있습니다.");
  }
  
  // Create an Excel Sheet that fits on one page and mimics the HWpx form
  const ws_data = [];
  
  // Header
  ws_data.push(["결 보 강  계 획 서"]);
  ws_data.push([""]); // Empty row
  
  // Construct the table
  ws_data.push(["구 분", "원수업교사", "과목 및 학반", "결강(변경전) 일시", "보강교사", "보강(변경후) 일시", "사 유"]);
  
  cart.forEach(item => {
    let typeStr = item.type === 'swap' ? '교체' : '대강';
    let mySubj = item.mySubject.replace(/<br>/g, " ");
    let partnerTime = item.type === 'swap' ? item.partnerPeriod : '대강';
    
    ws_data.push([
      typeStr,
      item.myName,
      mySubj,
      item.myPeriod,
      item.partnerName,
      partnerTime,
      "" // Reason (left blank for user to fill)
    ]);
  });
  
  ws_data.push([""]);
  ws_data.push(["위와 같이 결보강 계획서를 제출합니다."]);
  ws_data.push([""]);
  const today = new Date();
  ws_data.push([`2026년  ${today.getMonth()+1}월  ${today.getDate()}일`]);
  ws_data.push([""]);
  ws_data.push(["제출자:                   (인)"]);
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  
  // Set column widths
  ws["!cols"] = [
    { wch: 8 },  // 구분
    { wch: 12 }, // 원수업교사
    { wch: 15 }, // 과목 및 학반
    { wch: 18 }, // 결강일시
    { wch: 12 }, // 보강교사
    { wch: 18 }, // 보강일시
    { wch: 15 }  // 사유
  ];

  // Merge Cells for Header
  ws["!merges"] = [
    { s: {r:0, c:0}, e: {r:0, c:6} }, // Title
    { s: {r:ws_data.length-4, c:0}, e: {r:ws_data.length-4, c:6} },
    { s: {r:ws_data.length-2, c:0}, e: {r:ws_data.length-2, c:6} },
    { s: {r:ws_data.length-1, c:0}, e: {r:ws_data.length-1, c:6} }
  ];
  
  // Page Setup for Printing (Fit to 1 Page)
  ws["!pageSetup"] = { fitToWidth: 1, fitToHeight: 1, orientation: 'portrait' };
  
  // Create workbook and add sheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "결보강계획서");
  
  XLSX.writeFile(wb, `결보강계획서_${new Date().getTime()}.xlsx`);
});

init();

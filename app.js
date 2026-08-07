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
let currentSemester = "1"; // default 1
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
    document.getElementById("admin-login-area").classList.remove("hidden");
    document.getElementById("admin-dashboard").classList.add("hidden");
  } else {
    document.getElementById("admin-login-area").classList.add("hidden");
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
  
  // 비밀번호 자동 로그인 기능 제거 (매번 입력하도록 강제)
  // if (localState.appPassword === "2026") {
  //   authOverlay.classList.add("hidden");
  //   mainApp.classList.remove("hidden");
  //   await loadDataForSemester();
  // }
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
document.querySelectorAll(".semester-btn").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    currentSemester = parseInt(e.target.dataset.sem);
    document.querySelectorAll(".semester-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    await loadDataForSemester();
  });
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
  
  document.querySelectorAll(".semester-btn").forEach(b => {
    b.classList.remove("active");
    if(parseInt(b.getAttribute("data-sem")) === currentSemester) {
      b.classList.add("active");
    }
  });
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
    modal.classList.add("active");
    return;
  }
  
  let html = `<div class="d-flex flex-column gap-3">`;
  partners.forEach((p, idx) => {
    let summary = '';
    if (mode === 'swap') {
      summary = `
        <div class="glass-panel" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
          <h4 class="text-primary mb-2 d-flex justify-between align-center">
            <span><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님과 교체 가능</span>
            <button class="btn btn-sm btn-outline-primary btn-add-cart" data-type="swap" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" data-pname="${p.name}" data-pperiod="${p.pPeriod}" data-psubj="${p.pSubject}">장바구니 담기</button>
          </h4>
          <div class="text-center font-bold" style="font-size: 1.1rem; margin-bottom: 10px;">
            나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ↔ ${p.name}T의 <span class="text-primary">${p.pPeriod} [${p.pSubject}]</span>
          </div>
          <div class="text-center">
            <button class="btn btn-sm btn-secondary btn-toggle-timetable" data-target="tt-swap-${idx}">상대방 시간표 보기</button>
          </div>
          <div id="tt-swap-${idx}" class="partner-timetable-container hidden">
            ${generatePartnerTimetableHtml(p.name)}
          </div>
        </div>
      `;
    } else {
      summary = `
        <div class="glass-panel" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
          <h4 class="text-primary mb-2 d-flex justify-between align-center">
            <span><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님</span>
            <button class="btn btn-sm btn-outline-info btn-add-cart" data-type="cover" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" data-pname="${p.name}" data-pperiod="" data-psubj="">장바구니 담기</button>
          </h4>
          <div class="text-center font-bold" style="font-size: 1.1rem; margin-bottom: 10px;">
            나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ↔ <span class="text-primary">${p.name} 선생님</span>께 대강 요청
          </div>
          <div class="text-center">
            <button class="btn btn-sm btn-secondary btn-toggle-timetable" data-target="tt-cover-${idx}">상대방 시간표 보기</button>
          </div>
          <div id="tt-cover-${idx}" class="partner-timetable-container hidden">
            ${generatePartnerTimetableHtml(p.name)}
          </div>
        </div>
      `;
    }
    html += summary;
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

  modalBody.querySelectorAll(".btn-toggle-timetable").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const targetDiv = document.getElementById(targetId);
      if (targetDiv.classList.contains("hidden")) {
        targetDiv.classList.remove("hidden");
        btn.textContent = "상대방 시간표 접기";
      } else {
        targetDiv.classList.add("hidden");
        btn.textContent = "상대방 시간표 보기";
      }
    });
  });
  
  modal.classList.add("active");
}

function generatePartnerTimetableHtml(teacherName) {
  let html = `<table class="table table-sm text-center" style="font-size: 0.85rem;">
    <thead>
      <tr>
        <th style="width: 40px;">교시</th>
        <th class="day-mon">월</th><th class="day-tue">화</th><th class="day-wed">수</th><th class="day-thu">목</th><th class="day-fri">금</th>
      </tr>
    </thead>
    <tbody>
  `;
  for (let r = 1; r <= 7; r++) {
    html += `<tr><td class="font-bold text-muted bg-light">${r}</td>`;
    for (let c = 1; c <= 5; c++) {
      let subj = getTeacherSubject(teacherName, r, c) || "";
      let dCls = c===1 ? "day-mon" : c===2 ? "day-tue" : c===3 ? "day-wed" : c===4 ? "day-thu" : "day-fri";
      if (subj) {
        html += `<td class="${dCls}" style="color:#000; font-weight:bold; border-radius:4px;">${subj}</td>`;
      } else {
        html += `<td class="text-muted ${dCls}" style="border-radius:4px; opacity: 0.5;">-</td>`;
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function getTeacherSubject(name, period, dayIdx) {
  const row = fullData.find(r => r[0] === name);
  if (!row) return null;
  const colIndex = (dayIdx - 1) * 7 + period;
  return row[colIndex] || null;
}

btnCloseModal.addEventListener("click", () => {
  modal.classList.remove("active");
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Escape" && modal.classList.contains("active")) {
    modal.classList.remove("active");
  }
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
      document.getElementById("admin-login-area").classList.add("hidden");
      document.getElementById("admin-dashboard").classList.remove("hidden");
      const errorEl = document.getElementById("admin-error");
      if (errorEl) errorEl.classList.add("hidden");
    } else {
      const errorEl = document.getElementById("admin-error");
      if (errorEl) {
        errorEl.classList.remove("hidden");
      } else {
        alert("비밀번호가 틀렸습니다.");
      }
    }
  } catch(e) {
    alert("오류 발생: " + e.message);
  }
});

adminPwdInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") btnAdminLogin.click();
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
  let html = `<div class="d-flex flex-column gap-2" style="max-height: 500px; overflow-y: auto; overflow-x: hidden; padding-right: 5px;">`;
  teachers.forEach((t, i) => {
    let isActive = selected.includes(t) ? "active btn-primary text-white" : "btn-outline-primary";
    html += `<button class="btn btn-sm ${isActive} toggle-teacher-btn text-start" data-val="${t}">${t}</button>`;
  });
  html += `</div>`;
  clContainer.innerHTML = html;
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("toggle-teacher-btn")) {
    let t = e.target.dataset.val;
    let arr = localState[`semester${currentSemester}`].selectedTeachers || [];
    if (arr.includes(t)) {
      arr = arr.filter(v => v !== t);
    } else {
      arr.push(t);
    }
    localState[`semester${currentSemester}`].selectedTeachers = arr;
    saveLocalState();
    renderMeetingTab();
    updateMeetingPreview();
  }
});

function updateMeetingPreview() {
  const selected = localState[`semester${currentSemester}`].selectedTeachers || [];
  if (selected.length === 0) {
    meetingTimetableArea.innerHTML = `<div class="text-center py-3 text-muted">교사를 선택해주세요.</div>`;
    return;
  }
  
  let previewHtml = `<div class="d-flex flex-column gap-3">`;
  for (let t of selected) {
    previewHtml += `<div class="glass-panel">
      <h5 class="font-bold text-primary mb-2"><i class="bi bi-person-circle"></i> ${t} 선생님</h5>
      ${generatePartnerTimetableHtml(t)}
    </div>`;
  }
  previewHtml += `</div>`;
  meetingTimetableArea.innerHTML = previewHtml;
}

document.addEventListener("change", (e) => {
  if (e.target.classList.contains("chk-teacher")) {
    let arr = localState[`semester${currentSemester}`].selectedTeachers || [];
    if (e.target.checked) {
      if (!arr.includes(e.target.value)) arr.push(e.target.value);
    } else {
      arr = arr.filter(v => v !== e.target.value);
    }
    localState[`semester${currentSemester}`].selectedTeachers = arr;
    saveLocalState();
  }
});

const btnFindMeeting = document.getElementById("btn-find-meeting");
const btnClearMeeting = document.getElementById("btn-clear-meeting");
const btnCopyMeeting = document.getElementById("btn-copy-meeting");
const meetingTimetableArea = document.getElementById("meeting-timetable-area");
const meetingResultArea = document.getElementById("meeting-result-area");

if (btnFindMeeting) {
  btnFindMeeting.addEventListener("click", () => {
    const selected = localState[`semester${currentSemester}`].selectedTeachers || [];
    if (selected.length < 2) {
      alert("비교할 교사를 2명 이상 선택하세요.");
      return;
    }
    
    let commonFree = [];
    for (let i = 1; i < headerRow.length; i++) {
      let isAllFree = true;
      for (let t of selected) {
        let row = fullData.find(r => r[0] === t);
        if (!row || !isFree(row[i]) || isExcluded(t, i)) {
          isAllFree = false;
          break;
        }
      }
      if (isAllFree) {
        commonFree.push(headerRow[i]);
      }
    }
    
    if (commonFree.length > 0) {
      meetingResultArea.innerHTML = `<div class="alert alert-success m-0 font-bold">
        <i class="bi bi-check-circle-fill"></i> 모두 공강인 시간: ${commonFree.join(", ")}
      </div>`;
    } else {
      meetingResultArea.innerHTML = `<div class="alert alert-warning m-0 font-bold">
        <i class="bi bi-exclamation-triangle-fill"></i> 모두 공강인 시간이 없습니다.
      </div>`;
    }
    updateMeetingPreview();
  });
}

if (btnClearMeeting) {
  btnClearMeeting.addEventListener("click", () => {
    localState[`semester${currentSemester}`].selectedTeachers = [];
    saveLocalState();
    renderMeetingTab();
    meetingTimetableArea.innerHTML = `<div class="text-center py-3 text-muted">교사를 선택해주세요.</div>`;
    meetingResultArea.innerHTML = `교사를 2명 이상 선택한 후 [공강 찾기]를 누르세요.`;
  });
}

if (btnCopyMeeting) {
  btnCopyMeeting.addEventListener("click", () => {
    const selected = localState[`semester${currentSemester}`].selectedTeachers || [];
    if (selected.length < 2) return alert("먼저 공강을 찾아주세요.");
    const text = meetingResultArea.innerText;
    navigator.clipboard.writeText(`[협의회 공강 시간]\n참여: ${selected.join(", ")}\n결과: ${text.trim()}`)
      .then(() => alert("복사되었습니다."))
      .catch(e => alert("복사 실패: " + e));
  });
}

// Exclusion Tab
window.renderExclusionTab = function() {
  const gridArea = document.getElementById("exclusion-grid-area");
  if (!teachers || teachers.length === 0) {
    gridArea.innerHTML = `<div class="text-center py-4 text-muted">데이터가 없습니다.</div>`;
    return;
  }
  
  let html = `<table class="table table-sm text-center" style="font-size: 0.85rem;"><thead><tr><th>교사명</th>`;
  for (let i = 1; i < headerRow.length; i++) {
    html += `<th>${headerRow[i]}</th>`;
  }
  html += `</tr></thead><tbody>`;
  
  teachers.forEach(tName => {
    let rowData = fullData.find(r => r[0] === tName);
    if(!rowData) return;
    
    html += `<tr><td class="font-bold text-primary bg-light" style="vertical-align: middle;">${tName}</td>`;
    let exclusions = localState[`semester${currentSemester}`].exclusions[tName] || [];
    for (let i = 1; i < rowData.length; i++) {
      let val = rowData[i] || "";
      let isEx = exclusions.includes(i);
      let cls = isEx ? 'is-excluded' : 'is-clickable';
      html += `<td class="${cls}" style="border:1px solid rgba(0,0,0,0.1); cursor:pointer;" onclick="toggleExclusionCell('${tName}', ${i})">${val}</td>`;
    }
    html += `</tr>`;
  });
  
  html += `</tbody></table>`;
  gridArea.innerHTML = html;
  
  updateExclusionSummary();
};

window.toggleExclusionCell = function(tName, colIndex) {
  if (!localState[`semester${currentSemester}`].exclusions[tName]) {
    localState[`semester${currentSemester}`].exclusions[tName] = [];
  }
  let arr = localState[`semester${currentSemester}`].exclusions[tName];
  if (arr.includes(colIndex)) {
    arr.splice(arr.indexOf(colIndex), 1);
  } else {
    arr.push(colIndex);
  }
  saveLocalState();
  renderExclusionTab();
  renderTimetables();
};

window.updateExclusionSummary = function() {
  const sumArea = document.getElementById("exclusion-summary");
  let exclusions = localState[`semester${currentSemester}`].exclusions;
  
  let html = `<h4 class="mb-2 font-bold"><i class="bi bi-list-check"></i> 설정된 내역 요약 (자동 저장됨)</h4>
              <table class="table table-sm table-bordered mt-2 text-center" style="font-size: 0.9rem; background-color: #fff;">
                <thead class="bg-light">
                  <tr>
                    <th>교시</th>
                    <th class="day-mon">월</th>
                    <th class="day-tue">화</th>
                    <th class="day-wed">수</th>
                    <th class="day-thu">목</th>
                    <th class="day-fri">금</th>
                  </tr>
                </thead>
                <tbody>`;
                
  let hasAnyExclusion = false;
  for (let p = 1; p <= 7; p++) {
    html += `<tr><td class="font-bold text-muted bg-light">${p}</td>`;
    for (let d = 1; d <= 5; d++) {
      let colIndex = (d - 1) * 7 + p;
      let excludedTeachers = [];
      for (let t in exclusions) {
        if (exclusions[t] && exclusions[t].includes(colIndex)) {
          excludedTeachers.push(t);
          hasAnyExclusion = true;
        }
      }
      let dCls = d===1 ? "day-mon" : d===2 ? "day-tue" : d===3 ? "day-wed" : d===4 ? "day-thu" : "day-fri";
      html += `<td class="${dCls} text-danger font-bold" style="white-space: pre-wrap; word-break: keep-all;">${excludedTeachers.join(', ')}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  
  sumArea.innerHTML = !hasAnyExclusion ? `<div class="text-muted">설정된 교체 불가 내역이 없습니다.</div>` : html;
};

document.getElementById("btn-clear-all-exclusions").addEventListener("click", () => {
  if (confirm("이 기기의 교체 불가 설정을 모두 초기화하시겠습니까?")) {
    localState[`semester${currentSemester}`].exclusions = {};
    saveLocalState();
    renderExclusionTab();
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
  
  let html = `
    <div class="mb-3 d-flex justify-between align-center">
      <p class="text-primary m-0"><i class="bi bi-info-circle"></i> 아래 표를 드래그해서 한글(HWP)에 그대로 복사-붙여넣기 하세요.</p>
    </div>
    <div style="overflow-x: auto; background: white; padding: 15px; border-radius: 8px;">
      <table border="1" style="border-collapse: collapse; text-align: center; width: 100%; border: 1px solid black; color: black; font-size: 11pt; font-family: 'Malgun Gothic', sans-serif;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px; border: 1px solid black;">구분</th>
            <th style="padding: 8px; border: 1px solid black;">원수업교사</th>
            <th style="padding: 8px; border: 1px solid black;">결강(변경전) 일시 및 과목</th>
            <th style="padding: 8px; border: 1px solid black;">보강교사</th>
            <th style="padding: 8px; border: 1px solid black;">보강(변경후) 일시 및 과목</th>
            <th style="padding: 8px; border: 1px solid black;" class="no-print">관리</th>
          </tr>
        </thead>
        <tbody>
  `;
    
  cart.forEach(item => {
    let typeStr = item.type === 'swap' ? '교체' : '대강';
    
    let myInfo = `${item.myPeriod} / ${item.mySubject}`;
    let partnerInfo = item.type === 'swap' 
      ? `${item.partnerPeriod} / ${item.partnerSubject}` 
      : `${item.myPeriod} / ${item.mySubject}`; // 대강인 경우 동일한 시간과 과목
    
    html += `<tr>
      <td style="padding: 8px; border: 1px solid black;">${typeStr}</td>
      <td style="padding: 8px; border: 1px solid black; font-weight: bold;">${item.myName}</td>
      <td style="padding: 8px; border: 1px solid black;">${myInfo}</td>
      <td style="padding: 8px; border: 1px solid black; font-weight: bold; color: blue;">${item.partnerName}</td>
      <td style="padding: 8px; border: 1px solid black;">${partnerInfo}</td>
      <td style="padding: 8px; border: 1px solid black;" class="no-print">
        <button class="btn btn-sm btn-danger" onclick="removeFromCart('${item.id}')">삭제</button>
      </td>
    </tr>`;
  });
  
  html += `</tbody></table></div>`;
  
  // Add a style tag to hide the .no-print column when actually copying or printing if needed, though simple selection works best.
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


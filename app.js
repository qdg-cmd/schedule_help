import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

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

const btnMobileMenu = document.getElementById("btn-mobile-menu");
const btnCloseSidebar = document.getElementById("btn-close-sidebar");
const sidebar = document.getElementById("sidebar");

if (btnMobileMenu && sidebar) {
  btnMobileMenu.addEventListener("click", () => sidebar.classList.add("show"));
}
if (btnCloseSidebar && sidebar) {
  btnCloseSidebar.addEventListener("click", () => sidebar.classList.remove("show"));
}

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
    if (sidebar) sidebar.classList.remove("show");
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
  if (sidebar) sidebar.classList.remove("show");
});

// Init
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
  
  try {
    const docSnap = await getDoc(doc(db, "settings", "general"));
    if (docSnap.exists() && docSnap.data().semesterCutoff) {
      localState.semesterCutoff = docSnap.data().semesterCutoff;
      saveLocalState();
    }
  } catch(e) {}
  
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

document.getElementById("btn-reset-local").addEventListener("click", () => {
  if (confirm("개인 설정(선택된 교사, 교체 불가 설정, 결보강 장바구니)을 초기화하시겠습니까?")) {
    localState.semester1 = { selectedTeachers: [], exclusions: {}, cart: [] };
    localState.semester2 = { selectedTeachers: [], exclusions: {}, cart: [] };
    saveLocalState();
    alert("초기화되었습니다.");
    location.reload();
  }
});

// Semester
const semesterSelect = document.getElementById("semester-select");
if (semesterSelect) {
  semesterSelect.addEventListener("change", async (e) => {
    currentSemester = parseInt(e.target.value);
    await loadDataForSemester();
  });
}

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
      if (typeof data === 'string') data = JSON.parse(data);
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
    showNoData();
  }
}

function autoSelectSemester() {
  const today = new Date();
  let cutoff = localState.semesterCutoff || "08-10";
  let parts = cutoff.split("-");
  const cutoffTime = new Date(today.getFullYear(), parseInt(parts[0])-1, parseInt(parts[1])).getTime();
  
  if (today.getTime() >= cutoffTime) currentSemester = 2;
  else currentSemester = 1;
  
  if (semesterSelect) semesterSelect.value = currentSemester.toString();
}

function showNoData() {
  const emptyHtml = `<div class="text-center py-5 text-muted">저장된 시간표 데이터가 없습니다. 관리자 탭에서 데이터를 업로드하세요.</div>`;
  document.getElementById("table-swap").innerHTML = emptyHtml;
  document.getElementById("table-cover").innerHTML = emptyHtml;
  fullData = []; headerRow = []; teachers = [];
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
  return v === "" || v === "횞" || v === "x" || v === "×";
}

function formatSubject(val) {
  if (!val) return "";
  let str = String(val).trim();
  let match = str.match(/^(\d+)\s*(.+)$/);
  if (match) return `${match[1]}<br>${match[2]}`;
  return str;
}

function isExcluded(teacherName, colIndex) {
  const exclusions = localState[`semester${currentSemester}`].exclusions;
  return exclusions[teacherName] && exclusions[teacherName].includes(colIndex);
}

function renderTimetables() {
  document.getElementById("table-swap").innerHTML = generateTableHtml("analyzeSwap");
  document.getElementById("table-cover").innerHTML = generateTableHtml("analyzeCover");
  
  const searchSwap = document.getElementById("search-swap");
  const searchCover = document.getElementById("search-cover");
  if (searchSwap) searchSwap.addEventListener("input", (e) => highlightRow("table-swap", e.target.value));
  if (searchCover) searchCover.addEventListener("input", (e) => highlightRow("table-cover", e.target.value));
}

function highlightRow(containerId, kw) {
  kw = kw.trim();
  document.querySelectorAll(`#${containerId} tbody tr`).forEach(tr => {
    let nameTd = tr.querySelector('td:first-child');
    if (nameTd && kw !== "" && nameTd.innerText.includes(kw)) {
      tr.classList.add("my-row-highlight");
    } else {
      tr.classList.remove("my-row-highlight");
    }
  });
}

function generateTableHtml(actionFunc) {
  if (fullData.length === 0) return "";
  let html = `<table class="table"><thead><tr>`;
  let dayClasses = [];

  for (let j = 0; j < headerRow.length; j++) {
    let hStr = headerRow[j] || "";
    let dCls = hStr.includes("월") ? "day-mon" : hStr.includes("화") ? "day-tue" :
               hStr.includes("수") ? "day-wed" : hStr.includes("목") ? "day-thu" :
               hStr.includes("금") ? "day-fri" : "";
    let bCls = (j > 0 && j < headerRow.length - 1 && hStr.replace(/[0-9]/g, '') !== (headerRow[j+1]||"").replace(/[0-9]/g, '')) ? "day-border" : (j === headerRow.length -1 ? "day-border" : "");
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

document.addEventListener("click", (e) => {
  let td = e.target.closest("td[data-action]");
  if (td) {
    let action = td.dataset.action;
    let row = parseInt(td.dataset.row);
    let col = parseInt(td.dataset.col);
    if (action === "analyzeSwap") analyzeSwap(row, col);
    if (action === "analyzeCover") analyzeCover(row, col);
    if (action === "toggleExclusion") toggleExclusionCell(fullData[row][0], col);
  }
  
  if (e.target.closest(".btn-add-cart")) {
    const btn = e.target.closest(".btn-add-cart");
    addToCart({
      type: btn.dataset.type,
      myName: btn.dataset.myname,
      myPeriod: btn.dataset.myperiod,
      mySubject: btn.dataset.mysubj,
      partnerName: btn.dataset.pname,
      partnerPeriod: btn.dataset.pperiod,
      partnerSubject: btn.dataset.psubj,
      id: Date.now().toString()
    });
    alert("장바구니에 담겼습니다.");
    modal.classList.add("hidden");
  }
});

function analyzeSwap(row, col) {
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
  showModal("수업 교체 매칭 결과", partners, 'swap', myName, myPeriod, rawSubject, row, col);
}

function analyzeCover(row, col) {
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
  showModal("대강 매칭 결과", partners, 'cover', myName, myPeriod, rawSubject, row, col);
}

function showModal(title, partners, mode, myName, myPeriod, rawSubject, row, col) {
  modalTitle.textContent = title;
  
  if (partners.length === 0) {
    modalBody.innerHTML = `<div class="text-center text-muted py-4">가능한 교사가 없습니다.</div>`;
    modal.classList.remove("hidden");
    return;
  }
  
  let html = `<div class="d-flex flex-column gap-3">`;
  partners.forEach(p => {
    let previewTable = '';
    if (mode === 'swap') {
      html += `
        <div class="glass-panel mb-2" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
          <h4 class="text-primary mb-2 d-flex justify-between align-center">
            <span><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님과 교체 가능</span>
            <button class="btn btn-sm btn-outline-primary btn-add-cart" data-type="swap" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" data-pname="${p.name}" data-pperiod="${p.pPeriod}" data-psubj="${p.pSubject}">장바구니 담기</button>
          </h4>
          <div class="text-center font-bold" style="font-size: 1.1rem; margin-bottom: 15px;">
            나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ↔ ${p.name}T의 <span class="text-primary">${p.pPeriod} [${p.pSubject}]</span>
          </div>
          ${buildPreviewTableSwap(myName, p.name, row, col, p.pRow, p.pCol, rawSubject, p.pSubject)}
        </div>
      `;
    } else {
      html += `
        <div class="glass-panel mb-2" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
          <h4 class="text-primary mb-2 d-flex justify-between align-center">
            <span><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님</span>
            <button class="btn btn-sm btn-outline-info btn-add-cart" data-type="cover" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" data-pname="${p.name}" data-pperiod="" data-psubj="">장바구니 담기</button>
          </h4>
          <div class="text-center font-bold" style="font-size: 1.1rem; margin-bottom: 15px;">
            나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> → <span class="text-primary">${p.name} 선생님</span>에게 대강 요청
          </div>
          ${buildPreviewTableCover(myName, p.name, row, p.pRow, col, rawSubject)}
        </div>
      `;
    }
  });
  html += `</div>`;
  modalBody.innerHTML = html;
  modal.classList.remove("hidden");
}

function buildPreviewTableSwap(myName, pName, row, col, pRow, pCol, rawSubject, pSubject) {
  let pt = `<table class="table" style="width:100%;"><thead><tr>`;
  let dayClasses = [];
  for(let j = 1; j < headerRow.length; j++) {
    let hStr = headerRow[j];
    let dCls = hStr.includes("월") ? "day-mon" : hStr.includes("화") ? "day-tue" :
               hStr.includes("수") ? "day-wed" : hStr.includes("목") ? "day-thu" :
               hStr.includes("금") ? "day-fri" : "";
    let bCls = (j > 1 && j < headerRow.length - 1 && hStr.replace(/[0-9]/g, '') !== headerRow[j+1].replace(/[0-9]/g, '')) ? "day-border" : (j === headerRow.length -1 ? "day-border" : "");
    dayClasses[j] = `${dCls} ${bCls}`;
    let thClass = (j === col || j === pCol) ? 'bg-warning text-dark' : '';
    pt += `<th class="${dayClasses[j]} ${thClass}">${headerRow[j]}</th>`;
  }
  pt += `</tr></thead><tbody><tr>`;
  for(let j = 1; j < fullData[row].length; j++) {
    let v = isFree(fullData[row][j]) ? "공강" : formatSubject(fullData[row][j]);
    if (j === col) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">공강</td>`;
    else if (j === pCol) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(pSubject)}</td>`;
    else pt += `<td class="${dayClasses[j]}">${isFree(fullData[row][j]) ? "" : v}</td>`;
  }
  pt += `</tr><tr>`;
  for(let j = 1; j < fullData[pRow].length; j++) {
    let v = isFree(fullData[pRow][j]) ? "공강" : formatSubject(fullData[pRow][j]);
    if (j === pCol) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">공강</td>`;
    else if (j === col) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(rawSubject)}</td>`;
    else pt += `<td class="${dayClasses[j]}">${isFree(fullData[pRow][j]) ? "" : v}</td>`;
  }
  pt += `</tr></tbody></table>`;
  return pt;
}

function buildPreviewTableCover(myName, pName, row, pRow, col, rawSubject) {
  let pt = `<table class="table" style="width:100%;"><thead><tr>`;
  let dayClasses = [];
  for(let j = 1; j < headerRow.length; j++) {
    let hStr = headerRow[j];
    let dCls = hStr.includes("월") ? "day-mon" : hStr.includes("화") ? "day-tue" :
               hStr.includes("수") ? "day-wed" : hStr.includes("목") ? "day-thu" :
               hStr.includes("금") ? "day-fri" : "";
    let bCls = (j > 1 && j < headerRow.length - 1 && hStr.replace(/[0-9]/g, '') !== headerRow[j+1].replace(/[0-9]/g, '')) ? "day-border" : (j === headerRow.length -1 ? "day-border" : "");
    dayClasses[j] = `${dCls} ${bCls}`;
    let thClass = (j === col) ? 'bg-warning text-dark' : '';
    pt += `<th class="${dayClasses[j]} ${thClass}">${headerRow[j]}</th>`;
  }
  pt += `</tr></thead><tbody><tr>`;
  for(let j = 1; j < fullData[row].length; j++) {
    let v = isFree(fullData[row][j]) ? "공강" : formatSubject(fullData[row][j]);
    if (j === col) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">공강</td>`;
    else pt += `<td class="${dayClasses[j]}">${isFree(fullData[row][j]) ? "" : v}</td>`;
  }
  pt += `</tr><tr>`;
  for(let j = 1; j < fullData[pRow].length; j++) {
    let v = isFree(fullData[pRow][j]) ? "공강" : formatSubject(fullData[pRow][j]);
    if (j === col) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(rawSubject)}</td>`;
    else pt += `<td class="${dayClasses[j]}">${isFree(fullData[pRow][j]) ? "" : v}</td>`;
  }
  pt += `</tr></tbody></table>`;
  return pt;
}

btnCloseModal.addEventListener("click", () => modal.classList.add("hidden"));
document.addEventListener("keyup", (e) => {
  if (e.key === "Escape") modal.classList.add("hidden");
});

function addToCart(item) {
  localState[`semester${currentSemester}`].cart.push(item);
  saveLocalState();
  renderCartTab();
}

window.removeFromCart = (idx) => {
  localState[`semester${currentSemester}`].cart.splice(idx, 1);
  saveLocalState();
  renderCartTab();
};

function parseSubjectForHwp(subjectString) {
  if (!subjectString) return "";
  let str = String(subjectString).trim();
  let match = str.match(/^(\d)(\d{2})\s*(.+)$/);
  if (match) {
    let grade = match[1];
    let classNum = parseInt(match[2], 10);
    let subj = match[3];
    return `${grade}학년 ${classNum}반 ${subj}`;
  }
  return str;
}

function renderCartTab() {
  const cartList = document.getElementById("cart-list-area");
  let cart = localState[`semester${currentSemester}`].cart;
  if (!cart || cart.length === 0) {
    cartList.innerHTML = `<div class="text-center py-5 text-muted">장바구니가 비어 있습니다. 매칭 결과에서 내역을 담아주세요.</div>`;
    return;
  }
  
  let html = `
    <div class="mb-3 text-end">
      <button class="btn btn-sm btn-outline-primary" onclick="copyHwpTable()"><i class="bi bi-clipboard-check"></i> 한글 양식 복사하기</button>
      <p class="text-muted text-sm mt-1">※ '한글 양식 복사하기' 버튼을 누른 후 한글(HWP)에 붙여넣기(Ctrl+V) 하세요.</p>
    </div>
    <div id="hwp-table-container" style="padding: 20px; background: white; color: black; border: 1px solid #ccc; overflow-x: auto;">
      <div style="font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 20px;">결강으로 인한 보강 계획</div>
      
      <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: center; font-size: 11pt; border: 2px solid black;">
        <thead>
          <tr>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">결보강/수업교체</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">일자</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">요일</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">교시</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">학반</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">과목</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">교사명</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">이동</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">일자</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">요일</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">교시</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">학반</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">과목</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">교사명</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  cart.forEach((c, idx) => {
    let typeStr = c.type === 'swap' ? '수업교체' : '결보강';
    let myDay = c.myPeriod.replace(/[0-9]/g, '');
    let myNum = c.myPeriod.replace(/[^0-9]/g, '');
    let myParsed = parseSubjectForHwp(c.mySubject);
    let myClass = "";
    let mySubj = myParsed;
    // split "1학년 2반 기하" into "1학년 2반" and "기하"
    let m = myParsed.match(/(^\d학년\s*\d반)\s*(.+)$/);
    if (m) { myClass = m[1]; mySubj = m[2]; }
    
    let pDay = "", pNum = "", pClass = "", pSubj = "";
    let arrow = c.type === 'swap' ? "↔" : "→";
    
    if (c.type === 'swap') {
      pDay = c.partnerPeriod.replace(/[0-9]/g, '');
      pNum = c.partnerPeriod.replace(/[^0-9]/g, '');
      let pParsed = parseSubjectForHwp(c.partnerSubject);
      pSubj = pParsed;
      let pm = pParsed.match(/(^\d학년\s*\d반)\s*(.+)$/);
      if (pm) { pClass = pm[1]; pSubj = pm[2]; }
    }
    
    html += `
      <tr>
        <td style="border: 1px solid black; padding: 4px;">${typeStr}</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;">${myDay}</td>
        <td style="border: 1px solid black; padding: 4px;">${myNum}</td>
        <td style="border: 1px solid black; padding: 4px;">${myClass}</td>
        <td style="border: 1px solid black; padding: 4px;">${mySubj}</td>
        <td style="border: 1px solid black; padding: 4px;">${c.myName}</td>
        <td style="border: 1px solid black; padding: 4px;">${arrow}</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;">${pDay}</td>
        <td style="border: 1px solid black; padding: 4px;">${pNum}</td>
        <td style="border: 1px solid black; padding: 4px;">${pClass}</td>
        <td style="border: 1px solid black; padding: 4px;">${pSubj}</td>
        <td style="border: 1px solid black; padding: 4px;">${c.partnerName}</td>
      </tr>
    `;
  });
  
  html += `</tbody></table></div>`;
  html += `<div class="mt-3"><table class="table"><tbody>`;
  cart.forEach((c, idx) => {
    let typeBadge = c.type === 'swap' ? '<span class="badge bg-success">교체</span>' : '<span class="badge bg-info">대강</span>';
    html += `<tr><td>${typeBadge}</td><td class="font-bold">${c.myName}</td><td class="text-primary font-bold">${c.partnerName}</td>
      <td>${c.myPeriod}<br><small>${c.mySubject}</small></td>
      <td>${c.type==='swap' ? c.partnerPeriod+'<br><small>'+c.partnerSubject+'</small>' : '-'}</td>
      <td><button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${idx})">삭제</button></td></tr>`;
  });
  html += `</tbody></table></div>`;
  cartList.innerHTML = html;
}

window.copyHwpTable = () => {
  const container = document.getElementById("hwp-table-container");
  if (!container) return;
  const range = document.createRange();
  range.selectNode(container);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  try {
    document.execCommand('copy');
    alert("한글 양식이 복사되었습니다. Ctrl+V로 붙여넣으세요.");
  } catch (err) { alert("복사 실패"); }
  window.getSelection().removeAllRanges();
};

document.getElementById("btn-clear-cart").addEventListener("click", () => {
  if(confirm("장바구니를 비우시겠습니까?")) {
    localState[`semester${currentSemester}`].cart = [];
    saveLocalState();
    renderCartTab();
  }
});

function renderExclusionTab() {
  const area = document.getElementById("exclusion-area");
  if (fullData.length === 0) {
    area.innerHTML = `<div class="text-center py-5 text-muted">데이터가 없습니다.</div>`;
    return;
  }
  area.innerHTML = generateTableHtml("toggleExclusion");
}

function toggleExclusionCell(teacherName, colIndex) {
  let exc = localState[`semester${currentSemester}`].exclusions;
  if (!exc[teacherName]) exc[teacherName] = [];
  
  const idx = exc[teacherName].indexOf(colIndex);
  if (idx > -1) {
    exc[teacherName].splice(idx, 1);
  } else {
    exc[teacherName].push(colIndex);
  }
  saveLocalState();
  renderTimetables();
  renderExclusionTab();
}

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
  
  let html = `<div style="overflow-x: auto; width: 100%;"><table class="table" style="font-size: 0.7rem; min-width:600px;"><thead><tr>`;
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
  html += `</tbody></table></div>`;
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
    alert("로그인 중 오류가 발생했습니다: " + e.message);
    console.error(e);
  }
});

adminPwdInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") btnAdminLogin.click();
});

if (btnSaveCutoff) {
  btnSaveCutoff.addEventListener("click", async () => {
    if (cutoffInput.value.trim() === "") return;
    localState.semesterCutoff = cutoffInput.value.trim();
    saveLocalState();
    try {
      await setDoc(doc(db, "settings", "general"), { semesterCutoff: localState.semesterCutoff }, { merge: true });
      alert("학기 전환 기준일이 저장되었습니다.");
    } catch(e) {}
    autoSelectSemester();
  });
  cutoffInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") btnSaveCutoff.click();
  });
}

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
      alert("업로드되었습니다!");
      location.reload();
    } catch(err) {
      alert("오류: " + err.message);
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
});

init();

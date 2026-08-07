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

// Mobile Sidebar Toggle
const btnMobileMenu = document.getElementById("btn-mobile-menu");
const btnCloseSidebar = document.getElementById("btn-close-sidebar");
const sidebar = document.getElementById("sidebar");

if (btnMobileMenu && sidebar) {
  btnMobileMenu.addEventListener("click", () => {
    sidebar.classList.add("show");
  });
}
if (btnCloseSidebar && sidebar) {
  btnCloseSidebar.addEventListener("click", () => {
    sidebar.classList.remove("show");
  });
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
    
    // Close sidebar on mobile after clicking
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
  
  try {
    const docSnap = await getDoc(doc(db, "settings", "general"));
    if (docSnap.exists() && docSnap.data().semesterCutoff) {
      localState.semesterCutoff = docSnap.data().semesterCutoff;
      saveLocalState();
    }
  } catch(e) {
    console.error("Firestore cutoff sync error:", e);
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
  if (confirm("媛쒖씤 ?ㅼ젙(?좏깮??援먯궗, 援먯껜 遺덇? ?ㅼ젙, 寃곕낫媛??λ컮援щ땲)??珥덇린?뷀븯?쒓쿋?듬땲源?")) {
    localState.semester1 = { selectedTeachers: [], exclusions: {}, cart: [] };
    localState.semester2 = { selectedTeachers: [], exclusions: {}, cart: [] };
    saveLocalState();
    alert("珥덇린?붾릺?덉뒿?덈떎.");
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
  const loadingHtml = `<div class="text-center py-5 text-muted">?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...</div>`;
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
  const emptyHtml = `<div class="text-center py-5 text-muted">??λ맂 ?쒓컙???곗씠?곌? ?놁뒿?덈떎. 愿由ъ옄 ??뿉???곗씠?곕? ?낅줈?쒗븯?몄슂.</div>`;
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
    let newHeader = [dayRow[0] || '援먯궗'];
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
  return v === "" || v === "횞" || v === "x";
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
    let hStr = headerRow[j];
    let dCls = hStr.includes("??) ? "day-mon" : hStr.includes("??) ? "day-tue" :
               hStr.includes("??) ? "day-wed" : hStr.includes("紐?) ? "day-thu" :
               hStr.includes("湲?) ? "day-fri" : "";
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
    if (action === "toggleExclusion") toggleExclusionCell(fullData[row][0], col);
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
  showModal("?섏뾽 援먯껜 留ㅼ묶 寃곌낵", partners, 'swap', myName, myPeriod, rawSubject, row, col);
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
  showModal("?媛?留ㅼ묶 寃곌낵", partners, 'cover', myName, myPeriod, rawSubject, row, col);
}

function showModal(title, partners, mode, myName, myPeriod, rawSubject, row, col) {
  modalTitle.textContent = title;
  
  if (partners.length === 0) {
    modalBody.innerHTML = `<div class="text-center text-muted py-4">媛?ν븳 援먯궗媛 ?놁뒿?덈떎.</div>`;
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
            <span><i class="bi bi-check-circle-fill"></i> ${p.name} ?좎깮?섍낵 援먯껜 媛??/span>
            <button class="btn btn-sm btn-outline-primary btn-add-cart" data-type="swap" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" data-pname="${p.name}" data-pperiod="${p.pPeriod}" data-psubj="${p.pSubject}">?λ컮援щ땲 ?닿린</button>
          </h4>
          <div class="text-center font-bold" style="font-size: 1.1rem;">
            ?섏쓽 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ??${p.name}T??<span class="text-primary">${p.pPeriod} [${p.pSubject}]</span>
          </div>
        </div>
      `;
      previewTable = buildPreviewTableSwap(myName, p.name, row, col, p.pRow, p.pCol, rawSubject, p.pSubject);
    } else {
      summary = `
        <div class="glass-panel mb-2" style="background: rgba(13, 110, 253, 0.05); border-color: var(--primary-color);">
          <h4 class="text-primary mb-2 d-flex justify-between align-center">
            <span><i class="bi bi-check-circle-fill"></i> ${p.name} ?좎깮??/span>
            <button class="btn btn-sm btn-outline-info btn-add-cart" data-type="cover" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" data-pname="${p.name}" data-pperiod="" data-psubj="">?λ컮援щ땲 ?닿린</button>
          </h4>
          <div class="text-center font-bold" style="font-size: 1.1rem;">
            ?섏쓽 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ??<span class="text-primary">${p.name} ?좎깮??/span>猿??媛??붿껌
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
  let pt = `<div class="table-responsive"><table class="table table-sm table-bordered text-center align-middle bg-white" style="table-layout: fixed; width: 100%; font-size: 0.75rem;">
    <thead class="table-light"><tr><th style="width: 60px;">援먯궗</th>`;
  
  let dayClasses = [];
  for(let j = 1; j < headerRow.length; j++) {
    let hStr = headerRow[j];
    let dCls = hStr.includes("??) ? "day-mon" : hStr.includes("??) ? "day-tue" :
               hStr.includes("??) ? "day-wed" : hStr.includes("紐?) ? "day-thu" :
               hStr.includes("湲?) ? "day-fri" : "";
    let bCls = (j > 1 && j < headerRow.length - 1 && hStr.replace(/[0-9]/g, '') !== headerRow[j+1].replace(/[0-9]/g, '')) ? "day-border" : (j === headerRow.length -1 ? "day-border" : "");
    dayClasses[j] = `${dCls} ${bCls}`;
    let thClass = (j === col || j === pCol) ? 'bg-warning text-dark' : '';
    pt += `<th class="${dayClasses[j]} ${thClass}">${headerRow[j]}</th>`;
  }
  pt += `</tr></thead><tbody><tr><td class="font-bold bg-light">${myName}</td>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let v = isFree(fullData[row][j]) ? "怨듦컯" : formatSubject(fullData[row][j]);
    if (j === col) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(rawSubject)}</td>`;
    else if (j === pCol) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">怨듦컯</td>`;
    else pt += `<td>${isFree(fullData[row][j]) ? "" : v}</td>`;
  }
  pt += `</tr><tr><td class="font-bold bg-light">${pName}</td>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let v = isFree(fullData[pRow][j]) ? "怨듦컯" : formatSubject(fullData[pRow][j]);
    if (j === col) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">怨듦컯</td>`;
    else if (j === pCol) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(pSubject)}</td>`;
    else pt += `<td class="${dayClasses[j]}">${isFree(fullData[pRow][j]) ? "" : v}</td>`;
  }
  return pt + `</tr></tbody></table></div>`;
}

function buildPreviewTableCover(myName, pName, row, pRow, col, rawSubject) {
  let pt = `<div class="table-responsive"><table class="table table-sm table-bordered text-center align-middle bg-white" style="table-layout: fixed; width: 100%; font-size: 0.75rem;">
    <thead class="table-light"><tr><th style="width: 60px;">援먯궗</th>`;
    
  let dayClasses = [];
  for(let j = 1; j < headerRow.length; j++) {
    let hStr = headerRow[j];
    let dCls = hStr.includes("??) ? "day-mon" : hStr.includes("??) ? "day-tue" :
               hStr.includes("??) ? "day-wed" : hStr.includes("紐?) ? "day-thu" :
               hStr.includes("湲?) ? "day-fri" : "";
    let bCls = (j > 1 && j < headerRow.length - 1 && hStr.replace(/[0-9]/g, '') !== headerRow[j+1].replace(/[0-9]/g, '')) ? "day-border" : (j === headerRow.length -1 ? "day-border" : "");
    dayClasses[j] = `${dCls} ${bCls}`;
    let thClass = (j === col) ? 'bg-warning text-dark' : '';
    pt += `<th class="${dayClasses[j]} ${thClass}">${headerRow[j]}</th>`;
  }
  pt += `</tr></thead><tbody><tr><td class="font-bold bg-light">${myName}</td>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let v = isFree(fullData[row][j]) ? "" : formatSubject(fullData[row][j]);
    if (j === col) pt += `<td style="background:var(--danger-color); color:white; font-weight:bold;">${formatSubject(rawSubject)}</td>`;
    else pt += `<td class="${dayClasses[j]}">${v}</td>`;
  }
  pt += `</tr><tr><td class="font-bold bg-light">${pName}</td>`;
  
  for(let j = 1; j < headerRow.length; j++) {
    let v = isFree(fullData[pRow][j]) ? "" : formatSubject(fullData[pRow][j]);
    if (j === col) pt += `<td style="background:var(--primary-color); color:white; font-weight:bold;">怨듦컯</td>`;
    else pt += `<td class="${dayClasses[j]}">${v}</td>`;
  }
  return pt + `</tr></tbody></table></div>`;
}

btnCloseModal.addEventListener("click", () => {
  modal.classList.add("hidden");
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    modal.classList.add("hidden");
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
      document.getElementById("admin-auth-area").classList.add("hidden");
      document.getElementById("admin-dashboard").classList.remove("hidden");
    } else {
      alert("鍮꾨?踰덊샇媛 ??몄뒿?덈떎.");
    }
  } catch(e) {
    alert("?ㅻ쪟 諛쒖깮: " + e.message);
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
      alert("?숆린 ?꾪솚 湲곗??쇱씠 ??λ릺怨??꾩껜 湲곌린???숆린?붾릺?덉뒿?덈떎.");
    } catch(e) {
      alert("????ㅽ뙣: " + e.message);
    }
    autoSelectSemester();
  });
  
  cutoffInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") btnSaveCutoff.click();
  });
}

// Change Admin Password
document.getElementById("btn-change-admin-pwd").addEventListener("click", async () => {
  const newPwd = document.getElementById("new-admin-password").value;
  if (!newPwd) return alert("鍮꾨?踰덊샇瑜??낅젰?섏꽭??");
  try {
    await setDoc(doc(db, "settings", "admin"), { password: newPwd });
    alert("愿由ъ옄 鍮꾨?踰덊샇媛 蹂寃쎈릺?덉뒿?덈떎.");
    document.getElementById("new-admin-password").value = "";
  } catch(e) {
    alert("?ㅻ쪟: " + e.message);
  }
});

document.getElementById("new-admin-password").addEventListener("keyup", (e) => {
  if (e.key === "Enter") document.getElementById("btn-change-admin-pwd").click();
});

// Excel Upload
document.getElementById("btn-upload-excel").addEventListener("click", () => {
  const fileInput = document.getElementById("excel-upload");
  if (!fileInput.files.length) return alert("?뚯씪???좏깮?섏꽭??");
  
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
      alert("?깃났?곸쑝濡??낅줈?쒕릺?덉뒿?덈떎!");
      location.reload();
    } catch(err) {
      alert("泥섎━ ?ㅻ쪟: " + err.message);
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
    container.innerHTML = `<div class="text-center py-3 text-muted">援먯궗瑜??좏깮?댁＜?몄슂.</div>`;
    return;
  }
  
  let html = `<div class="table-responsive"><table class="table table-bordered table-sm text-center" style="font-size: 0.8rem; min-width: 1200px;">
    <thead><tr><th style="width: 80px; position: sticky; left: 0; background: #fff; z-index: 2;">援먯궗</th>`;
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
        html += `<td style="background:var(--danger-color);color:white;" title="援먯껜遺덇?">遺덇?</td>`;
      } else if (isBusy) {
        html += `<td style="background:var(--secondary-color);color:white;" title="${fullData[rowIdx][c]}">?섏뾽</td>`;
      } else {
        html += `<td class="text-muted" style="background:#f8f9fa;">怨듦컯</td>`;
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
  document.getElementById("meeting-result-area").innerHTML = `<div class="text-center py-4 text-muted">援먯궗瑜?2紐??댁긽 ?좏깮????[怨듦컯 李얘린]瑜??꾨Ⅴ?몄슂.</div>`;
});

document.getElementById("btn-find-meeting").addEventListener("click", () => {
  const selected = localState[`semester${currentSemester}`].selectedTeachers || [];
  const resultDiv = document.getElementById("meeting-result-area");
  
  if (selected.length < 2) {
    resultDiv.innerHTML = `<div class="text-danger p-3 text-center">援먯궗瑜?2紐??댁긽 ?좏깮?섏꽭??</div>`;
    return;
  }

  let available = [];
  let reasonsHtml = `<div class="mt-3"><div class="unavailable-box"><h4 class="text-danger mb-3 font-bold"><i class="bi bi-info-circle"></i> 遺덇? ?ъ쑀 ?덈궡</h4><div class="d-flex flex-column gap-2">`;
  let hasReasons = false;

  for (let c = 1; c < headerRow.length; c++) {
    let busyReasons = [];
    selected.forEach(s => {
      let r = fullData.findIndex(row => row[0] === s);
      if (r === -1) return;
      let isEx = isExcluded(s, c);
      let hasClass = !isFree(fullData[r][c]);
      if (hasClass) busyReasons.push(`<span class="badge bg-secondary">${s} (?섏뾽)</span>`);
      if (isEx) busyReasons.push(`<span class="badge bg-danger">${s} (援먯껜遺덇?)</span>`);
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
    resultDiv.innerHTML = `<div class="text-danger text-center p-3 font-bold">紐⑤몢 怨듦컯???쒓컙???놁뒿?덈떎.</div>` + (hasReasons ? reasonsHtml : "");
  } else {
    resultDiv.innerHTML = `
      <div id="copyArea" class="glass-panel" style="background: rgba(25, 135, 84, 0.1); border-color: var(--success-color);">
        <div class="font-bold text-success mb-2">???묒쓽??媛???쒓컙 ?덈궡</div>
        <div>??<b>李몄꽍??</b> ${selected.join(', ')}</div>
        <div class="mt-1">??<b>媛???쒓컙:</b> <span class="text-primary font-bold">${available.join(', ')}</span></div>
      </div>
      <button id="btn-copy-meeting" class="btn btn-outline-success mt-2 w-100"><i class="bi bi-clipboard"></i> 寃곌낵 蹂듭궗?섍린</button>
    ` + (hasReasons ? reasonsHtml : "");
    
    document.getElementById("btn-copy-meeting").addEventListener("click", () => {
      navigator.clipboard.writeText(document.getElementById("copyArea").innerText).then(() => alert("蹂듭궗 ?꾨즺!"));
    });
  }
});

// Exclusion Tab
function renderExclusionTab() {
  const gridArea = document.getElementById("exclusion-grid-area");
  gridArea.innerHTML = generateTableHtml("toggleExclusion");
  updateExclusionSummary();
}

window.toggleExclusionCell = (teacher, colIndex) => {
  let exclusions = localState[`semester${currentSemester}`].exclusions;
  if (!exclusions[teacher]) exclusions[teacher] = [];
  
  let idx = exclusions[teacher].indexOf(colIndex);
  if (idx > -1) exclusions[teacher].splice(idx, 1);
  else exclusions[teacher].push(colIndex);
  
  saveLocalState();
  renderExclusionTab();
  renderTimetables(); // Update main timetable as well
};

function updateExclusionSummary() {
  const sumArea = document.getElementById("exclusion-summary");
  let allExclusions = localState[`semester${currentSemester}`].exclusions;
  
  let count = 0;
  for (let t in allExclusions) {
    if (allExclusions[t].length > 0) count += allExclusions[t].length;
  }
  
  let summaryHtml = `<div class="p-2 mb-2 font-bold text-primary">?꾩옱 珥?<b>${count}嫄?/b>??援먯껜 遺덇? ?댁뿭???ㅼ젙?섏뼱 ?덉뒿?덈떎.</div>`;
  
  // Render overall Exclusion Grid View
  let gridHtml = `
    <h4 class="mt-4 mb-3 border-top pt-4"><i class="bi bi-calendar-x text-danger"></i> ?꾩껜 援먯껜 遺덇? ?꾪솴??/h4>
    <table class="table table-sm text-center" style="font-size: 0.85rem; background: white;">
      <thead>
        <tr>
          <th style="width: 50px;">援먯떆</th>
          ${['??,'??,'??,'紐?,'湲?].map(d => `<th>${d}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;
  
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
  if (confirm("??湲곌린??援먯껜 遺덇? ?ㅼ젙??紐⑤몢 珥덇린?뷀븯?쒓쿋?듬땲源?")) {
    localState[`semester${currentSemester}`].exclusions = {};
    saveLocalState();
    renderExclusionTab();
    renderTimetables();
  }
});

// Download Excel Template
document.getElementById("btn-download-template").addEventListener("click", () => {
  const ws_data = [
    ["援먯궗", "1", "2", "3", "4", "5", "6", "7", "1", "2", "3", "4", "5", "6", "7"],
    ["", "??, "??, "??, "??, "??, "??, "??, "??, "??, "??, "??, "??, "??, "??],
    ["?띻만??, "101 援?뼱", "102 援?뼱", "", "103 援?뼱", "", "", "", "", "101 援?뼱", "102 援?뼱", "", "103 援?뼱", "", ""]
  ];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "?쒓컙?쒖뼇??);
  XLSX.writeFile(wb, "?섏뾽援먯껜?쒓컙???묒떇.xlsx");
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
  alert("寃곕낫媛??λ컮援щ땲???닿꼈?듬땲??");
};

window.removeFromCart = (id) => {
  let cart = localState[`semester${currentSemester}`].cart;
  localState[`semester${currentSemester}`].cart = cart.filter(item => item.id !== id);
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
    return `${grade}?숇뀈 ${classNum}諛?${subj}`;
  }
  return str;
}

function renderCartTab() {
  const cartList = document.getElementById("cart-list-area");
  let cart = localState[`semester${currentSemester}`].cart;
  if (!cart || cart.length === 0) {
    cartList.innerHTML = `<div class="text-center py-5 text-muted">?λ컮援щ땲媛 鍮꾩뼱 ?덉뒿?덈떎. 留ㅼ묶 寃곌낵?먯꽌 ?댁뿭???댁븘二쇱꽭??</div>`;
    return;
  }
  
  let html = `
    <div class="mb-3 text-end">
      <button class="btn btn-sm btn-outline-primary" onclick="copyHwpTable()"><i class="bi bi-clipboard-check"></i> ?쒓? ?묒떇 蹂듭궗?섍린</button>
      <p class="text-muted text-sm mt-1">??'?쒓? ?묒떇 蹂듭궗?섍린' 踰꾪듉???꾨Ⅸ ?? ?쒓?(HWP)??遺숈뿬?ｊ린(Ctrl+V) ?섏꽭??</p>
    </div>
    <div id="hwp-table-container" style="padding: 20px; background: white; color: black; border: 1px solid #ccc;">
      <div style="font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 20px;">寃곌컯?쇰줈 ?명븳 蹂닿컯 怨꾪쉷</div>
      <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11pt; border: 2px solid black;">
        <thead>
          <tr>
            <th style="border: 1px solid black; padding: 8px; width: 15%; font-weight: bold;">寃곌컯援먯궗</th>
            <th style="border: 1px solid black; padding: 8px; width: 10%; font-weight: bold;">?쇱옄</th>
            <th style="border: 1px solid black; padding: 8px; width: 10%; font-weight: bold;">援먯떆</th>
            <th style="border: 1px solid black; padding: 8px; width: 25%; font-weight: bold;">?섏뾽</th>
            <th style="border: 1px solid black; padding: 8px; width: 40%; font-weight: bold;">蹂닿컯 (援먯껜 / ?媛? 怨꾪쉷</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  cart.forEach((c) => {
    let parsedMySubj = parseSubjectForHwp(c.mySubject);
    let mySubjStr = parsedMySubj ? parsedMySubj : c.mySubject;
    let dayStr = c.myPeriod.replace(/[0-9\s]/g, '');
    let periodStr = c.myPeriod.replace(/[^0-9]/g, '');
    let dateStr = "(  ?? ??";
    
    if (c.type === "swap") {
      let parsedPSubj = parseSubjectForHwp(c.partnerSubject);
      let pSubjStr = parsedPSubj ? parsedPSubj : c.partnerSubject;
      let pDayStr = c.partnerPeriod.replace(/[0-9\s]/g, '');
      let pPeriodStr = c.partnerPeriod.replace(/[^0-9]/g, '');
      let pDateStr = "(  ?? ??";
      
      html += `
        <tr>
          <td style="border: 1px solid black; padding: 8px;" rowspan="2">${c.myName}</td>
          <td style="border: 1px solid black; padding: 8px;">${dayStr}?붿씪<br>${dateStr}</td>
          <td style="border: 1px solid black; padding: 8px;">${periodStr}</td>
          <td style="border: 1px solid black; padding: 8px;">${mySubjStr}</td>
          <td style="border: 1px solid black; padding: 8px;">?섏뾽援먯껜 ??${c.partnerName} (${pDayStr}?붿씪 ${pPeriodStr}援먯떆)</td>
        </tr>
        <tr>
          <td style="border: 1px solid black; padding: 8px;">${pDayStr}?붿씪<br>${pDateStr}</td>
          <td style="border: 1px solid black; padding: 8px;">${pPeriodStr}</td>
          <td style="border: 1px solid black; padding: 8px;">${pSubjStr}</td>
          <td style="border: 1px solid black; padding: 8px;">?섏뾽援먯껜 ??${c.partnerName} (${dayStr}?붿씪 ${periodStr}援먯떆)</td>
        </tr>
      `;
    } else {
      html += `
        <tr>
          <td style="border: 1px solid black; padding: 8px;">${c.myName}</td>
          <td style="border: 1px solid black; padding: 8px;">${dayStr}?붿씪<br>${dateStr}</td>
          <td style="border: 1px solid black; padding: 8px;">${periodStr}</td>
          <td style="border: 1px solid black; padding: 8px;">${mySubjStr}</td>
          <td style="border: 1px solid black; padding: 8px;">?媛???${c.partnerName}</td>
        </tr>
      `;
    }
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
    alert("?쒓? ?묒떇??蹂듭궗?섏뿀?듬땲?? Ctrl+V濡?遺숈뿬?ｌ쑝?몄슂.");
  } catch (err) { alert("蹂듭궗 ?ㅽ뙣"); }
  window.getSelection().removeAllRanges();
};

document.getElementById("btn-clear-cart").addEventListener("click", () => {
  if(confirm("?λ컮援щ땲瑜?鍮꾩슦?쒓쿋?듬땲源?")) {
    localState[`semester${currentSemester}`].cart = [];
    saveLocalState();
    renderCartTab();
  }
});

init();

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
  
  // ÎπÑÎ?Î≤àÌò∏ ?êÎèô Î°úÍ∑∏??Í∏∞Îä• ?úÍ±∞ (Îß§Î≤à ?ÖÎ†•?òÎèÑÎ°?Í∞ïÏ†ú)
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
  if (confirm("Í∞úÏù∏ ?§Ï†ï(?†ÌÉù??ÍµêÏÇ¨, ÍµêÏ≤¥ Î∂àÍ? ?§Ï†ï, Í≤∞Î≥¥Í∞??•Î∞îÍµ¨Îãà)??Ï¥àÍ∏∞?îÌïò?úÍ≤†?µÎãàÍπ?")) {
    localState.semester1 = { selectedTeachers: [], exclusions: {}, cart: [] };
    localState.semester2 = { selectedTeachers: [], exclusions: {}, cart: [] };
    saveLocalState();
    alert("Ï¥àÍ∏∞?îÎêò?àÏäµ?àÎã§.");
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
  const loadingHtml = `<div class="text-center py-5 text-muted">?∞Ïù¥?∞Î? Î∂àÎü¨?§Îäî Ï§ëÏûÖ?àÎã§...</div>`;
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
  const emptyHtml = `<div class="text-center py-5 text-muted">?Ä?•Îêú ?úÍ∞Ñ???∞Ïù¥?∞Í? ?ÜÏäµ?àÎã§. Í¥ÄÎ¶¨Ïûê ??óê???∞Ïù¥?∞Î? ?ÖÎ°ú?úÌïò?∏Ïöî.</div>`;
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
    let newHeader = [dayRow[0] || 'ÍµêÏÇ¨'];
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
  return v === "" || v === "√ó" || v === "x";
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
    let dCls = hStr.includes("??) ? "day-mon" : hStr.includes("??) ? "day-tue" :
               hStr.includes("??) ? "day-wed" : hStr.includes("Î™?) ? "day-thu" :
               hStr.includes("Í∏?) ? "day-fri" : "";
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
  showModal("?òÏóÖ ÍµêÏ≤¥ Îß§Ïπ≠ Í≤∞Í≥º", partners, 'swap', myName, myPeriod, rawSubject);
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
  showModal("?ÄÍ∞?Îß§Ïπ≠ Í≤∞Í≥º", partners, 'cover', myName, myPeriod, rawSubject);
}

function showModal(title, partners, mode, myName, myPeriod, rawSubject) {
  modalTitle.textContent = title;
  
  if (partners.length === 0) {
    modalBody.innerHTML = `<div class="text-center text-muted py-4">Í∞Ä?•Ìïú ÍµêÏÇ¨Í∞Ä ?ÜÏäµ?àÎã§.</div>`;
    modal.classList.add("active");
    return;
  }
  
  let html = `<div class="d-flex flex-column gap-3">`;
  partners.forEach((p, idx) => {
    let cardHtml = `
      <div class="glass-panel" style="border: 1px solid #ccc; border-radius: 8px; padding: 15px; background: white;">
        <h5 class="text-success font-bold mb-3"><i class="bi bi-check-circle-fill"></i> ${p.name} ?†ÏÉù?òÍ≥º ${mode === 'swap' ? 'ÍµêÏ≤¥' : '?ÄÍ∞?} Í∞Ä??/h5>
        
        <div class="d-flex justify-between align-center mb-3" style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 10px 20px;">
          <div class="flex-1 text-center font-bold" style="font-size: 1.1rem;">
            ?òÏùò <span class="text-danger">${myPeriod} [${rawSubject}]</span> ??
            ${mode === 'swap' ? `${p.name}T??<span class="text-primary">${p.pPeriod} [${p.pSubject}]</span>` : `<span class="text-primary">${p.name} ?†ÏÉù??/span>Íª?} 
            ${mode === 'swap' ? 'ÍµêÏ≤¥' : '?ÄÍ∞?} ?îÏ≤≠
          </div>
          <button class="btn btn-sm btn-primary btn-add-cart ms-3" style="min-width: 120px;" 
                  data-type="${mode}" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" 
                  data-pname="${p.name}" data-pperiod="${p.pPeriod || ''}" data-psubj="${p.pSubject || ''}">
            <i class="bi bi-cart-plus"></i> ?•Î∞îÍµ¨Îãà ?¥Í∏∞
          </button>
        </div>
        
        <div style="overflow-x: hidden; width: 100%;">
          <table class="table table-sm table-bordered text-center" style="font-size: 0.75rem; width: 100%; table-layout: fixed; margin-bottom: 0; word-break: keep-all;">
            <thead class="bg-light">
              <tr>
                <th style="width: 50px;">ÍµêÏÇ¨</th>
                ${headerRow.slice(1).map(h => `<th class="${getDayClass(h)}">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <!-- ?òÏùò ?úÍ∞Ñ??-->
              <tr>
                <td class="font-bold bg-light" style="vertical-align: middle;">${myName}</td>
                ${headerRow.slice(1).map(h => {
                  let subj = getTeacherSubject(myName, h) || "";
                  let display = isFree(subj) ? "" : formatSubject(subj);
                  let cellStyle = "";
                  
                  if (h === myPeriod) {
                    cellStyle = "background-color: #dc3545 !important; color: white !important; font-weight: bold;";
                  } else if (mode === 'swap' && h === p.pPeriod) {
                    cellStyle = "background-color: #0d6efd !important; color: white !important; font-weight: bold;";
                    display = "Í≥µÍ∞ï";
                  }
                  return `<td class="${getDayClass(h)}" style="${cellStyle}">${display}</td>`;
                }).join('')}
              </tr>
              <!-- ?ÅÎ?Î∞??úÍ∞Ñ??-->
              <tr>
                <td class="font-bold bg-light" style="vertical-align: middle;">${p.name}</td>
                ${headerRow.slice(1).map(h => {
                  let subj = getTeacherSubject(p.name, h) || "";
                  let display = isFree(subj) ? "" : formatSubject(subj);
                  let cellStyle = "";
                  
                  if (h === myPeriod) {
                    cellStyle = "background-color: #0d6efd !important; color: white !important; font-weight: bold;";
                    display = "Í≥µÍ∞ï";
                  } else if (mode === 'swap' && h === p.pPeriod) {
                    cellStyle = "background-color: #dc3545 !important; color: white !important; font-weight: bold;";
                  }
                  return `<td class="${getDayClass(h)}" style="${cellStyle}">${display}</td>`;
                }).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    html += cardHtml;
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

  // (Timetable toggles removed since they are now always visible)
  
  modal.classList.add("active");
}

function generatePartnerTimetableHtml(teacherName) {
  let html = `<table class="table table-sm text-center" style="font-size: 0.85rem;">
    <thead>
      <tr>
        <th style="width: 40px;">ÍµêÏãú</th>
        <th class="day-mon">??/th><th class="day-tue">??/th><th class="day-wed">??/th><th class="day-thu">Î™?/th><th class="day-fri">Í∏?/th>
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

function getTeacherSubject(name, periodStr) {
  const row = fullData.find(r => r[0] === name);
  if (!row) return null;
  const colIndex = headerRow.indexOf(periodStr);
  if (colIndex === -1) return null;
  return row[colIndex] || null;
}

function getDayClass(periodStr) {
  if (periodStr.startsWith("??)) return "day-mon";
  if (periodStr.startsWith("??)) return "day-tue";
  if (periodStr.startsWith("??)) return "day-wed";
  if (periodStr.startsWith("Î™?)) return "day-thu";
  if (periodStr.startsWith("Í∏?)) return "day-fri";
  return "";
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
        alert("ÎπÑÎ?Î≤àÌò∏Í∞Ä ?Ä?∏Ïäµ?àÎã§.");
      }
    }
  } catch(e) {
    alert("?§Î•ò Î∞úÏÉù: " + e.message);
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
    alert("?ôÍ∏∞ ?ÑÌôò Í∏∞Ï??ºÏù¥ ?Ä?•Îêò?àÏäµ?àÎã§.");
    autoSelectSemester();
  });
}

// Change Admin Password
document.getElementById("btn-change-admin-pwd").addEventListener("click", async () => {
  const newPwd = document.getElementById("new-admin-password").value;
  if (!newPwd) return alert("ÎπÑÎ?Î≤àÌò∏Î•??ÖÎ†•?òÏÑ∏??");
  try {
    await setDoc(doc(db, "settings", "admin"), { password: newPwd });
    alert("Í¥ÄÎ¶¨Ïûê ÎπÑÎ?Î≤àÌò∏Í∞Ä Î≥ÄÍ≤ΩÎêò?àÏäµ?àÎã§.");
    document.getElementById("new-admin-password").value = "";
  } catch(e) {
    alert("?§Î•ò: " + e.message);
  }
});

// Excel Upload
document.getElementById("btn-upload-excel").addEventListener("click", () => {
  const fileInput = document.getElementById("excel-upload");
  if (!fileInput.files.length) return alert("?åÏùº???†ÌÉù?òÏÑ∏??");
  
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
      alert("?±Í≥µ?ÅÏúºÎ°??ÖÎ°ú?úÎêò?àÏäµ?àÎã§!");
      location.reload();
    } catch(err) {
      alert("Ï≤òÎ¶¨ ?§Î•ò: " + err.message);
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
    meetingTimetableArea.innerHTML = `<div class="text-center py-3 text-muted">ÍµêÏÇ¨Î•??†ÌÉù?¥Ï£º?∏Ïöî.</div>`;
    return;
  }
  
  let previewHtml = `<div style="overflow-x: auto; width: 100%;">
    <table class="table table-sm table-bordered text-center" style="font-size: 0.8rem; min-width: 1500px; background-color: white;">
      <thead class="bg-light">
        <tr>
          <th style="width: 70px; vertical-align: middle;">ÍµêÏÇ¨</th>
          ${headerRow.slice(1).map(h => `<th class="${getDayClass(h)}" style="vertical-align: middle;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>`;
      
  for (let t of selected) {
    previewHtml += `<tr>
      <td class="font-bold bg-light" style="vertical-align: middle;">${t}</td>
      ${headerRow.slice(1).map((h, i) => {
        let subj = getTeacherSubject(t, h) || "";
        let display = isFree(subj) ? "" : formatSubject(subj);
        let ex = isExcluded(t, i + 1) ? `<br><span class="text-danger" style="font-size: 0.7rem;">(Î∂àÍ?)</span>` : "";
        return `<td class="${getDayClass(h)}">${display}${ex}</td>`;
      }).join('')}
    </tr>`;
  }
  
  previewHtml += `</tbody></table></div>`;
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
      alert("ÎπÑÍµê??ÍµêÏÇ¨Î•?2Î™??¥ÏÉÅ ?†ÌÉù?òÏÑ∏??");
      return;
    }
    
    let commonFree = [];
    let reasonsHtml = `<ul class="list-group list-group-flush mt-3" style="font-size: 0.85rem; text-align: left;">`;
    let hasReasons = false;

    for (let i = 1; i < headerRow.length; i++) {
      let isAllFree = true;
      let reasonsForPeriod = [];
      
      for (let t of selected) {
        let row = fullData.find(r => r[0] === t);
        if (!row) {
          isAllFree = false;
          reasonsForPeriod.push(`[${t}] ?∞Ïù¥???ÜÏùå`);
          continue;
        }
        
        let subj = row[i];
        if (!isFree(subj)) {
          isAllFree = false;
          reasonsForPeriod.push(`[${t}] ${formatSubject(subj)}`);
        }
        if (isExcluded(t, i)) {
          isAllFree = false;
          reasonsForPeriod.push(`[${t}] ÍµêÏ≤¥ Î∂àÍ?`);
        }
      }
      
      if (isAllFree) {
        commonFree.push(headerRow[i]);
      } else {
        hasReasons = true;
        reasonsHtml += `<li class="list-group-item bg-transparent border-0 py-1">
          <strong>${headerRow[i]}:</strong> <span class="text-muted">${reasonsForPeriod.join(', ')}</span>
        </li>`;
      }
    }
    reasonsHtml += `</ul>`;
    
    let html = "";
    if (commonFree.length > 0) {
      html += `<div class="alert alert-success m-0 font-bold mb-3">
        <i class="bi bi-check-circle-fill"></i> Î™®Îëê Í≥µÍ∞ï???úÍ∞Ñ: ${commonFree.join(", ")}
      </div>`;
    } else {
      html += `<div class="alert alert-warning m-0 font-bold mb-3">
        <i class="bi bi-exclamation-triangle-fill"></i> Î™®Îëê Í≥µÍ∞ï???úÍ∞Ñ???ÜÏäµ?àÎã§.
      </div>`;
    }
    
    if (hasReasons) {
      html += `<div class="mt-2 text-start bg-white p-3 border rounded shadow-sm">
        <h6 class="font-bold text-primary mb-2 border-bottom pb-2"><i class="bi bi-info-circle"></i> Í≥µÍ∞ï???ÑÎãå ?¨Ïú† (?ÑÏ≤¥ ÍµêÏãú)</h6>
        <div style="max-height: 200px; overflow-y: auto;">
          ${reasonsHtml}
        </div>
      </div>`;
    }
    
    meetingResultArea.innerHTML = html;
    updateMeetingPreview();
  });
}

if (btnClearMeeting) {
  btnClearMeeting.addEventListener("click", () => {
    localState[`semester${currentSemester}`].selectedTeachers = [];
    saveLocalState();
    renderMeetingTab();
    meetingTimetableArea.innerHTML = `<div class="text-center py-3 text-muted">ÍµêÏÇ¨Î•??†ÌÉù?¥Ï£º?∏Ïöî.</div>`;
    meetingResultArea.innerHTML = `ÍµêÏÇ¨Î•?2Î™??¥ÏÉÅ ?†ÌÉù????[Í≥µÍ∞ï Ï∞æÍ∏∞]Î•??ÑÎ•¥?∏Ïöî.`;
  });
}

if (btnCopyMeeting) {
  btnCopyMeeting.addEventListener("click", () => {
    const selected = localState[`semester${currentSemester}`].selectedTeachers || [];
    if (selected.length < 2) return alert("Î®ºÏ? Í≥µÍ∞ï??Ï∞æÏïÑÏ£ºÏÑ∏??");
    const text = meetingResultArea.innerText;
    navigator.clipboard.writeText(`[?ëÏùò??Í≥µÍ∞ï ?úÍ∞Ñ]\nÏ∞∏Ïó¨: ${selected.join(", ")}\nÍ≤∞Í≥º: ${text.trim()}`)
      .then(() => alert("Î≥µÏÇ¨?òÏóà?µÎãà??"))
      .catch(e => alert("Î≥µÏÇ¨ ?§Ìå®: " + e));
  });
}

// Exclusion Tab
window.renderExclusionTab = function() {
  const gridArea = document.getElementById("exclusion-grid-area");
  if (!teachers || teachers.length === 0) {
    gridArea.innerHTML = `<div class="text-center py-4 text-muted">?∞Ïù¥?∞Í? ?ÜÏäµ?àÎã§.</div>`;
    return;
  }
  
  let html = `<table class="table table-sm text-center" style="font-size: 0.85rem;"><thead><tr><th>ÍµêÏÇ¨Î™?/th>`;
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
  
  let html = `<h4 class="mb-2 font-bold"><i class="bi bi-list-check"></i> ?§Ï†ï???¥Ïó≠ ?îÏïΩ (?êÎèô ?Ä?•Îê®)</h4>
              <table class="table table-sm table-bordered mt-2 text-center" style="font-size: 0.9rem; background-color: #fff;">
                <thead class="bg-light">
                  <tr>
                    <th>ÍµêÏãú</th>
                    <th class="day-mon">??/th>
                    <th class="day-tue">??/th>
                    <th class="day-wed">??/th>
                    <th class="day-thu">Î™?/th>
                    <th class="day-fri">Í∏?/th>
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
  
  sumArea.innerHTML = !hasAnyExclusion ? `<div class="text-muted">?§Ï†ï??ÍµêÏ≤¥ Î∂àÍ? ?¥Ïó≠???ÜÏäµ?àÎã§.</div>` : html;
};

document.getElementById("btn-clear-all-exclusions").addEventListener("click", () => {
  if (confirm("??Í∏∞Í∏∞??ÍµêÏ≤¥ Î∂àÍ? ?§Ï†ï??Î™®Îëê Ï¥àÍ∏∞?îÌïò?úÍ≤†?µÎãàÍπ?")) {
    localState[`semester${currentSemester}`].exclusions = {};
    saveLocalState();
    renderExclusionTab();
    renderTimetables();
  }
});

// Download Excel Template
document.getElementById("btn-download-template").addEventListener("click", () => {
  const ws_data = [
    ["ÍµêÏÇ¨", "1", "2", "3", "4", "5", "6", "7", "1", "2", "3", "4", "5", "6", "7"],
    ["", "??, "??, "??, "??, "??, "??, "??, "??, "??, "??, "??, "??, "??, "??],
    ["?çÍ∏∏??, "101 Íµ?ñ¥", "102 Íµ?ñ¥", "", "103 Íµ?ñ¥", "", "", "", "", "101 Íµ?ñ¥", "102 Íµ?ñ¥", "", "103 Íµ?ñ¥", "", ""]
  ];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "?úÍ∞Ñ?úÏñë??);
  XLSX.writeFile(wb, "?òÏóÖÍµêÏ≤¥?úÍ∞Ñ???ëÏãù.xlsx");
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
  alert("Í≤∞Î≥¥Í∞??•Î∞îÍµ¨Îãà???¥Í≤º?µÎãà??");
};

window.removeFromCart = (id) => {
  let cart = localState[`semester${currentSemester}`].cart;
  localState[`semester${currentSemester}`].cart = cart.filter(item => item.id !== id);
  saveLocalState();
  renderCartTab();
};

document.getElementById("btn-clear-cart").addEventListener("click", () => {
  if(confirm("?•Î∞îÍµ¨ÎãàÎ•?ÎπÑÏö∞?úÍ≤†?µÎãàÍπ?")) {
    localState[`semester${currentSemester}`].cart = [];
    saveLocalState();
    renderCartTab();
  }
});

window.copyHwpTable = () => {
  const cart = localState[`semester${currentSemester}`].cart;
  if (!cart || cart.length === 0) {
    alert("Î≥µÏÇ¨???¥Ïö©???ÜÏäµ?àÎã§.");
    return;
  }
  
  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.left = "-9999px";
  
  let tableHtml = `<table border="1" style="border-collapse: collapse;"><tbody>`;
  
  cart.forEach(c => {
    let typeStr = c.type === 'swap' ? '?òÏóÖÍµêÏ≤¥' : 'Í≤∞Î≥¥Í∞?;
    let myDay = c.myPeriod.replace(/[0-9]/g, '');
    let myNum = c.myPeriod.replace(/[^0-9]/g, '');
    
    let parsedMy = parseSubjectAndClass(c.mySubject);
    let myClass = parsedMy.cls;
    let mySubj = parsedMy.subj;
    
    let pDay = "", pNum = "", pClass = "", pSubj = "";
    let arrow = c.type === 'swap' ? "?? : "??;
    
    if (c.type === 'swap') {
      pDay = c.partnerPeriod.replace(/[0-9]/g, '');
      pNum = c.partnerPeriod.replace(/[^0-9]/g, '');
      let parsedP = parseSubjectAndClass(c.partnerSubject);
      pClass = parsedP.cls;
      pSubj = parsedP.subj;
    } else {
      pDay = myDay;
      pNum = myNum;
      pClass = myClass;
      pSubj = mySubj;
    }
    
    tableHtml += `
      <tr>
        <td>${typeStr}</td>
        <td></td>
        <td>${myDay}</td>
        <td>${myNum}</td>
        <td>${myClass}</td>
        <td>${mySubj}</td>
        <td>${c.myName.replace(/\(.*\)/g, '').trim()}</td>
        <td>${arrow}</td>
        <td></td>
        <td>${pDay}</td>
        <td>${pNum}</td>
        <td>${pClass}</td>
        <td>${pSubj}</td>
        <td>${c.partnerName.replace(/\(.*\)/g, '').trim()}</td>
      </tr>
    `;
  });
  
  tableHtml += `</tbody></table>`;
  tempDiv.innerHTML = tableHtml;
  document.body.appendChild(tempDiv);
  
  const range = document.createRange();
  range.selectNodeContents(tempDiv);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  
  try {
    document.execCommand('copy');
    alert("?∞Ïù¥???âÎßå Î≥µÏÇ¨?òÏóà?µÎãà?? ?úÍ?(HWP) ???àÏùò Ï≤?Î≤àÏß∏ Ïπ∏ÏùÑ ?¥Î¶≠?òÍ≥† ??ñ¥?∞Í∏∞Î°?Î∂ôÏó¨?£Í∏∞(Ctrl+V) ?òÏÑ∏??");
  } catch (err) { 
    alert("Î≥µÏÇ¨ ?§Ìå®: " + err); 
  }
  
  sel.removeAllRanges();
  document.body.removeChild(tempDiv);
};

function parseSubjectAndClass(rawStr) {
  if (!rawStr) return { cls: "", subj: "" };
  let s = rawStr.replace(/<br>/g, " ").replace(/<[^>]*>?/gm, '').trim();
  let m = s.match(/^(\d{3})\s*(.*)$/);
  if (m) {
    let digits = m[1];
    let rest = m[2].trim();
    let cls = digits.charAt(0) + "-" + parseInt(digits.substring(1), 10);
    return { cls: cls, subj: rest };
  } else {
    return { cls: "", subj: s };
  }
}

function renderCartTab() {
  const cart = localState[`semester${currentSemester}`].cart;
  const container = document.getElementById("cart-list-area");
  
  if (!cart || cart.length === 0) {
    container.innerHTML = `<div class="text-center py-5 text-muted">?•Î∞îÍµ¨ÎãàÍ∞Ä ÎπÑÏñ¥ ?àÏäµ?àÎã§. Îß§Ïπ≠ Í≤∞Í≥º?êÏÑú ?¥Ïó≠???¥ÏïÑÏ£ºÏÑ∏??</div>`;
    return;
  }
  
  let html = `
    <div class="mb-3 text-end">
      <button class="btn btn-sm btn-outline-primary" onclick="copyHwpTable()"><i class="bi bi-clipboard-check"></i> ?úÍ? ?ëÏãù Î≥µÏÇ¨?òÍ∏∞</button>
      <p class="text-muted text-sm mt-1">???úÍ?(HWP) ???àÏùò Ï≤?Î≤àÏß∏ Ïπ∏ÏùÑ ?¥Î¶≠?òÍ≥† ?Ä ??ñ¥?∞Í∏∞Î°?Î∂ôÏó¨?£Í∏∞(Ctrl+V) ?òÏÑ∏??</p>
    </div>
    <div id="hwp-table-container" style="padding: 20px; background: white; color: black; border: 1px solid #ccc; overflow-x: auto;">
      <div style="font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 20px;">Í≤∞Î≥¥Í∞?Î∞??òÏóÖÍµêÏ≤¥ Í≥ÑÌöç</div>
      
      <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: center; font-size: 11pt; border: 2px solid black;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">Í≤∞Î≥¥Í∞??òÏóÖÍµêÏ≤¥</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">?ºÏûê</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">?îÏùº</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">ÍµêÏãú</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">?ôÎ∞ò</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">Í≥ºÎ™©</th>
            <th style="border: 1px solid black; padding: 4px; font-weight: bold;">±≥ªÁ∏Ì</th>
          </tr>
        </thead>
        <tbody>
  \;
  
  cart.forEach(c => {
    let typeStr = c.type === 'swap' ? 'ºˆæ˜±≥√º' : '∞·∫∏∞≠';
    let myDay = c.myPeriod.replace(/[0-9]/g, '');
    let myNum = c.myPeriod.replace(/[^0-9]/g, '');
    
    let parsedMy = parseSubjectAndClass(c.mySubject);
    let myClass = parsedMy.cls;
    let mySubj = parsedMy.subj;
    
    let pDay = "", pNum = "", pClass = "", pSubj = "";
    let arrow = c.type === 'swap' ? "°Í" : "°Ê";
    
    if (c.type === 'swap') {
      pDay = c.partnerPeriod.replace(/[0-9]/g, '');
      pNum = c.partnerPeriod.replace(/[^0-9]/g, '');
      let parsedP = parseSubjectAndClass(c.partnerSubject);
      pClass = parsedP.cls;
      pSubj = parsedP.subj;
    } else {
      pDay = myDay;
      pNum = myNum;
      pClass = myClass;
      pSubj = mySubj;
    }
    
    html += \
      <tr>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
        <td style="border: 1px solid black; padding: 4px;">\</td>
      </tr>
    \;
  });
  
  html += \</tbody></table></div>\;
  
  html += \<div class="mt-3 cart-summary-list"><table class="table"><tbody>\;
  cart.forEach(c => {
    let typeBadge = c.type === 'swap' ? '<span class="badge bg-success">±≥√º</span>' : '<span class="badge bg-info">¥Î∞≠</span>';
    html += \<tr>
      <td data-label="">\</td>
      <td data-label="±≥ªÁ:" class="font-bold">\</td>
      <td data-label="ªÛ¥Î±≥ªÁ:" class="text-primary font-bold">\</td>
      <td data-label="≥ª ºˆæ˜:">\<br><small>\</small></td>
      <td data-label="±≥»Øºˆæ˜:">\</td>
      <td data-label=""><button class="btn btn-sm btn-outline-danger w-100" onclick="removeFromCart('\')">ªË¡¶</button></td>
    </tr>\;
  });
  html += \</tbody></table></div>\;
  
  container.innerHTML = html;
}

document.getElementById("btn-download-plan").addEventListener("click", () => {
  const cart = localState[\semester\\].cart;
  if (!cart || cart.length === 0) {
    return alert("¿ÂπŸ±∏¥œ∞° ∫ÒæÓ ¿÷Ω¿¥œ¥Ÿ.");
  }
  
  // Create an Excel Sheet that fits on one page and mimics the HWpx form
  const ws_data = [];
  
  // Header
  ws_data.push(["∞· ∫∏ ∞≠  ∞Ë »π º≠"]);
  ws_data.push([""]); // Empty row
  
  // Construct the table
  ws_data.push(["±∏ ∫–", "ø¯ºˆæ˜±≥ªÁ", "∞˙∏Ò π◊ «–π›", "∞·∞≠(∫Ø∞Ê¿¸) ¿œΩ√", "∫∏∞≠±≥ªÁ", "∫∏∞≠(∫Ø∞Ê»ƒ) ¿œΩ√", "ªÁ ¿Ø"]);
  
  cart.forEach(item => {
    let typeStr = item.type === 'swap' ? '±≥√º' : '¥Î∞≠';
    let mySubj = item.mySubject.replace(/<br>/g, " ");
    let partnerTime = item.type === 'swap' ? item.partnerPeriod : '¥Î∞≠';
    
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
  ws_data.push(["¿ßøÕ ∞∞¿Ã ∞·∫∏∞≠ ∞Ë»πº≠∏¶ ¡¶√‚«’¥œ¥Ÿ."]);
  ws_data.push([""]);
  const today = new Date();
  ws_data.push([\2026≥‚  \ø˘  \¿œ\]);
  ws_data.push([""]);
  ws_data.push(["¡¶√‚¿⁄:                   (¿Œ)"]);
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  
  // Set column widths
  ws["!cols"] = [
    { wch: 8 },  // ±∏∫–
    { wch: 12 }, // ø¯ºˆæ˜±≥ªÁ
    { wch: 15 }, // ∞˙∏Ò π◊ «–π›
    { wch: 18 }, // ∞·∞≠¿œΩ√
    { wch: 12 }, // ∫∏∞≠±≥ªÁ
    { wch: 18 }, // ∫∏∞≠¿œΩ√
    { wch: 15 }  // ªÁ¿Ø
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
  XLSX.utils.book_append_sheet(wb, ws, "∞·∫∏∞≠∞Ë»πº≠");
  
  XLSX.writeFile(wb, \∞·∫∏∞≠∞Ë»πº≠_\.xlsx\);
});

init();

// Mobile UI Day Selector Logic
window.setMobileDay = (day, btn) => {
  if (btn) {
    const parentGroup = btn.closest('.btn-group');
    if (parentGroup) {
      parentGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  } else {
    // on load
    document.querySelectorAll('.mobile-day-selector .btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mobile-day-selector .btn:first-child').forEach(b => b.classList.add('active'));
  }
  const containerSwap = document.getElementById('table-swap');
  if (containerSwap) containerSwap.className = \	imetable-wrapper glass-panel show-mobile-\\;
  
  const containerCover = document.getElementById('table-cover');
  if (containerCover) containerCover.className = \	imetable-wrapper glass-panel show-mobile-\\;
};

// Initialize mobile day selector & sidebar toggle
window.addEventListener('DOMContentLoaded', () => {
  window.setMobileDay('mon', null);

  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');
  const sidebar = document.getElementById('sidebar');

  if (btnMobileMenu && sidebar) {
    btnMobileMenu.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
    });
  }
  if (btnCloseSidebar && sidebar) {
    btnCloseSidebar.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
    });
  }
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.remove('mobile-open');
      }
    });
  });
});


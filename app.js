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
    e.preventDefault();
    currentSemester = parseInt(e.target.dataset.sem);
    document.querySelectorAll(".semester-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768 && sidebar) {
      sidebar.classList.remove('mobile-open');
    }
    
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
    let extraCls = (j === 0) ? " header-cell" : "";
    dayClasses[j] = `${dCls} ${bCls}${extraCls}`;
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
    let cardHtml = `
      <div class="glass-panel" style="border: 1px solid #ccc; border-radius: 8px; padding: 15px; background: white;">
        <h5 class="text-success font-bold mb-3"><i class="bi bi-check-circle-fill"></i> ${p.name} 선생님과 ${mode === 'swap' ? '교체' : '대강'} 가능</h5>
        
        <div class="d-flex justify-between align-center mb-3" style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 10px 20px;">
          <div class="flex-1 text-center font-bold" style="font-size: 1.1rem;">
            나의 <span class="text-danger">${myPeriod} [${rawSubject}]</span> ↔ 
            ${mode === 'swap' ? `${p.name}T의 <span class="text-primary">${p.pPeriod} [${p.pSubject}]</span>` : `<span class="text-primary">${p.name} 선생님</span>께`} 
            ${mode === 'swap' ? '교체' : '대강'} 요청
          </div>
          <button class="btn btn-sm btn-primary btn-add-cart ms-3" style="min-width: 120px;" 
                  data-type="${mode}" data-myname="${myName}" data-myperiod="${myPeriod}" data-mysubj="${rawSubject}" 
                  data-pname="${p.name}" data-pperiod="${p.pPeriod || ''}" data-psubj="${p.pSubject || ''}">
            <i class="bi bi-cart-plus"></i> 장바구니 담기
          </button>
        </div>
        
        <div class="hide-on-mobile" style="overflow-x: hidden; width: 100%;">
          <table class="table table-sm table-bordered text-center" style="font-size: 0.75rem; width: 100%; table-layout: fixed; margin-bottom: 0; word-break: keep-all;">
            <thead class="bg-light">
              <tr>
                <th style="width: 50px;">교사</th>
                ${headerRow.slice(1).map(h => `<th class="${getDayClass(h)}">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <!-- 나의 시간표 -->
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
                    display = "공강";
                  }
                  return `<td class="${getDayClass(h)}" style="${cellStyle}">${display}</td>`;
                }).join('')}
              </tr>
              <!-- 상대방 시간표 -->
              <tr>
                <td class="font-bold bg-light" style="vertical-align: middle;">${p.name}</td>
                ${headerRow.slice(1).map(h => {
                  let subj = getTeacherSubject(p.name, h) || "";
                  let display = isFree(subj) ? "" : formatSubject(subj);
                  let cellStyle = "";
                  
                  if (h === myPeriod) {
                    cellStyle = "background-color: #0d6efd !important; color: white !important; font-weight: bold;";
                    display = "공강";
                  } else if (mode === 'swap' && h === p.pPeriod) {
                    cellStyle = "background-color: #dc3545 !important; color: white !important; font-weight: bold;";
                  }
                  return `<td class="${getDayClass(h)}" style="${cellStyle}">${display}</td>`;
                }).join('')}
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 모바일 모달 뷰 (각각의 교사별 교체되는 두 요일 모두 렌더링) -->
        <div class="hide-on-pc mt-3" style="width: 100%;">
          ${(()=>{
            let myDayStr = myPeriod.replace(/[0-9]/g, '');
            let pDayStr = mode === 'swap' ? p.pPeriod.replace(/[0-9]/g, '') : myDayStr;
            let daysToRender = (myDayStr === pDayStr) ? [myDayStr] : [myDayStr, pDayStr];
            let periods = [1,2,3,4,5,6,7];
            
            let genTable = (tName, isMy) => {
              let htmlChunk = `
                <div class="mb-3">
                  <div class="font-bold text-start mb-1" style="font-size: 0.9rem; color: #333;"><i class="bi bi-person-fill"></i> ${tName}</div>
                  <table class="table table-bordered mobile-modal-table mb-0">
                    <thead class="bg-light">
                      <tr>
                        <th style="width: 35px;">요일</th>
                        ${periods.map(pr => `<th>${pr}</th>`).join('')}
                      </tr>
                    </thead>
                    <tbody>
              `;
              
              daysToRender.forEach(dayStr => {
                htmlChunk += `<tr><td class="font-bold bg-light" style="vertical-align:middle; font-size:0.8rem;">${dayStr}</td>`;
                periods.forEach(pr => {
                  let h = dayStr + pr;
                  let subj = getTeacherSubject(tName, h) || "";
                  let display = isFree(subj) ? "" : formatSubject(subj);
                  let cellStyle = "";
                  
                  if (h === myPeriod) {
                    cellStyle = isMy ? "background-color: #dc3545 !important; color: white !important; font-weight:bold;" : "background-color: #0d6efd !important; color: white !important; font-weight:bold;";
                    if (!isMy) display = "공강";
                  } else if (mode === 'swap' && h === p.pPeriod) {
                    cellStyle = isMy ? "background-color: #0d6efd !important; color: white !important; font-weight:bold;" : "background-color: #dc3545 !important; color: white !important; font-weight:bold;";
                    if (isMy) display = "공강";
                  }
                  
                  htmlChunk += `<td style="${cellStyle}">${display}</td>`;
                });
                htmlChunk += `</tr>`;
              });
              
              htmlChunk += `</tbody></table></div>`;
              return htmlChunk;
            };
            
            return genTable(myName, true) + genTable(p.name, false);
          })()}
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

function getTeacherSubject(name, periodStr) {
  const row = fullData.find(r => r[0] === name);
  if (!row) return null;
  const colIndex = headerRow.indexOf(periodStr);
  if (colIndex === -1) return null;
  return row[colIndex] || null;
}

function getDayClass(periodStr) {
  if (periodStr.startsWith("월")) return "day-mon";
  if (periodStr.startsWith("화")) return "day-tue";
  if (periodStr.startsWith("수")) return "day-wed";
  if (periodStr.startsWith("목")) return "day-thu";
  if (periodStr.startsWith("금")) return "day-fri";
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
      const errorEl = document.getElementById("admin-login-error");
      if (errorEl) errorEl.classList.add("hidden");
    } else {
      const errorEl = document.getElementById("admin-login-error");
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
  
  let previewHtml = `<div style="overflow-x: auto; width: 100%;">
    <table class="table table-sm table-bordered text-center" style="font-size: 0.8rem; min-width: 1500px; background-color: white;">
      <thead class="bg-light">
        <tr>
          <th style="width: 70px; vertical-align: middle;">교사</th>
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
        let ex = isExcluded(t, i + 1) ? `<br><span class="text-danger" style="font-size: 0.7rem;">(불가)</span>` : "";
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
      alert("비교할 교사를 2명 이상 선택하세요.");
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
          reasonsForPeriod.push(`[${t}] 데이터 없음`);
          continue;
        }
        
        let subj = row[i];
        if (!isFree(subj)) {
          isAllFree = false;
          reasonsForPeriod.push(`[${t}] ${formatSubject(subj)}`);
        }
        if (isExcluded(t, i)) {
          isAllFree = false;
          reasonsForPeriod.push(`[${t}] 교체 불가`);
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
        <i class="bi bi-check-circle-fill"></i> 모두 공강인 시간: ${commonFree.join(", ")}
      </div>`;
    } else {
      html += `<div class="alert alert-warning m-0 font-bold mb-3">
        <i class="bi bi-exclamation-triangle-fill"></i> 모두 공강인 시간이 없습니다.
      </div>`;
    }
    
    if (hasReasons) {
      html += `<div class="mt-2 text-start bg-white p-3 border rounded shadow-sm">
        <h6 class="font-bold text-primary mb-2 border-bottom pb-2"><i class="bi bi-info-circle"></i> 공강이 아닌 사유 (전체 교시)</h6>
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

window.copyHwpTable = () => {
  const cart = localState[`semester${currentSemester}`].cart;
  if (!cart || cart.length === 0) {
    alert("복사할 내용이 없습니다.");
    return;
  }
  
  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.left = "-9999px";
  
  let tableHtml = `<table border="1" style="border-collapse: collapse;"><tbody>`;
  
  cart.forEach(c => {
    let typeStr = c.type === 'swap' ? '수업교체' : '결보강';
    let myDay = c.myPeriod.replace(/[0-9]/g, '');
    let myNum = c.myPeriod.replace(/[^0-9]/g, '');
    
    let parsedMy = parseSubjectAndClass(c.mySubject);
    let myClass = parsedMy.cls;
    let mySubj = parsedMy.subj;
    
    let pDay = "", pNum = "", pClass = "", pSubj = "";
    let arrow = c.type === 'swap' ? "↔" : "→";
    
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
    alert("데이터 행만 복사되었습니다. 한글(HWP) 표 안의 첫 번째 칸을 클릭하고 덮어쓰기로 붙여넣기(Ctrl+V) 하세요.");
  } catch (err) { 
    alert("복사 실패: " + err); 
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
    container.innerHTML = `<div class="text-center py-5 text-muted">장바구니가 비어 있습니다. 매칭 결과에서 내역을 담아주세요.</div>`;
    return;
  }
  
  let html = `
    <div class="mb-3 text-end">
      <button class="btn btn-sm btn-outline-primary" onclick="copyHwpTable()"><i class="bi bi-clipboard-check"></i> 한글 양식 복사하기</button>
      <p class="text-muted text-sm mt-1">※ 한글(HWP) 표 안의 첫 번째 칸을 클릭하고 셀 덮어쓰기로 붙여넣기(Ctrl+V) 하세요.</p>
    </div>
    <div id="hwp-table-container" style="padding: 20px; background: white; color: black; border: 1px solid #ccc; overflow-x: auto;">
      <div style="font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 20px;">결보강 및 수업교체 계획</div>
      
      <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: center; font-size: 11pt; border: 2px solid black;">
        <thead>
          <tr style="background-color: #f2f2f2;">
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
  
  cart.forEach(c => {
    let typeStr = c.type === 'swap' ? '수업교체' : '결보강';
    let myDay = c.myPeriod.replace(/[0-9]/g, '');
    let myNum = c.myPeriod.replace(/[^0-9]/g, '');
    
    let parsedMy = parseSubjectAndClass(c.mySubject);
    let myClass = parsedMy.cls;
    let mySubj = parsedMy.subj;
    
    let pDay = "", pNum = "", pClass = "", pSubj = "";
    let arrow = c.type === 'swap' ? "↔" : "→";
    
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
    
    html += `
      <tr>
        <td style="border: 1px solid black; padding: 4px;">${typeStr}</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;">${myDay}</td>
        <td style="border: 1px solid black; padding: 4px;">${myNum}</td>
        <td style="border: 1px solid black; padding: 4px;">${myClass}</td>
        <td style="border: 1px solid black; padding: 4px;">${mySubj}</td>
        <td style="border: 1px solid black; padding: 4px;">${c.myName.replace(/\(.*\)/g, '').trim()}</td>
        <td style="border: 1px solid black; padding: 4px;">${arrow}</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;">${pDay}</td>
        <td style="border: 1px solid black; padding: 4px;">${pNum}</td>
        <td style="border: 1px solid black; padding: 4px;">${pClass}</td>
        <td style="border: 1px solid black; padding: 4px;">${pSubj}</td>
        <td style="border: 1px solid black; padding: 4px;">${c.partnerName.replace(/\(.*\)/g, '').trim()}</td>
      </tr>
    `;
  });
  
  html += `</tbody></table></div>`;
  
  html += `<div class="mt-3"><table class="table"><tbody>`;
  cart.forEach(c => {
    let typeBadge = c.type === 'swap' ? '<span class="badge bg-success">교체</span>' : '<span class="badge bg-info">대강</span>';
    html += `<tr>
      <td>${typeBadge}</td>
      <td class="font-bold">${c.myName.replace(/\(.*\)/g, '').trim()}</td>
      <td class="text-primary font-bold">${c.partnerName.replace(/\(.*\)/g, '').trim()}</td>
      <td>${c.myPeriod}<br><small>${c.mySubject}</small></td>
      <td>${c.type==='swap' ? c.partnerPeriod+'<br><small>'+c.partnerSubject+'</small>' : '-'}</td>
      <td><button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${c.id}')">삭제</button></td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  
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
      item.myName.replace(/\(.*\)/g, '').trim(),
      mySubj,
      item.myPeriod,
      item.partnerName.replace(/\(.*\)/g, '').trim(),
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
  if (containerSwap) containerSwap.className = `timetable-wrapper glass-panel show-mobile-${day}`;
  
  const containerCover = document.getElementById('table-cover');
  if (containerCover) containerCover.className = `timetable-wrapper glass-panel show-mobile-${day}`;
};

// Initialize mobile day selector & sidebar toggle
window.setMobileDay('mon', null);

const btnMobileMenu = document.getElementById('btn-mobile-menu');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const sidebar = document.getElementById('sidebar');

if (btnMobileMenu && sidebar) {
  btnMobileMenu.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
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

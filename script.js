"use strict";

/* ===== CONFIG ===== */
const PASSCODE = "BETHLEHEMATDAWN";
const SIZE = 16;                 // 16x16: big enough, still readable on phones
const MIN_SELECT = 2;            // must drag at least 2 letters
const WORDS = [
  "BETHLEHEM",
  "INCARNATION",
  "ANNUNCIATION",
  "EPIPHANY",
  "IMMANUEL",
  "FRANKINCENSE",
  "MYRRH",
  "MANGER",
  "SHEPHERDS",
  "ANGEL",
  "NATIVITY",
  "GLORIA",
  "ADVENT",
  "NOEL",
  "GOSPEL",
  "STAR"
].map(w => w.toUpperCase());

const DIRS = [
  [ 0,  1], [ 0, -1],
  [ 1,  0], [-1,  0],
  [ 1,  1], [ 1, -1],
  [-1,  1], [-1, -1]
];

const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* ===== DOM ===== */
const screenIntro = document.getElementById("screenIntro");
const screenTitle = document.getElementById("screenTitle");
const screenGame  = document.getElementById("screenGame");

const btnStartChallenge = document.getElementById("btnStartChallenge");
const btnPlay = document.getElementById("btnPlay");

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const foundCountEl = document.getElementById("foundCount");
const selectionTextEl = document.getElementById("selectionText");
const statusEl = document.getElementById("status");

const btnNew = document.getElementById("btnNew");
const btnReset = document.getElementById("btnReset");

const wordsListEl = document.getElementById("wordsList");

const modalWin = document.getElementById("modalWin");
const btnCopy = document.getElementById("btnCopy");
const btnPlayAgain = document.getElementById("btnPlayAgain");
const btnBackTitle = document.getElementById("btnBackTitle");
const copyMsg = document.getElementById("copyMsg");

/* ===== STATE ===== */
let grid = [];                        // SIZE x SIZE letters
let placements = new Map();           // word -> array of [r,c]
let found = new Set();               // found words

// selection
let dragging = false;
let startCell = null;                // {r,c}
let endCell = null;                  // {r,c}
let selectPath = [];                 // [{r,c}...]

// rendering metrics
let cellSize = 0;
let pad = 12;

/* ===== UI helpers ===== */
function showScreen(s){
  hideModal();
  screenIntro.classList.remove("active");
  screenTitle.classList.remove("active");
  screenGame.classList.remove("active");
  s.classList.add("active");
}

function setStatus(msg, kind=""){
  statusEl.textContent = msg;
  statusEl.style.color =
    kind === "ok" ? "rgba(124,255,161,.95)" :
    kind === "bad" ? "rgba(255,107,107,.95)" :
    "rgba(255,255,255,.86)";
}

function showModal(){ modalWin.classList.add("show"); modalWin.setAttribute("aria-hidden","false"); }
function hideModal(){ modalWin.classList.remove("show"); modalWin.setAttribute("aria-hidden","true"); copyMsg.textContent = ""; }

function randInt(n){ return Math.floor(Math.random()*n); }
function inBounds(r,c){ return r>=0 && r<SIZE && c>=0 && c<SIZE; }

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = randInt(i+1);
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

/* ===== Puzzle generation ===== */
function emptyGrid(){
  grid = Array.from({length: SIZE}, () => Array(SIZE).fill(""));
}

function canPlace(word, r, c, dr, dc){
  for(let i=0;i<word.length;i++){
    const rr = r + dr*i;
    const cc = c + dc*i;
    if(!inBounds(rr,cc)) return false;
    const ch = grid[rr][cc];
    if(ch !== "" && ch !== word[i]) return false;
  }
  return true;
}

function place(word){
  const attempts = 1200;
  for(let t=0;t<attempts;t++){
    const [dr,dc] = DIRS[randInt(DIRS.length)];
    const r = randInt(SIZE);
    const c = randInt(SIZE);

    if(!canPlace(word, r, c, dr, dc)) continue;

    const coords = [];
    for(let i=0;i<word.length;i++){
      const rr = r + dr*i;
      const cc = c + dc*i;
      grid[rr][cc] = word[i];
      coords.push([rr,cc]);
    }
    placements.set(word, coords);
    return true;
  }
  return false;
}

function fillRandom(){
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      if(grid[r][c] === "") grid[r][c] = ALPH[randInt(ALPH.length)];
    }
  }
}

function buildPuzzle(){
  found.clear();
  placements.clear();
  emptyGrid();

  const ordered = shuffle(WORDS).sort((a,b)=>b.length-a.length);

  for(let tries=0; tries<80; tries++){
    found.clear();
    placements.clear();
    emptyGrid();

    let ok = true;
    for(const w of ordered){
      if(!place(w)){ ok = false; break; }
    }
    if(ok){
      fillRandom();
      return true;
    }
  }
  return false;
}

/* ===== Words UI ===== */
function renderWords(){
  wordsListEl.innerHTML = "";
  for(const w of WORDS){
    const d = document.createElement("div");
    d.className = "word";
    d.id = `w_${w}`;
    d.textContent = w;
    wordsListEl.appendChild(d);
  }
}

function updateWordsUI(){
  foundCountEl.textContent = `${found.size}/${WORDS.length}`;
  for(const w of WORDS){
    const el = document.getElementById(`w_${w}`);
    if(el) el.classList.toggle("done", found.has(w));
  }
}

/* ===== Canvas sizing ===== */
function resizeCanvasToCSS(){
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.width * dpr); // square
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function computeMetrics(){
  const rect = canvas.getBoundingClientRect();
  const sizePx = rect.width;
  pad = Math.max(10, Math.floor(sizePx * 0.02));
  cellSize = (sizePx - pad*2) / SIZE;
}

/* ===== Drawing ===== */
function draw(){
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0,0,rect.width,rect.width);

  // background
  ctx.fillStyle = "rgba(0,0,0,.20)";
  ctx.fillRect(0,0,rect.width,rect.width);

  // found highlight cells
  for(const w of found){
    const coords = placements.get(w);
    if(!coords) continue;
    for(const [r,c] of coords){
      const x = pad + c*cellSize;
      const y = pad + r*cellSize;
      ctx.fillStyle = "rgba(124,255,161,.12)";
      roundRectFill(x, y, cellSize, cellSize, 10);
    }
  }

  // selection highlight
  if(selectPath.length){
    for(const {r,c} of selectPath){
      const x = pad + c*cellSize;
      const y = pad + r*cellSize;
      ctx.fillStyle = "rgba(255,211,106,.18)";
      roundRectFill(x, y, cellSize, cellSize, 10);
    }
  }

  // grid cells + letters
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const x = pad + c*cellSize;
      const y = pad + r*cellSize;

      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.lineWidth = 1;
      roundRectStroke(x, y, cellSize, cellSize, 10);

      // letter
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = `${Math.floor(cellSize*0.52)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(grid[r][c], x + cellSize/2, y + cellSize/2);
    }
  }

  // optional: outline for selection endpoints
  if(startCell){
    drawDot(startCell.r, startCell.c, "rgba(255,211,106,.95)");
  }
  if(endCell){
    drawDot(endCell.r, endCell.c, "rgba(255,211,106,.70)");
  }
}

function roundRectFill(x,y,w,h,r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
  ctx.fill();
}
function roundRectStroke(x,y,w,h,r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
  ctx.stroke();
}
function drawDot(r,c,color){
  const x = pad + c*cellSize + cellSize/2;
  const y = pad + r*cellSize + cellSize/2;
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x,y, Math.max(3, cellSize*0.12), 0, Math.PI*2);
  ctx.fill();
}

/* ===== Input: coordinate -> cell ===== */
function pointToCell(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  // within square
  if(x < pad || y < pad) return null;
  if(x > rect.width - pad || y > rect.width - pad) return null;

  const c = Math.floor((x - pad) / cellSize);
  const r = Math.floor((y - pad) / cellSize);

  if(!inBounds(r,c)) return null;
  return { r, c };
}

/* ===== Selection logic (snap to 8 directions) ===== */
function buildPath(a, b){
  const dr = b.r - a.r;
  const dc = b.c - a.c;

  // determine direction
  const sdr = dr === 0 ? 0 : (dr > 0 ? 1 : -1);
  const sdc = dc === 0 ? 0 : (dc > 0 ? 1 : -1);

  const straight = (dr === 0 && dc !== 0) || (dc === 0 && dr !== 0);
  const diag = Math.abs(dr) === Math.abs(dc);

  if(!(straight || diag)) return [];

  const len = Math.max(Math.abs(dr), Math.abs(dc));
  const path = [];
  for(let i=0;i<=len;i++){
    const rr = a.r + sdr*i;
    const cc = a.c + sdc*i;
    if(!inBounds(rr,cc)) break;
    path.push({ r: rr, c: cc });
  }
  return path;
}

function pathToString(path){
  let s = "";
  for(const p of path) s += grid[p.r][p.c];
  return s;
}

/* ===== Check selection ===== */
function trySubmitSelection(){
  if(selectPath.length < MIN_SELECT){
    setStatus("Select at least 2 letters.", "bad");
    return;
  }

  const chosen = pathToString(selectPath);
  const rev = chosen.split("").reverse().join("");

  const remaining = WORDS.filter(w => !found.has(w));
  const match = remaining.find(w => w === chosen || w === rev);

  if(!match){
    setStatus("No match. Try again.", "bad");
    return;
  }

  found.add(match);
  updateWordsUI();
  setStatus(`Found: ${match}`, "ok");

  if(found.size === WORDS.length){
    showModal();
  }
}

/* ===== Canvas Events (mouse + touch) ===== */
function startDrag(cell){
  hideModal();
  dragging = true;
  startCell = cell;
  endCell = cell;
  selectPath = [cell];
  selectionTextEl.textContent = grid[cell.r][cell.c];
  setStatus("Selecting…");
  draw();
}

function moveDrag(cell){
  if(!dragging || !startCell || !cell) return;
  endCell = cell;
  selectPath = buildPath(startCell, endCell);
  selectionTextEl.textContent = selectPath.length ? pathToString(selectPath) : "—";
  draw();
}

function endDrag(){
  if(!dragging) return;
  dragging = false;

  selectionTextEl.textContent = "—";
  setStatus("Drag to select a word.");
  trySubmitSelection();

  // clear selection visuals after evaluating
  startCell = null;
  endCell = null;
  selectPath = [];
  draw();
}

// Touch
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  const cell = pointToCell(t.clientX, t.clientY);
  if(cell) startDrag(cell);
}, { passive:false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  const cell = pointToCell(t.clientX, t.clientY);
  if(cell) moveDrag(cell);
}, { passive:false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  endDrag();
}, { passive:false });

canvas.addEventListener("touchcancel", (e) => {
  e.preventDefault();
  dragging = false;
  startCell = null; endCell = null; selectPath = [];
  selectionTextEl.textContent = "—";
  setStatus("Selection cancelled.", "bad");
  draw();
}, { passive:false });

// Mouse
canvas.addEventListener("mousedown", (e) => {
  const cell = pointToCell(e.clientX, e.clientY);
  if(cell) startDrag(cell);
});
window.addEventListener("mousemove", (e) => {
  if(!dragging) return;
  const cell = pointToCell(e.clientX, e.clientY);
  if(cell) moveDrag(cell);
});
window.addEventListener("mouseup", () => {
  if(dragging) endDrag();
});

/* ===== Clipboard ===== */
async function copyToClipboard(text){
  if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return ok;
}

/* ===== Game lifecycle ===== */
function startGame(){
  hideModal();
  copyMsg.textContent = "";

  const ok = buildPuzzle();
  if(!ok){
    setStatus("Puzzle build failed. Refresh and try again.", "bad");
    return;
  }

  renderWords();
  updateWordsUI();

  // size + draw
  resizeCanvasToCSS();
  computeMetrics();
  draw();

  setStatus("Drag to select a word.");
}

function resetSamePuzzle(){
  hideModal();
  copyMsg.textContent = "";
  found.clear();
  updateWordsUI();
  draw();
  setStatus("Drag to select a word.");
}

/* ===== Buttons ===== */
btnStartChallenge.addEventListener("click", () => showScreen(screenTitle));
btnPlay.addEventListener("click", () => { showScreen(screenGame); startGame(); });

btnNew.addEventListener("click", () => startGame());
btnReset.addEventListener("click", () => resetSamePuzzle());

btnCopy.addEventListener("click", async () => {
  try{
    const ok = await copyToClipboard(PASSCODE);
    copyMsg.textContent = ok ? "Copied to clipboard." : "Copy failed — copy manually.";
  }catch{
    copyMsg.textContent = "Copy failed — copy manually.";
  }
});

btnPlayAgain.addEventListener("click", () => { hideModal(); startGame(); });

btnBackTitle.addEventListener("click", () => { hideModal(); showScreen(screenTitle); });

// keep canvas crisp on resize/orientation change
window.addEventListener("resize", () => {
  if(!screenGame.classList.contains("active")) return;
  resizeCanvasToCSS();
  computeMetrics();
  draw();
});

/* ===== Boot ===== */
showScreen(screenIntro);

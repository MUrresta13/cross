"use strict";

const PASSCODE = "BETHLEHEMATDAWN";

// Bigger grid + longer list = harder
const GRID_SIZE = 18;

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
  "STAR",
  "GOSPEL",
  "WORSHIP",
  "REJOICE"
].map(w => w.toUpperCase());

// 8 directions (includes backwards & up)
const DIRS = [
  { dr: 0,  dc: 1 },   // right
  { dr: 0,  dc: -1 },  // left
  { dr: 1,  dc: 0 },   // down
  { dr: -1, dc: 0 },   // up
  { dr: 1,  dc: 1 },   // down-right
  { dr: 1,  dc: -1 },  // down-left
  { dr: -1, dc: 1 },   // up-right
  { dr: -1, dc: -1 },  // up-left
];

// -------------------- DOM --------------------
const introScreen = document.getElementById("introScreen");
const titleScreen = document.getElementById("titleScreen");
const gameScreen  = document.getElementById("gameScreen");

const startChallengeBtn = document.getElementById("startChallengeBtn");
const playBtn = document.getElementById("playBtn");

const gridEl = document.getElementById("grid");
const wordsListEl = document.getElementById("wordsList");

const foundCountEl = document.getElementById("foundCount");
const selectionTextEl = document.getElementById("selectionText");
const statusEl = document.getElementById("status");

const newPuzzleBtn = document.getElementById("newPuzzleBtn");
const restartBtn = document.getElementById("restartBtn");

const winModal = document.getElementById("winModal");
const copyBtn = document.getElementById("copyBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const backToTitleBtn = document.getElementById("backToTitleBtn");
const copyStatus = document.getElementById("copyStatus");

// -------------------- STATE --------------------
let grid = [];
let placements = new Map();   // word -> array of [r,c]
let found = new Set();

// selection state
let isDragging = false;
let startCell = null;         // {r,c}
let currentPath = [];         // array of {r,c}
let cellDivs = [];            // 2D div refs

// pointer tracking (iOS reliable)
let activePointerId = null;

// -------------------- UI helpers --------------------
function show(el){ el.classList.add("show"); el.setAttribute("aria-hidden","false"); }
function hide(el){ el.classList.remove("show"); el.setAttribute("aria-hidden","true"); }
function hideAllModals(){
  hide(winModal);
  copyStatus.textContent = "";
}
function showScreen(screen){
  hideAllModals();
  introScreen.classList.remove("active");
  titleScreen.classList.remove("active");
  gameScreen.classList.remove("active");
  screen.classList.add("active");
}
function setStatus(msg, kind=""){
  statusEl.textContent = msg;
  statusEl.style.color =
    kind === "ok" ? "rgba(124,255,161,.95)" :
    kind === "bad" ? "rgba(255,107,107,.95)" :
    "rgba(255,255,255,.85)";
}

// -------------------- Grid generation --------------------
function inBounds(r,c){
  return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
}
function randInt(n){ return Math.floor(Math.random()*n); }

function makeEmptyGrid(){
  grid = Array.from({length: GRID_SIZE}, () => Array(GRID_SIZE).fill(""));
}

function canPlaceWord(word, r, c, dir){
  for(let i=0;i<word.length;i++){
    const rr = r + dir.dr*i;
    const cc = c + dir.dc*i;
    if(!inBounds(rr,cc)) return false;
    const ch = grid[rr][cc];
    if(ch !== "" && ch !== word[i]) return false;
  }
  return true;
}

function placeWord(word){
  const attempts = 900;
  for(let a=0;a<attempts;a++){
    const dir = DIRS[randInt(DIRS.length)];
    const r = randInt(GRID_SIZE);
    const c = randInt(GRID_SIZE);

    if(!canPlaceWord(word, r, c, dir)) continue;

    const coords = [];
    for(let i=0;i<word.length;i++){
      const rr = r + dir.dr*i;
      const cc = c + dir.dc*i;
      grid[rr][cc] = word[i];
      coords.push([rr,cc]);
    }
    placements.set(word, coords);
    return true;
  }
  return false;
}

function fillRandomLetters(){
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      if(grid[r][c] === "") grid[r][c] = alphabet[randInt(alphabet.length)];
    }
  }
}

function buildPuzzle(){
  found.clear();
  placements = new Map();

  // Place longer words first
  const sorted = [...WORDS].sort((a,b)=>b.length-a.length);

  for(let tries=0;tries<60;tries++){
    placements.clear();
    makeEmptyGrid();

    let ok = true;
    for(const w of sorted){
      if(!placeWord(w)){ ok = false; break; }
    }
    if(ok){
      fillRandomLetters();
      return true;
    }
  }
  return false;
}

// -------------------- Rendering --------------------
function renderWords(){
  wordsListEl.innerHTML = "";
  for(const w of WORDS){
    const chip = document.createElement("div");
    chip.className = "wordChip";
    chip.id = `word_${w}`;
    chip.textContent = w;
    wordsListEl.appendChild(chip);
  }
}

function updateFoundUI(){
  foundCountEl.textContent = `${found.size}/${WORDS.length}`;
  for(const w of WORDS){
    const chip = document.getElementById(`word_${w}`);
    if(chip) chip.classList.toggle("done", found.has(w));
  }
}

function renderGrid(){
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;

  cellDivs = Array.from({length: GRID_SIZE}, () => Array(GRID_SIZE).fill(null));

  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      const d = document.createElement("div");
      d.className = "cell";
      d.textContent = grid[r][c];
      d.dataset.r = String(r);
      d.dataset.c = String(c);
      cellDivs[r][c] = d;
      gridEl.appendChild(d);
    }
  }
}

// -------------------- Selection helpers --------------------
function clearSelectionHighlights(){
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      cellDivs[r][c].classList.remove("selected");
    }
  }
}

function markFoundWordCells(coords){
  for(const [r,c] of coords){
    cellDivs[r][c].classList.add("found");
  }
}

function coordsToString(coords){
  let s = "";
  for(const {r,c} of coords) s += grid[r][c];
  return s;
}

function linePath(a, b){
  const dr = b.r - a.r;
  const dc = b.c - a.c;

  const sdr = dr === 0 ? 0 : (dr > 0 ? 1 : -1);
  const sdc = dc === 0 ? 0 : (dc > 0 ? 1 : -1);

  const isStraight = (dr === 0 && dc !== 0) || (dc === 0 && dr !== 0);
  const isDiag = Math.abs(dr) === Math.abs(dc);

  if(!(isStraight || isDiag)) return null;

  const len = Math.max(Math.abs(dr), Math.abs(dc));
  const coords = [];
  for(let i=0;i<=len;i++){
    const rr = a.r + sdr*i;
    const cc = a.c + sdc*i;
    if(!inBounds(rr,cc)) return null;
    coords.push({ r: rr, c: cc });
  }
  return coords;
}

function beginDrag(r,c){
  hideAllModals();
  isDragging = true;
  startCell = { r, c };
  currentPath = [{ r, c }];

  clearSelectionHighlights();
  cellDivs[r][c].classList.add("selected");

  selectionTextEl.textContent = grid[r][c];
  setStatus("Selecting…", "");
}

function extendDrag(r,c){
  if(!isDragging || !startCell) return;

  const path = linePath(startCell, { r, c });
  if(!path) return;

  currentPath = path;

  clearSelectionHighlights();
  for(const p of currentPath){
    cellDivs[p.r][p.c].classList.add("selected");
  }

  selectionTextEl.textContent = coordsToString(currentPath);
}

function endDrag(){
  if(!isDragging) return;
  isDragging = false;

  if(!currentPath || currentPath.length < 2){
    clearSelectionHighlights();
    selectionTextEl.textContent = "—";
    setStatus("Select at least 2 letters.", "bad");
    startCell = null;
    currentPath = [];
    return;
  }

  const chosen = coordsToString(currentPath);
  const reversed = chosen.split("").reverse().join("");

  const remaining = WORDS.filter(w => !found.has(w));
  const match = remaining.find(w => w === chosen || w === reversed);

  clearSelectionHighlights();
  selectionTextEl.textContent = "—";

  if(!match){
    setStatus("No match. Try again.", "bad");
    startCell = null;
    currentPath = [];
    return;
  }

  found.add(match);

  // mark placed coords so backwards selection still highlights correctly
  const coords = placements.get(match);
  if(coords) markFoundWordCells(coords);

  updateFoundUI();
  setStatus(`Found: ${match}`, "ok");

  startCell = null;
  currentPath = [];

  if(found.size === WORDS.length){
    setStatus("All words found.", "ok");
    show(winModal);
  }
}

// -------------------- Pointer handling (iOS reliable) --------------------
function getCellFromPoint(x, y){
  const el = document.elementFromPoint(x, y);
  if(!el) return null;

  const cell = el.classList?.contains("cell") ? el : el.closest?.(".cell");
  if(!cell) return null;

  const r = Number(cell.dataset.r);
  const c = Number(cell.dataset.c);
  if(Number.isNaN(r) || Number.isNaN(c)) return null;

  return { r, c };
}

// Attach once
gridEl.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();

  const cell = getCellFromPoint(ev.clientX, ev.clientY);
  if(!cell) return;

  activePointerId = ev.pointerId;
  try{ gridEl.setPointerCapture(activePointerId); }catch{}

  beginDrag(cell.r, cell.c);
});

gridEl.addEventListener("pointermove", (ev) => {
  if(activePointerId === null || ev.pointerId !== activePointerId) return;

  const cell = getCellFromPoint(ev.clientX, ev.clientY);
  if(!cell) return;

  extendDrag(cell.r, cell.c);
});

gridEl.addEventListener("pointerup", (ev) => {
  if(activePointerId === null || ev.pointerId !== activePointerId) return;

  try{ gridEl.releasePointerCapture(activePointerId); }catch{}
  activePointerId = null;

  endDrag();
});

gridEl.addEventListener("pointercancel", () => {
  activePointerId = null;
  isDragging = false;
  clearSelectionHighlights();
  selectionTextEl.textContent = "—";
  setStatus("Selection cancelled. Try again.", "bad");
});

// -------------------- Clipboard --------------------
async function copyToClipboard(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
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

// -------------------- Game lifecycle --------------------
function startGame(){
  hideAllModals();

  const ok = buildPuzzle();
  if(!ok){
    setStatus("Puzzle build failed. Refresh and try again.", "bad");
    return;
  }

  renderWords();
  renderGrid();
  found.clear();
  updateFoundUI();

  setStatus("Find the listed words.", "");
  selectionTextEl.textContent = "—";
}

// -------------------- Buttons --------------------
startChallengeBtn.addEventListener("click", () => showScreen(titleScreen));

playBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startGame();
});

restartBtn.addEventListener("click", () => startGame());
newPuzzleBtn.addEventListener("click", () => startGame());

copyBtn.addEventListener("click", async () => {
  try{
    const ok = await copyToClipboard(PASSCODE);
    copyStatus.textContent = ok ? "Copied to clipboard." : "Copy failed — copy manually.";
  }catch{
    copyStatus.textContent = "Copy failed — copy manually.";
  }
});

playAgainBtn.addEventListener("click", () => {
  hideAllModals();
  startGame();
});

backToTitleBtn.addEventListener("click", () => {
  hideAllModals();
  showScreen(titleScreen);
});

// Boot
showScreen(introScreen);

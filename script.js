"use strict";

const PASSCODE = "BETHLEHEMATDAWN";

// Hard-ish: bigger grid + longer word list
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

let grid = [];
let placements = new Map();   // word -> array of [r,c]
let found = new Set();

// selection state
let isDragging = false;
let startCell = null;         // {r,c}
let currentPath = [];         // array of {r,c}
let cellDivs = [];            // 2D div refs

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
  const attempts = 600;
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
  makeEmptyGrid();

  // Place longer words first (harder & more stable)
  const sorted = [...WORDS].sort((a,b)=>b.length-a.length);

  // Try multiple full builds until all words placed
  for(let tries=0;tries<40;tries++){
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

      // Pointer events for drag selection (works on mobile + desktop)
      d.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        beginDrag(r,c);
      });
      d.addEventListener("pointerenter", () => {
        if(isDragging) extendDrag(r,c);
      });

      cellDivs[r][c] = d;
      gridEl.appendChild(d);
    }
  }

  // End drag anywhere
  window.addEventListener("pointerup", endDrag, { once: true });
}

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
  return coords.map(({r,c}) => grid[r][c]).join("");
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

function linePath(a, b){
  // If user drags non-linear, snap to a straight valid direction from start to current
  const dr = b.r - a.r;
  const dc = b.c - a.c;

  const sdr = dr === 0 ? 0 : (dr > 0 ? 1 : -1);
  const sdc = dc === 0 ? 0 : (dc > 0 ? 1 : -1);

  // must be straight or diagonal (|dr| == |dc|)
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

function extendDrag(r,c){
  if(!isDragging || !startCell) return;
  const path = linePath(startCell, { r, c });
  if(!path) return;

  currentPath = path;

  clearSelectionHighlights();
  for(const p of currentPath){
    cellDivs[p.r][p.c].classList.add("selected");
  }

  const txt = coordsToString(currentPath);
  selectionTextEl.textContent = txt;
}

function endDrag(){
  if(!isDragging) return;
  isDragging = false;

  const chosen = coordsToString(currentPath);
  const reversed = chosen.split("").reverse().join("");

  // match against remaining words
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

  // highlight the actual placed coordinates (not just the drag selection),
  // so even if they found it backwards, it still marks consistently.
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

function startGame(newPuzzle=false){
  hideAllModals();
  if(newPuzzle){
    // remove found visuals
    for(let r=0;r<GRID_SIZE;r++){
      for(let c=0;c<GRID_SIZE;c++){
        if(cellDivs[r]?.[c]) cellDivs[r][c].classList.remove("found","selected");
      }
    }
  }

  const ok = buildPuzzle();
  if(!ok){
    setStatus("Puzzle build failed. Refresh and try again.", "bad");
    return;
  }

  renderWords();
  renderGrid();

  // reapply found word highlights (fresh puzzle = none)
  found.clear();
  updateFoundUI();

  setStatus("Find the listed words.", "");
  selectionTextEl.textContent = "—";
}

startChallengeBtn.addEventListener("click", () => showScreen(titleScreen));

playBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startGame(true);
});

restartBtn.addEventListener("click", () => startGame(false));
newPuzzleBtn.addEventListener("click", () => startGame(true));

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
  startGame(true);
});

backToTitleBtn.addEventListener("click", () => {
  hideAllModals();
  showScreen(titleScreen);
});

// Boot
showScreen(introScreen);

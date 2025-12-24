"use strict";

const PASSCODE = "BETHLEHEMATDAWN";

// 15x15 crossword with *hard* Christmas/Christian vocabulary.
// Blocks are implied from the word placements; everything else is a block.
const SIZE = 15;

/**
 * Entry format:
 * id: clue number
 * dir: "A" or "D"
 * row,col: start (0-based)
 * answer: uppercase letters only
 * clue: text
 */
const ENTRIES = [
  // Across
  { id: 1, dir: "A", row: 1, col: 2, answer: "EPIPHANY", clue: "Jan 6 feast often tied to the Magi (8)" },
  { id: 4, dir: "A", row: 3, col: 1, answer: "INCARNATION", clue: "Doctrine: God taking on human nature (11)" },
  { id: 7, dir: "A", row: 5, col: 3, answer: "FRANKINCENSE", clue: "Gift of the Magi used as incense (12)" },
  { id: 10, dir: "A", row: 7, col: 3, answer: "BETHLEHEM", clue: "Town traditionally named as Jesus’ birthplace (9)" },
  { id: 12, dir: "A", row: 9, col: 4, answer: "IMMANUEL", clue: "Title meaning 'God with us' (8)" },
  { id: 14, dir: "A", row: 11, col: 2, answer: "NATIVITY", clue: "The birth of Jesus; also the scene depicting it (8)" },

  // Down
  { id: 2, dir: "D", row: 1, col: 5, answer: "PHAROS", clue: "Ancient word for 'lighthouse' (a hard clue—think 'light') (6)" },
  { id: 3, dir: "D", row: 1, col: 9, answer: "MAGI", clue: "Wise men (plural) in Matthew’s account (4)" },
  { id: 5, dir: "D", row: 3, col: 1, answer: "ADVENT", clue: "Season of preparation before Christmas (6)" },
  { id: 6, dir: "D", row: 3, col: 8, answer: "SHEPHERDS", clue: "First visitors in Luke’s narrative (9)" },
  { id: 8, dir: "D", row: 5, col: 10, answer: "MYRRH", clue: "Gift associated with burial spices (5)" },
  { id: 9, dir: "D", row: 6, col: 3, answer: "MANGER", clue: "Where the infant Jesus was laid (6)" },
  { id: 11, dir: "D", row: 7, col: 7, answer: "NOEL", clue: "A word meaning Christmas (4)" },
  { id: 13, dir: "D", row: 9, col: 4, answer: "GOSPEL", clue: "Literally 'good news' (6)" },
  { id: 15, dir: "D", row: 11, col: 6, answer: "GLORIA", clue: "Begins the angelic praise: '_____ in excelsis Deo' (6)" },
];

// -------------------- DOM --------------------
const introScreen = document.getElementById("introScreen");
const titleScreen = document.getElementById("titleScreen");
const gameScreen  = document.getElementById("gameScreen");

const startChallengeBtn = document.getElementById("startChallengeBtn");
const playBtn = document.getElementById("playBtn");

const gridEl = document.getElementById("grid");
const acrossCluesEl = document.getElementById("acrossClues");
const downCluesEl = document.getElementById("downClues");
const selectedClueEl = document.getElementById("selectedClue");
const statusEl = document.getElementById("status");

const toggleDirBtn = document.getElementById("toggleDirBtn");
const clearWordBtn  = document.getElementById("clearWordBtn");
const submitBtn     = document.getElementById("submitBtn");
const restartBtn    = document.getElementById("restartBtn");

const winModal = document.getElementById("winModal");
const failModal = document.getElementById("failModal");

const copyBtn = document.getElementById("copyBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const backToTitleBtn = document.getElementById("backToTitleBtn");
const backToTitleBtn2 = document.getElementById("backToTitleBtn2");
const keepTryingBtn = document.getElementById("keepTryingBtn");

const copyStatus = document.getElementById("copyStatus");
const failReason = document.getElementById("failReason");

// -------------------- STATE --------------------
let cells = [];               // 2D [r][c] => { block, inputEl, cellEl, number? }
let solution = Array.from({length: SIZE}, () => Array(SIZE).fill("#"));
let blockMap = Array.from({length: SIZE}, () => Array(SIZE).fill(true));

let selected = { r: 0, c: 0 };
let direction = "A";          // "A" or "D"
let activeEntryId = null;

// -------------------- Helpers --------------------
function showScreen(screen){
  hideAllModals();
  introScreen.classList.remove("active");
  titleScreen.classList.remove("active");
  gameScreen.classList.remove("active");
  screen.classList.add("active");
}

function show(el){ el.classList.add("show"); el.setAttribute("aria-hidden", "false"); }
function hide(el){ el.classList.remove("show"); el.setAttribute("aria-hidden", "true"); }
function hideAllModals(){
  hide(winModal);
  hide(failModal);
  copyStatus.textContent = "";
}

function inBounds(r,c){ return r>=0 && r<SIZE && c>=0 && c<SIZE; }

function setStatus(text, kind=""){
  statusEl.textContent = text;
  statusEl.style.color =
    kind === "ok" ? "rgba(124,255,161,.95)" :
    kind === "bad" ? "rgba(255,107,107,.95)" :
    "rgba(255,255,255,.85)";
}

function setSelectedClueText(){
  if(!activeEntryId){
    selectedClueEl.textContent = "—";
    return;
  }
  const entry = ENTRIES.find(e => e.id === activeEntryId);
  selectedClueEl.textContent = `${entry.id}${entry.dir === "A" ? "A" : "D"}`;
}

function normalizeLetter(ch){
  const up = (ch || "").toUpperCase();
  return (up >= "A" && up <= "Z") ? up : "";
}

// -------------------- Build crossword maps --------------------
function buildMaps(){
  // reset
  solution = Array.from({length: SIZE}, () => Array(SIZE).fill("#"));
  blockMap = Array.from({length: SIZE}, () => Array(SIZE).fill(true));

  // place entries into solution, mark blocks false for letter cells
  for(const e of ENTRIES){
    for(let i=0;i<e.answer.length;i++){
      const r = e.row + (e.dir === "D" ? i : 0);
      const c = e.col + (e.dir === "A" ? i : 0);
      if(!inBounds(r,c)) throw new Error(`Entry ${e.id}${e.dir} out of bounds`);
      const ch = e.answer[i];
      const existing = solution[r][c];
      if(existing !== "#" && existing !== ch){
        throw new Error(`Conflict at (${r},${c}) between ${existing} and ${ch}`);
      }
      solution[r][c] = ch;
      blockMap[r][c] = false;
    }
  }
}

function computeNumbers(){
  // Number cells where an entry starts
  const numbers = Array.from({length: SIZE}, () => Array(SIZE).fill(0));

  // Only number from ENTRIES starts (keeps numbering consistent with the clue list)
  for(const e of ENTRIES){
    numbers[e.row][e.col] = e.id;
  }
  return numbers;
}

// -------------------- Render UI --------------------
function renderGrid(){
  gridEl.innerHTML = "";
  cells = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
  const numbers = computeNumbers();

  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const cellEl = document.createElement("div");
      cellEl.className = "cell";

      if(blockMap[r][c]){
        cellEl.classList.add("block");
        gridEl.appendChild(cellEl);
        cells[r][c] = { block:true, cellEl, inputEl:null, number:0 };
        continue;
      }

      const input = document.createElement("input");
      input.setAttribute("maxlength", "1");
      input.setAttribute("inputmode", "text");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "characters");
      input.setAttribute("aria-label", `Row ${r+1} Col ${c+1}`);

      input.addEventListener("focus", () => {
        selectCell(r,c, true);
      });

      input.addEventListener("input", (ev) => {
        const val = normalizeLetter(ev.target.value);
        ev.target.value = val;
        if(val){
          moveNext();
        }
      });

      input.addEventListener("keydown", (ev) => {
        handleKey(ev);
      });

      cellEl.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        selectCell(r,c, true);
        input.focus();
      });

      if(numbers[r][c]){
        const num = document.createElement("div");
        num.className = "cellNumber";
        num.textContent = String(numbers[r][c]);
        cellEl.appendChild(num);
      }

      cellEl.appendChild(input);
      gridEl.appendChild(cellEl);

      cells[r][c] = { block:false, cellEl, inputEl:input, number: numbers[r][c] || 0 };
    }
  }
}

function renderClues(){
  acrossCluesEl.innerHTML = "";
  downCluesEl.innerHTML = "";

  const across = ENTRIES.filter(e => e.dir === "A").sort((a,b)=>a.id-b.id);
  const down   = ENTRIES.filter(e => e.dir === "D").sort((a,b)=>a.id-b.id);

  for(const e of across){
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "clueBtn";
    btn.type = "button";
    btn.textContent = `${e.id}. ${e.clue}`;
    btn.addEventListener("click", () => activateEntry(e.id));
    li.appendChild(btn);
    acrossCluesEl.appendChild(li);
  }

  for(const e of down){
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "clueBtn";
    btn.type = "button";
    btn.textContent = `${e.id}. ${e.clue}`;
    btn.addEventListener("click", () => activateEntry(e.id));
    li.appendChild(btn);
    downCluesEl.appendChild(li);
  }
}

function clearHighlights(){
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const cell = cells[r][c];
      if(cell && !cell.block){
        cell.cellEl.classList.remove("selected","highlight");
      }
    }
  }
  document.querySelectorAll(".clueBtn").forEach(b => b.classList.remove("active"));
}

function entryCells(entry){
  const coords = [];
  for(let i=0;i<entry.answer.length;i++){
    const r = entry.row + (entry.dir === "D" ? i : 0);
    const c = entry.col + (entry.dir === "A" ? i : 0);
    coords.push([r,c]);
  }
  return coords;
}

function activateEntry(id){
  const entry = ENTRIES.find(e => e.id === id);
  if(!entry) return;

  activeEntryId = id;
  direction = entry.dir;
  toggleDirBtn.textContent = `Direction: ${direction === "A" ? "Across" : "Down"}`;

  clearHighlights();

  // mark clue active
  const list = (entry.dir === "A") ? acrossCluesEl : downCluesEl;
  const btns = list.querySelectorAll(".clueBtn");
  btns.forEach(btn => {
    if(btn.textContent.startsWith(`${entry.id}.`)) btn.classList.add("active");
  });

  // highlight entry cells
  const coords = entryCells(entry);
  for(const [r,c] of coords){
    cells[r][c].cellEl.classList.add("highlight");
  }

  // select first cell of entry
  selectCell(entry.row, entry.col, true);
  setSelectedClueText();

  // focus input
  cells[entry.row][entry.col].inputEl.focus();
}

function selectCell(r,c, updateEntry){
  if(!inBounds(r,c) || blockMap[r][c]) return;

  clearHighlights();

  // if we have an active entry, keep it highlighted
  if(activeEntryId){
    const entry = ENTRIES.find(e => e.id === activeEntryId);
    const coords = entryCells(entry);
    for(const [rr,cc] of coords){
      cells[rr][cc].cellEl.classList.add("highlight");
    }
    // mark clue active
    const list = (entry.dir === "A") ? acrossCluesEl : downCluesEl;
    list.querySelectorAll(".clueBtn").forEach(btn => {
      if(btn.textContent.startsWith(`${entry.id}.`)) btn.classList.add("active");
    });
  }

  selected = { r, c };
  cells[r][c].cellEl.classList.add("selected");

  if(updateEntry){
    // choose the entry that matches current direction and includes this cell; fallback to the other direction
    const matchDir = findEntryContaining(r,c,direction);
    const matchOther = findEntryContaining(r,c, direction === "A" ? "D" : "A");
    if(matchDir){
      activeEntryId = matchDir.id;
    }else if(matchOther){
      activeEntryId = matchOther.id;
      direction = matchOther.dir;
      toggleDirBtn.textContent = `Direction: ${direction === "A" ? "Across" : "Down"}`;
    }else{
      activeEntryId = null;
    }
    setSelectedClueText();
  }
}

function findEntryContaining(r,c, dir){
  for(const e of ENTRIES){
    if(e.dir !== dir) continue;
    const coords = entryCells(e);
    if(coords.some(([rr,cc]) => rr===r && cc===c)) return e;
  }
  return null;
}

// -------------------- Movement & input --------------------
function moveNext(){
  const { r, c } = selected;
  const nr = r + (direction === "D" ? 1 : 0);
  const nc = c + (direction === "A" ? 1 : 0);
  if(inBounds(nr,nc) && !blockMap[nr][nc]){
    selectCell(nr,nc, true);
    cells[nr][nc].inputEl.focus();
  }
}

function movePrev(){
  const { r, c } = selected;
  const nr = r + (direction === "D" ? -1 : 0);
  const nc = c + (direction === "A" ? -1 : 0);
  if(inBounds(nr,nc) && !blockMap[nr][nc]){
    selectCell(nr,nc, true);
    cells[nr][nc].inputEl.focus();
  }
}

function handleKey(ev){
  const k = ev.key;

  if(k === "Backspace"){
    ev.preventDefault();
    const cell = cells[selected.r][selected.c];
    if(cell.inputEl.value){
      cell.inputEl.value = "";
    }else{
      movePrev();
      cells[selected.r][selected.c].inputEl.value = "";
    }
    return;
  }

  if(k === "ArrowRight"){ ev.preventDefault(); direction="A"; toggleDirBtn.textContent="Direction: Across"; tryMove(0,1); return; }
  if(k === "ArrowLeft"){ ev.preventDefault(); direction="A"; toggleDirBtn.textContent="Direction: Across"; tryMove(0,-1); return; }
  if(k === "ArrowDown"){ ev.preventDefault(); direction="D"; toggleDirBtn.textContent="Direction: Down"; tryMove(1,0); return; }
  if(k === "ArrowUp"){ ev.preventDefault(); direction="D"; toggleDirBtn.textContent="Direction: Down"; tryMove(-1,0); return; }

  if(k === "Tab"){
    // let tab work normally
    return;
  }
}

function tryMove(dr,dc){
  const nr = selected.r + dr;
  const nc = selected.c + dc;
  if(inBounds(nr,nc) && !blockMap[nr][nc]){
    selectCell(nr,nc, true);
    cells[nr][nc].inputEl.focus();
  }
}

// -------------------- Actions --------------------
function clearActiveWord(){
  if(!activeEntryId){
    setStatus("Select a clue (or a word) first.", "bad");
    return;
  }
  const entry = ENTRIES.find(e => e.id === activeEntryId);
  for(const [r,c] of entryCells(entry)){
    cells[r][c].inputEl.value = "";
  }
  setStatus("Cleared selected word.", "");
}

function readGrid(){
  const user = Array.from({length: SIZE}, () => Array(SIZE).fill("#"));
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      if(blockMap[r][c]) continue;
      user[r][c] = normalizeLetter(cells[r][c].inputEl.value);
    }
  }
  return user;
}

function checkWin(){
  const user = readGrid();

  // Require every letter cell filled and correct
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      if(blockMap[r][c]) continue;

      if(!user[r][c]){
        return { ok:false, reason:"Some squares are still blank." };
      }
      if(user[r][c] !== solution[r][c]){
        return { ok:false, reason:"Some letters are incorrect." };
      }
    }
  }
  return { ok:true, reason:"" };
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

// -------------------- Game lifecycle --------------------
function startGame(){
  hideAllModals();
  buildMaps();
  renderGrid();
  renderClues();
  setStatus("Fill the puzzle, then press Submit.", "");
  activeEntryId = null;
  direction = "A";
  toggleDirBtn.textContent = "Direction: Across";
  setSelectedClueText();

  // focus first non-block
  outer: for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      if(!blockMap[r][c]){
        selectCell(r,c,true);
        cells[r][c].inputEl.focus();
        break outer;
      }
    }
  }
}

// -------------------- Events --------------------
startChallengeBtn.addEventListener("click", () => {
  showScreen(titleScreen);
});

playBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startGame();
});

toggleDirBtn.addEventListener("click", () => {
  direction = (direction === "A") ? "D" : "A";
  toggleDirBtn.textContent = `Direction: ${direction === "A" ? "Across" : "Down"}`;
  selectCell(selected.r, selected.c, true);
});

clearWordBtn.addEventListener("click", () => clearActiveWord());

restartBtn.addEventListener("click", () => startGame());

submitBtn.addEventListener("click", () => {
  hideAllModals();
  const res = checkWin();
  if(res.ok){
    setStatus("Perfect.", "ok");
    show(winModal);
  }else{
    setStatus(res.reason, "bad");
    failReason.textContent = res.reason;
    show(failModal);
  }
});

// Modal buttons (always hide modals first)
keepTryingBtn.addEventListener("click", () => {
  hideAllModals();
});

backToTitleBtn.addEventListener("click", () => {
  hideAllModals();
  showScreen(titleScreen);
});

backToTitleBtn2.addEventListener("click", () => {
  hideAllModals();
  showScreen(titleScreen);
});

playAgainBtn.addEventListener("click", () => {
  hideAllModals();
  startGame();
});

copyBtn.addEventListener("click", async () => {
  try{
    const ok = await copyToClipboard(PASSCODE);
    copyStatus.textContent = ok ? "Copied to clipboard." : "Copy failed — copy manually.";
  }catch{
    copyStatus.textContent = "Copy failed — copy manually.";
  }
});

// Boot
showScreen(introScreen);

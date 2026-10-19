/**
 * 加數積木星星 — original number-block addition game (zh-HK)
 * Not affiliated with Numberblocks / BBC.
 */
(function () {
  "use strict";

  const QUESTIONS_PER_ROUND = 12;

  const TYPE_LABELS = {
    simple10: "1–10 簡單加法",
    simple20: "1–20 加法",
    make10: "湊十",
    triple: "連加三個數",
    missing: "缺數",
    compose: "組合數式",
  };

  const DIFF = {
    easy: {
      label: "易",
      weights: { simple10: 5, make10: 4, simple20: 2, missing: 1, compose: 0, triple: 0 },
    },
    mid: {
      label: "中",
      weights: { simple10: 1, simple20: 3, make10: 2, missing: 3, compose: 3, triple: 0 },
    },
    hard: {
      label: "難",
      weights: { simple10: 0, simple20: 1, make10: 1, missing: 2, compose: 4, triple: 4 },
    },
  };

  // —— State ——
  let state = {
    diff: null,
    questions: [],
    index: 0,
    stars: 0,
    correct: 0,
    locked: false,
  };


  // —— Sound (Web Audio API, kid-friendly) ——
  const SOUND_KEY = "addition-blocks-sound";
  let audioCtx = null;
  let soundEnabled = true;
  try {
    const saved = localStorage.getItem(SOUND_KEY);
    if (saved === "0") soundEnabled = false;
    else if (saved === "1") soundEnabled = true;
  } catch (_) { /* ignore */ }

  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  }

  function unlockAudio() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function tone(freq, start, dur, type, gainPeak, freqEnd) {
    const ctx = getAudioCtx();
    if (!ctx || !soundEnabled) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) {
      osc.frequency.linearRampToValueAtTime(freqEnd, t0 + dur);
    }
    const peak = gainPeak != null ? gainPeak : 0.12;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const SFX = {
    tap() {
      // Soft short click
      tone(880, 0, 0.05, "triangle", 0.06);
    },
    blip() {
      // Soft level-select / round-start blip
      tone(523.25, 0, 0.08, "sine", 0.08);
      tone(659.25, 0.06, 0.1, "sine", 0.07);
    },
    correct() {
      // Happy ascending chime (star sparkle)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        tone(f, i * 0.07, 0.22, "sine", 0.11);
        tone(f * 2, i * 0.07 + 0.02, 0.12, "triangle", 0.04);
      });
    },
    wrong() {
      // Soft low non-scary tone
      tone(220, 0, 0.28, "sine", 0.08, 165);
      tone(165, 0.05, 0.22, "triangle", 0.04);
    },
  };

  function updateMuteUI() {
    const on = soundEnabled;
    document.querySelectorAll(".mute-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      btn.setAttribute("aria-label", on ? "靜音" : "開聲");
      btn.title = on ? "靜音" : "開聲";
      const icon = btn.querySelector(".mute-icon");
      const label = btn.querySelector(".mute-label");
      if (icon) icon.textContent = on ? "🔊" : "🔇";
      if (label) label.textContent = on ? "開聲" : "靜音";
      btn.classList.toggle("muted", !on);
    });
  }

  function toggleSound() {
    unlockAudio();
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0");
    } catch (_) { /* ignore */ }
    updateMuteUI();
    if (soundEnabled) SFX.blip();
  }

  // —— DOM ——
  const $ = (id) => document.getElementById(id);
  const screens = {
    home: $("screen-home"),
    play: $("screen-play"),
    end: $("screen-end"),
  };

  // —— Utils ——
  function randInt(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pickWeighted(weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) {
      r -= w;
      if (r <= 0) return k;
    }
    return entries[entries.length - 1][0];
  }
  function uniqueChoices(correct, pool, count) {
    const set = new Set([correct]);
    const p = shuffle(pool.filter((x) => x !== correct));
    for (const x of p) {
      if (set.size >= count) break;
      set.add(x);
    }
    // fill if needed
    let n = 0;
    while (set.size < count) {
      const v = correct + (n % 2 === 0 ? 1 + Math.floor(n / 2) : -(1 + Math.floor(n / 2)));
      n++;
      if (v > 0 && v !== correct) set.add(v);
      if (n > 40) break;
    }
    return shuffle([...set]).slice(0, count);
  }

  // —— Number block renderer ——
  function colorClass(n) {
    if (n <= 0) return "nb-c0";
    if (n >= 10) return "nb-c10";
    return "nb-c" + n;
  }

  function renderBlockTower(n, size) {
    const wrap = document.createElement("div");
    wrap.className = "nb" + (size ? " " + size : "");
    wrap.setAttribute("aria-label", String(n));
    const cubes = Math.min(Math.max(n, 1), 10);
    for (let i = 0; i < cubes; i++) {
      const cube = document.createElement("div");
      cube.className = "nb-cube " + colorClass(n);
      const isTop = i === cubes - 1;
      if (isTop) {
        const face = document.createElement("div");
        face.className = "face";
        face.innerHTML =
          '<div class="eyes"><span class="eye"></span><span class="eye"></span></div>' +
          '<div class="mouth"></div>';
        cube.appendChild(face);
      }
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1);
      cube.appendChild(num);
      wrap.appendChild(cube);
    }
    return wrap;
  }

  function renderViz(parts, size) {
    const el = $("block-viz");
    el.innerHTML = "";
    // parts: array of {n} or {op: '+'} or {op: '='} or {blank: true}
    const useSize = size || (parts.filter((p) => p.n != null).every((p) => p.n <= 5) ? "lg" : "");
    parts.forEach((p) => {
      if (p.op) {
        const op = document.createElement("span");
        op.className = "op";
        op.textContent = p.op;
        el.appendChild(op);
      } else if (p.blank) {
        const b = document.createElement("span");
        b.className = "op";
        b.textContent = "□";
        b.style.fontSize = "2rem";
        el.appendChild(b);
      } else if (p.n != null) {
        el.appendChild(renderBlockTower(p.n, useSize || (p.n > 6 ? "sm" : "")));
      }
    });
  }

  function fillLogo() {
    const el = $("logo-blocks");
    el.innerHTML = "";
    [3, 5, 2].forEach((n) => el.appendChild(renderBlockTower(n, "lg")));
  }

  // —— Question generators ——
  function genSimple10() {
    const a = randInt(1, 9);
    const b = randInt(1, 10 - a);
    const ans = a + b;
    return {
      type: "simple10",
      prompt: `${a} ＋ ${b} ＝ ？`,
      viz: [{ n: a }, { op: "＋" }, { n: b }],
      answer: ans,
      choices: uniqueChoices(ans, [ans - 2, ans - 1, ans + 1, ans + 2, a, b, 10].filter((x) => x > 0), 4),
    };
  }

  function genSimple20() {
    let a = randInt(1, 19);
    let b = randInt(1, 20 - a);
    if (a + b < 5) b = Math.min(20 - a, b + 3);
    const ans = a + b;
    return {
      type: "simple20",
      prompt: `${a} ＋ ${b} ＝ ？`,
      viz: a <= 10 && b <= 10 ? [{ n: a }, { op: "＋" }, { n: b }] : [],
      answer: ans,
      choices: uniqueChoices(ans, [ans - 3, ans - 2, ans - 1, ans + 1, ans + 2, ans + 3, 10, 20].filter((x) => x > 0 && x <= 30), 4),
    };
  }

  function genMake10() {
    const a = randInt(1, 9);
    const b = 10 - a;
    return {
      type: "make10",
      prompt: `${a} ＋ ？ ＝ 10　（湊十）`,
      viz: [{ n: a }, { op: "＋" }, { blank: true }, { op: "＝" }, { n: 10 }],
      answer: b,
      choices: uniqueChoices(b, [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== b), 4),
    };
  }

  function genTriple() {
    let a = randInt(1, 8);
    let b = randInt(1, 8);
    let c = randInt(1, 8);
    while (a + b + c > 24) {
      a = randInt(1, 6);
      b = randInt(1, 6);
      c = randInt(1, 6);
    }
    const ans = a + b + c;
    return {
      type: "triple",
      prompt: `${a} ＋ ${b} ＋ ${c} ＝ ？`,
      viz: a + b + c <= 15 && a <= 6 && b <= 6 && c <= 6
        ? [{ n: a }, { op: "＋" }, { n: b }, { op: "＋" }, { n: c }]
        : [],
      answer: ans,
      choices: uniqueChoices(ans, [ans - 3, ans - 2, ans - 1, ans + 1, ans + 2, ans + 3, a + b, b + c].filter((x) => x > 0), 4),
    };
  }

  function genMissing() {
    // □ + b = sum  OR  a + □ = sum
    const mode = Math.random() < 0.5 ? "left" : "right";
    const sum = randInt(8, 18);
    const known = randInt(2, Math.min(9, sum - 1));
    const missing = sum - known;
    let prompt, viz;
    if (mode === "left") {
      prompt = `□ ＋ ${known} ＝ ${sum}`;
      viz = [{ blank: true }, { op: "＋" }, { n: Math.min(known, 10) }, { op: "＝" }, { n: Math.min(sum, 10) }];
      if (known > 10 || sum > 10) viz = [];
    } else {
      prompt = `${known} ＋ □ ＝ ${sum}`;
      viz = [{ n: Math.min(known, 10) }, { op: "＋" }, { blank: true }, { op: "＝" }, { n: Math.min(sum, 10) }];
      if (known > 10 || sum > 10) viz = [];
    }
    return {
      type: "missing",
      prompt,
      viz,
      answer: missing,
      choices: uniqueChoices(missing, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, missing - 1, missing + 1].filter((x) => x > 0 && x <= 18), 4),
    };
  }

  /** Split target into count positive integers (each 1..maxPart). */
  function splitSum(target, count, maxPart) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const parts = [];
      let remaining = target;
      for (let i = 0; i < count - 1; i++) {
        const slotsLeft = count - i - 1;
        const minHere = 1;
        const maxHere = Math.min(maxPart, remaining - slotsLeft);
        if (maxHere < minHere) break;
        const n = randInt(minHere, maxHere);
        parts.push(n);
        remaining -= n;
      }
      if (parts.length !== count - 1) continue;
      if (remaining < 1 || remaining > maxPart) continue;
      parts.push(remaining);
      return shuffle(parts);
    }
    return null;
  }

  /**
   * Compose: child drags three number chips into slots to make the target.
   * Pool has 5–7 chips (P1-friendly 1–15) with at least one valid trio.
   */
  function genCompose() {
    const diff = state.diff || "mid";
    let target;
    if (diff === "hard") target = randInt(14, 22);
    else if (diff === "mid") target = randInt(12, 18);
    else target = randInt(10, 15);

    const maxPart = Math.min(15, target - 2);
    let solution = splitSum(target, 3, maxPart);
    if (!solution) {
      solution = shuffle([1, 1, Math.max(1, target - 2)]);
      if (solution[2] > 15) {
        solution = [Math.min(9, target - 2), 1, Math.max(1, target - 10)];
      }
    }
    // Clamp parts to 1–15
    solution = solution.map((n) => Math.min(15, Math.max(1, n)));
    // Fix sum if clamp broke it
    let solSum = solution.reduce((s, n) => s + n, 0);
    if (solSum !== target) {
      const a = Math.min(9, Math.max(1, Math.floor(target / 3)));
      const b = Math.min(9, Math.max(1, Math.floor((target - a) / 2)));
      const c = target - a - b;
      solution = shuffle([a, b, Math.min(15, Math.max(1, c))]);
      if (solution.reduce((s, n) => s + n, 0) !== target) {
        solution = [1, 2, Math.min(15, target - 3)];
        if (solution[2] < 1) solution = [1, 1, Math.max(1, target - 2)];
      }
    }

    const poolSize = randInt(5, 7);
    const poolValues = solution.slice();
    let guard = 0;
    while (poolValues.length < poolSize && guard < 80) {
      guard++;
      const d = randInt(1, Math.min(15, Math.max(6, target - 1)));
      // Prefer distractors that aren't already over-represented
      const countSame = poolValues.filter((x) => x === d).length;
      if (countSame >= 2) continue;
      poolValues.push(d);
    }
    while (poolValues.length < poolSize) {
      poolValues.push(randInt(1, 9));
    }

    const pool = shuffle(poolValues).map((value, i) => ({
      id: "c" + i + "-" + value + "-" + Math.random().toString(36).slice(2, 6),
      value,
    }));

    return {
      type: "compose",
      prompt: `拖三個數字湊成 ${target}`,
      viz: target <= 10 ? [{ n: target }] : [],
      target,
      pool,
      solution: solution.slice(),
      mode: "drag",
    };
  }

  const GENERATORS = {
    simple10: genSimple10,
    simple20: genSimple20,
    make10: genMake10,
    triple: genTriple,
    missing: genMissing,
    compose: genCompose,
  };

  function buildRound(diffKey) {
    const weights = DIFF[diffKey].weights;
    const qs = [];
    const typeCounts = {};
    for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
      const t = pickWeighted(weights);
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      qs.push(GENERATORS[t]());
    }
    // Ensure variety: if mid/hard missing compose or triple, force inject
    if (diffKey === "mid") {
      ensureType(qs, "missing", weights);
      ensureType(qs, "compose", weights);
      ensureType(qs, "simple20", weights);
    }
    if (diffKey === "hard") {
      ensureType(qs, "triple", weights);
      ensureType(qs, "missing", weights);
      ensureType(qs, "compose", weights);
    }
    if (diffKey === "easy") {
      ensureType(qs, "make10", weights);
      ensureType(qs, "simple10", weights);
    }
    return shuffle(qs);
  }

  function ensureType(qs, type, weights) {
    if (weights[type] <= 0) return;
    if (qs.some((q) => q.type === type)) return;
    qs[randInt(0, qs.length - 1)] = GENERATORS[type]();
  }

  // —— Screens ——
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function startGame(diff) {
    unlockAudio();
    SFX.blip();
    state.diff = diff;
    state.questions = buildRound(diff);
    state.index = 0;
    state.stars = 0;
    state.correct = 0;
    state.locked = false;
    $("star-count").textContent = "0";
    showScreen("play");
    renderQuestion();
  }

  // —— Compose drag / tap state ——
  let composeUI = null;

  function clearComposeUI() {
    composeUI = null;
    const ghost = document.getElementById("compose-ghost");
    if (ghost) ghost.remove();
  }

  function renderQuestion() {
    clearComposeUI();
    const q = state.questions[state.index];
    const total = state.questions.length;
    const n = state.index + 1;
    $("progress-fill").style.width = ((n - 1) / total) * 100 + "%";
    $("progress-text").textContent = `${n} / ${total}`;
    $("type-badge").textContent = TYPE_LABELS[q.type] || "";
    $("question-text").textContent = q.prompt;
    if (q.type === "compose" && q.mode === "drag") {
      const el = $("block-viz");
      el.innerHTML = "";
      const big = document.createElement("div");
      big.className = "compose-big-target";
      big.textContent = String(q.target);
      el.appendChild(big);
    } else if (q.viz && q.viz.length) {
      renderViz(q.viz);
    } else {
      $("block-viz").innerHTML = "";
    }
    const fb = $("feedback");
    fb.hidden = true;
    fb.className = "feedback";
    fb.textContent = "";

    const box = $("choices");
    box.innerHTML = "";
    box.className = "choices";

    if (q.type === "compose" && q.mode === "drag") {
      box.className = "choices compose-board";
      renderComposeBoard(box, q);
    } else {
      q.choices.forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        btn.dataset.value = String(c);
        btn.textContent = String(c);
        btn.addEventListener("click", () => onAnswer(c, btn));
        box.appendChild(btn);
      });
    }
    state.locked = false;
  }

  function renderComposeBoard(box, q) {
    const slotsRow = document.createElement("div");
    slotsRow.className = "compose-slots";
    slotsRow.setAttribute("role", "group");
    slotsRow.setAttribute("aria-label", "三個數字位置");
    const slots = [];
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement("div");
      slot.className = "compose-slot";
      slot.dataset.slot = String(i);
      slot.setAttribute("aria-label", "空位 " + (i + 1));
      slotsRow.appendChild(slot);
      slots.push(slot);
    }
    box.appendChild(slotsRow);

    const hint = document.createElement("p");
    hint.className = "compose-hint";
    hint.textContent = "拖去空位，或者先撳數字再撳空位";
    box.appendChild(hint);

    const poolEl = document.createElement("div");
    poolEl.className = "compose-pool";
    poolEl.setAttribute("role", "group");
    poolEl.setAttribute("aria-label", "數字積木");
    box.appendChild(poolEl);

    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "compose-check-btn";
    checkBtn.textContent = "檢查";
    checkBtn.disabled = true;
    box.appendChild(checkBtn);

    composeUI = {
      q,
      slots: [null, null, null], // chip ids
      selectedId: null,
      chipEls: new Map(),
      slotEls: slots,
      poolEl,
      checkBtn,
      dragging: null,
    };

    q.pool.forEach((chip) => {
      const el = makeComposeChip(chip);
      composeUI.chipEls.set(chip.id, el);
      poolEl.appendChild(el);
    });

    checkBtn.addEventListener("click", () => {
      if (state.locked) return;
      tryComposeCheck();
    });
  }

  function makeComposeChip(chip) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "compose-chip " + colorClass(chip.value);
    el.dataset.chipId = chip.id;
    el.dataset.value = String(chip.value);
    el.textContent = String(chip.value);
    el.setAttribute("aria-label", "數字 " + chip.value);

    // Tap-to-select
    el.addEventListener("click", (e) => {
      if (state.locked || (composeUI && composeUI.dragging)) return;
      e.preventDefault();
      e.stopPropagation();
      unlockAudio();
      SFX.tap();
      onComposeChipTap(chip.id);
    });

    // Pointer drag (touch + mouse)
    el.addEventListener("pointerdown", (e) => {
      if (state.locked) return;
      if (e.button != null && e.button !== 0) return;
      e.stopPropagation();
      beginComposeDrag(chip.id, el, e);
    });

    return el;
  }

  function onComposeChipTap(chipId) {
    if (!composeUI || state.locked) return;
    const slotIdx = composeUI.slots.indexOf(chipId);
    if (slotIdx >= 0) {
      // Return chip from slot to pool
      composeUI.slots[slotIdx] = null;
      composeUI.selectedId = null;
      placeChipInPool(chipId);
      refreshComposeSelection();
      updateComposeCheckEnabled();
      return;
    }
    // Select / deselect from pool
    if (composeUI.selectedId === chipId) {
      composeUI.selectedId = null;
    } else {
      composeUI.selectedId = chipId;
    }
    refreshComposeSelection();
  }

  function onSlotTap(slotIndex) {
    if (!composeUI || state.locked) return;
    unlockAudio();
    SFX.tap();
    const existing = composeUI.slots[slotIndex];
    if (composeUI.selectedId) {
      const sel = composeUI.selectedId;
      // If selected chip is already in another slot, clear that slot
      const prev = composeUI.slots.indexOf(sel);
      if (prev >= 0) composeUI.slots[prev] = null;
      // If slot occupied, return that chip to pool first
      if (existing && existing !== sel) {
        placeChipInPool(existing);
      }
      composeUI.slots[slotIndex] = sel;
      composeUI.selectedId = null;
      placeChipInSlot(sel, slotIndex);
      refreshComposeSelection();
      updateComposeCheckEnabled();
      maybeAutoCheck();
      return;
    }
    // No selection: tap occupied slot returns chip
    if (existing) {
      composeUI.slots[slotIndex] = null;
      placeChipInPool(existing);
      refreshComposeSelection();
      updateComposeCheckEnabled();
    }
  }

  function placeChipInPool(chipId) {
    const el = composeUI.chipEls.get(chipId);
    if (!el) return;
    el.classList.remove("in-slot", "selected", "dragging");
    composeUI.poolEl.appendChild(el);
  }

  function placeChipInSlot(chipId, slotIndex) {
    const el = composeUI.chipEls.get(chipId);
    const slot = composeUI.slotEls[slotIndex];
    if (!el || !slot) return;
    el.classList.add("in-slot");
    el.classList.remove("selected", "dragging");
    slot.appendChild(el);
  }

  function refreshComposeSelection() {
    if (!composeUI) return;
    composeUI.chipEls.forEach((el, id) => {
      el.classList.toggle("selected", id === composeUI.selectedId);
    });
    composeUI.slotEls.forEach((slot, i) => {
      slot.classList.toggle("filled", composeUI.slots[i] != null);
      slot.classList.toggle("awaiting", !!composeUI.selectedId && composeUI.slots[i] == null);
      // Re-bind tap on slot (empty area)
      slot.onclick = () => onSlotTap(i);
    });
  }

  function updateComposeCheckEnabled() {
    if (!composeUI) return;
    const full = composeUI.slots.every((id) => id != null);
    composeUI.checkBtn.disabled = !full || state.locked;
  }

  function maybeAutoCheck() {
    if (!composeUI || state.locked) return;
    if (composeUI.slots.every((id) => id != null)) {
      // Brief pause so kid sees the filled slots
      setTimeout(() => {
        if (!composeUI || state.locked) return;
        if (composeUI.slots.every((id) => id != null)) tryComposeCheck();
      }, 280);
    }
  }

  function beginComposeDrag(chipId, el, e) {
    if (!composeUI || state.locked) return;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const rect = el.getBoundingClientRect();
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;

    composeUI.dragging = { chipId, pointerId, moved: false };

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        moved = true;
        composeUI.dragging.moved = true;
        // Lift into ghost
        el.classList.add("dragging");
        el.setPointerCapture(pointerId);
        let ghost = document.getElementById("compose-ghost");
        if (!ghost) {
          ghost = document.createElement("div");
          ghost.id = "compose-ghost";
          ghost.className = "compose-chip compose-ghost " + colorClass(Number(el.dataset.value));
          ghost.textContent = el.dataset.value;
          document.body.appendChild(ghost);
        }
        ghost.style.width = rect.width + "px";
        ghost.style.height = rect.height + "px";
        positionGhost(ghost, ev.clientX - offsetX, ev.clientY - offsetY);
        // Dim original
        el.classList.add("drag-source");
      }
      if (moved) {
        ev.preventDefault();
        const ghost = document.getElementById("compose-ghost");
        if (ghost) positionGhost(ghost, ev.clientX - offsetX, ev.clientY - offsetY);
        highlightSlotUnder(ev.clientX, ev.clientY);
      }
    };

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      const ghost = document.getElementById("compose-ghost");
      if (ghost) ghost.remove();
      el.classList.remove("dragging", "drag-source");
      composeUI.slotEls.forEach((s) => s.classList.remove("drop-hover"));

      const wasMoved = moved;
      composeUI.dragging = null;

      if (!wasMoved) {
        // Short press: let the click handler treat it as tap-to-select
        return;
      }

      // Suppress the synthetic click that follows a drag
      const suppressClick = (ce) => {
        ce.preventDefault();
        ce.stopPropagation();
        el.removeEventListener("click", suppressClick, true);
      };
      el.addEventListener("click", suppressClick, true);

      // Drop onto slot under pointer
      const slotIndex = slotIndexUnder(ev.clientX, ev.clientY);
      if (slotIndex != null) {
        unlockAudio();
        SFX.tap();
        // Remove from previous slot if any
        const prev = composeUI.slots.indexOf(chipId);
        if (prev >= 0) composeUI.slots[prev] = null;
        const existing = composeUI.slots[slotIndex];
        if (existing && existing !== chipId) placeChipInPool(existing);
        composeUI.slots[slotIndex] = chipId;
        composeUI.selectedId = null;
        placeChipInSlot(chipId, slotIndex);
        refreshComposeSelection();
        updateComposeCheckEnabled();
        maybeAutoCheck();
      } else {
        // Dropped outside: if was in slot and dropped on pool area, return; else restore
        const poolRect = composeUI.poolEl.getBoundingClientRect();
        const inPool =
          ev.clientX >= poolRect.left &&
          ev.clientX <= poolRect.right &&
          ev.clientY >= poolRect.top &&
          ev.clientY <= poolRect.bottom;
        const prev = composeUI.slots.indexOf(chipId);
        if (inPool && prev >= 0) {
          composeUI.slots[prev] = null;
          placeChipInPool(chipId);
          refreshComposeSelection();
          updateComposeCheckEnabled();
        } else if (prev < 0) {
          placeChipInPool(chipId);
        } else {
          placeChipInSlot(chipId, prev);
        }
        composeUI.selectedId = null;
        refreshComposeSelection();
      }
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  function positionGhost(ghost, x, y) {
    ghost.style.transform = "translate(" + x + "px," + y + "px)";
  }

  function slotIndexUnder(x, y) {
    if (!composeUI) return null;
    for (let i = 0; i < composeUI.slotEls.length; i++) {
      const r = composeUI.slotEls[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  }

  function highlightSlotUnder(x, y) {
    const idx = slotIndexUnder(x, y);
    composeUI.slotEls.forEach((s, i) => {
      s.classList.toggle("drop-hover", i === idx);
    });
  }

  function tryComposeCheck() {
    if (!composeUI || state.locked) return;
    if (!composeUI.slots.every((id) => id != null)) return;
    unlockAudio();
    SFX.tap();
    state.locked = true;
    composeUI.checkBtn.disabled = true;

    const q = composeUI.q;
    const values = composeUI.slots.map((id) => {
      const chip = q.pool.find((c) => c.id === id);
      return chip ? chip.value : 0;
    });
    const sum = values.reduce((s, n) => s + n, 0);
    const ok = sum === q.target;

    const fb = $("feedback");
    fb.hidden = false;

    // Lock chips
    composeUI.chipEls.forEach((el) => {
      el.disabled = true;
    });

    if (ok) {
      composeUI.slotEls.forEach((s) => s.classList.add("slot-correct"));
      state.stars += 1;
      state.correct += 1;
      $("star-count").textContent = String(state.stars);
      fb.hidden = true;
      fb.textContent = "";
      const chip = document.querySelector(".star-chip");
      if (chip) {
        chip.classList.remove("star-pop");
        void chip.offsetWidth;
        chip.classList.add("star-pop");
      }
      SFX.correct();
      celebrate();
    } else {
      composeUI.slotEls.forEach((s) => s.classList.add("slot-wrong"));
      const example = q.solution.slice();
      fb.className = "feedback bad";
      fb.innerHTML =
        "答錯喇～例如可以係 " +
        '<span class="feedback-chips">' +
        example
          .map(
            (n) =>
              '<span class="choice-chip ' +
              colorClass(n) +
              '">' +
              n +
              "</span>"
          )
          .join("") +
        "</span>";
      SFX.wrong();
    }

    const total = state.questions.length;
    $("progress-fill").style.width = ((state.index + 1) / total) * 100 + "%";

    setTimeout(() => {
      if (state.index + 1 >= total) {
        showEnd();
      } else {
        state.index += 1;
        renderQuestion();
      }
    }, ok ? 1100 : 2000);
  }

  function onAnswer(choice, btn) {
    if (state.locked) return;
    unlockAudio();
    SFX.tap();
    state.locked = true;
    const q = state.questions[state.index];
    const ok = choice === q.answer;
    const buttons = [...$("choices").querySelectorAll(".choice-btn")];
    buttons.forEach((b) => (b.disabled = true));

    const fb = $("feedback");
    fb.hidden = false;

    if (ok) {
      btn.classList.add("correct");
      state.stars += 1;
      state.correct += 1;
      $("star-count").textContent = String(state.stars);
      // Stars only at top — no bottom toast for correct answers
      fb.hidden = true;
      fb.textContent = "";
      const chip = document.querySelector(".star-chip");
      if (chip) {
        chip.classList.remove("star-pop");
        void chip.offsetWidth;
        chip.classList.add("star-pop");
      }
      SFX.correct();
      celebrate();
    } else {
      btn.classList.add("wrong");
      buttons.forEach((b) => {
        const val = b.dataset.value != null ? b.dataset.value : b.textContent;
        if (val === String(q.answer)) b.classList.add("reveal");
      });
      fb.className = "feedback bad";
      fb.textContent = `答錯喇～正確答案係 ${q.answer}`;
      SFX.wrong();
    }

    // advance progress bar to current
    const total = state.questions.length;
    $("progress-fill").style.width = ((state.index + 1) / total) * 100 + "%";

    setTimeout(() => {
      if (state.index + 1 >= total) {
        showEnd();
      } else {
        state.index += 1;
        renderQuestion();
      }
    }, ok ? 1100 : 1600);
  }

  function celebrate() {
    const overlay = $("celebrate");
    overlay.hidden = false;
    overlay.innerHTML = "";
    const emojis = ["⭐", "✨", "🌟", "🎉", "💛"];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      p.textContent = emojis[i % emojis.length];
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDuration = 0.9 + Math.random() * 0.8 + "s";
      p.style.animationDelay = Math.random() * 0.15 + "s";
      overlay.appendChild(p);
    }
    setTimeout(() => {
      overlay.hidden = true;
      overlay.innerHTML = "";
    }, 1400);
  }

  function showEnd() {
    showScreen("end");
    const total = state.questions.length;
    const c = state.correct;
    const ratio = c / total;
    let title, msg;
    if (ratio === 1) {
      title = "完美！全對！";
      msg = "你係加數積木小達人！";
    } else if (ratio >= 0.75) {
      title = "好叻呀！";
      msg = "差唔多滿分，繼續加油！";
    } else if (ratio >= 0.5) {
      title = "做得唔錯！";
      msg = "再練習多幾次會更好！";
    } else {
      title = "繼續努力！";
      msg = "慢慢嚟，積木會幫你數！";
    }
    $("end-title").textContent = title;
    $("end-msg").textContent = msg;
    $("end-correct").textContent = String(c);
    $("end-total").textContent = String(total);

    // 5-star display based on score
    const starEl = $("end-stars");
    starEl.innerHTML = "";
    const filled = Math.round(ratio * 5);
    for (let i = 0; i < 5; i++) {
      const s = document.createElement("span");
      s.textContent = "★";
      if (i >= filled) s.className = "dim";
      starEl.appendChild(s);
    }

    const eb = $("end-blocks");
    eb.innerHTML = "";
    [Math.min(c, 10) || 1, 5, 3].forEach((n) => eb.appendChild(renderBlockTower(n, "")));
  }

  // —— Events ——
  // Unlock AudioContext on first user gesture (iPhone Safari)
  document.addEventListener(
    "pointerdown",
    () => {
      unlockAudio();
    },
    { once: true, passive: true }
  );

  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", () => startGame(btn.dataset.diff));
  });
  $("btn-quit").addEventListener("click", () => {
    unlockAudio();
    SFX.tap();
    showScreen("home");
  });
  $("btn-again").addEventListener("click", () => {
    if (state.diff) startGame(state.diff);
  });
  $("btn-home").addEventListener("click", () => {
    unlockAudio();
    SFX.tap();
    showScreen("home");
  });

  document.querySelectorAll(".mute-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSound();
    });
  });
  updateMuteUI();

  fillLogo();
})();

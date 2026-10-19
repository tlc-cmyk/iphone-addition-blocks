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

  function formatGroup(nums) {
    return nums.join("＋");
  }

  function groupKey(nums) {
    return nums.slice().sort((a, b) => a - b).join(",");
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

  function genCompose() {
    // Which group of 3–4 numbers sums to target?
    const diff = state.diff || "mid";
    let target;
    if (diff === "hard") target = randInt(14, 20);
    else if (diff === "mid") target = randInt(12, 18);
    else target = randInt(10, 16);

    const count = Math.random() < 0.55 ? 4 : 3;
    const maxPart = Math.min(10, target - (count - 1));

    let correct = splitSum(target, count, maxPart);
    if (!correct) {
      // fallback: mostly 1s + remainder
      correct = Array(count - 1).fill(1);
      correct.push(target - (count - 1));
      correct = shuffle(correct);
    }
    const correctStr = formatGroup(correct);
    const seen = new Set([groupKey(correct)]);

    const wrongs = [];
    let guard = 0;
    while (wrongs.length < 3 && guard < 120) {
      guard++;
      const wCount = Math.random() < 0.55 ? 4 : 3;
      // Nearby wrong sums so it is not trivial
      const offsets = [-3, -2, -1, 1, 2, 3];
      const offset = offsets[randInt(0, offsets.length - 1)];
      let wTarget = target + offset;
      if (wTarget < wCount) wTarget = target + Math.abs(offset);
      if (wTarget === target) continue;
      const wMax = Math.min(10, wTarget - (wCount - 1));
      if (wMax < 1) continue;
      const parts = splitSum(wTarget, wCount, wMax);
      if (!parts) continue;
      const key = groupKey(parts);
      if (seen.has(key)) continue;
      // Extra safety: sum must not equal target
      if (parts.reduce((s, n) => s + n, 0) === target) continue;
      seen.add(key);
      wrongs.push(formatGroup(parts));
    }
    // Fill if needed with simple near-miss groups
    let fill = 0;
    while (wrongs.length < 3 && fill < 40) {
      fill++;
      const wCount = wrongs.length % 2 === 0 ? 4 : 3;
      const bump = wrongs.length + 1 + fill;
      const parts = Array(wCount - 1).fill(1);
      parts.push(Math.max(1, target + bump - (wCount - 1)));
      if (parts.reduce((s, n) => s + n, 0) === target) {
        parts[parts.length - 1] += 1;
      }
      const key = groupKey(parts);
      if (seen.has(key) || parts.reduce((s, n) => s + n, 0) === target) continue;
      seen.add(key);
      wrongs.push(formatGroup(shuffle(parts)));
    }

    const choices = shuffle([correctStr, ...wrongs.slice(0, 3)]);
    return {
      type: "compose",
      prompt: `邊一組加起嚟係 ${target}？`,
      viz: target <= 10 ? [{ n: target }] : [],
      answer: correctStr,
      choices,
      isString: true,
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

  function renderQuestion() {
    const q = state.questions[state.index];
    const total = state.questions.length;
    const n = state.index + 1;
    $("progress-fill").style.width = ((n - 1) / total) * 100 + "%";
    $("progress-text").textContent = `${n} / ${total}`;
    $("type-badge").textContent = TYPE_LABELS[q.type] || "";
    $("question-text").textContent = q.prompt;
    if (q.viz && q.viz.length) {
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
    q.choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = String(c);
      btn.addEventListener("click", () => onAnswer(c, btn));
      box.appendChild(btn);
    });
    state.locked = false;
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
        if (b.textContent === String(q.answer)) b.classList.add("reveal");
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

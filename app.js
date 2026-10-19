/**
 * 加數積木星星 — original number-block addition game (zh-HK)
 * Not affiliated with Numberblocks / BBC.
 */
(function () {
  "use strict";

  const QUESTIONS_PER_ROUND = 20;

  const TYPE_LABELS = {
    simple10: "1–10 簡單加法",
    simple20: "1–20 加法",
    make10: "湊十",
    triple: "連加三個數",
    missing: "缺數",
    compose: "組合數式",
    numberSense: "認識數字",
    doubles: "雙同數",
    cross10: "跨十加法",
  };

  // make10 near-zero on mid/hard; easy only occasional. Prefer simple20 (crossing 10, doubles).
  const DIFF = {
    easy: {
      label: "易",
      weights: { simple10: 5, make10: 1, simple20: 6, missing: 1, compose: 0, triple: 0 },
    },
    mid: {
      label: "中",
      weights: { simple10: 1, simple20: 6, make10: 0, missing: 3, compose: 3, triple: 0 },
    },
    hard: {
      label: "難",
      weights: { simple10: 0, simple20: 4, make10: 0, missing: 2, compose: 4, triple: 4 },
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
    mode: "practice", // "practice" | "learn"
    lessonId: null,
    teachStep: 0,
  };

  // —— Learn Zone curriculum ——
  const LEARN_KEY = "addition-blocks-learn";
  const LESSONS_PER_PRACTICE = 9;

  const LEARN_LESSONS = [
    {
      id: 1,
      emoji: "🔢",
      title: "認識數字同數粒",
      blurb: "數一數，對應數字",
      typeLabel: "認識數字",
      teach: [
        {
          headline: "數字同數粒係好朋友",
          body: "見到 3，就諗到三粒積木。一粒對一個，數得啱就叻！",
          viz: "numberSense1",
        },
        {
          headline: "用手指數一數",
          body: "由左邊數到右邊，數到最後嗰粒，口裏講出嚟嘅數字就係答案。",
          viz: "numberSense2",
        },
        {
          headline: "準備練習喇！",
          body: "下面有啲數粒同數字，幫我哋揀正確嘅數目啦～",
          viz: "numberSense3",
        },
      ],
    },
    {
      id: 2,
      emoji: "➕",
      title: "10 以內加法",
      blurb: "兩數加埋唔超過 10",
      typeLabel: "10 以內加法",
      teach: [
        {
          headline: "兩堆加埋",
          body: "左邊幾多，右邊幾多，一齊數晒就係總數。",
          viz: "add10_1",
        },
        {
          headline: "例如 4 ＋ 3",
          body: "先數 4 粒，再數多 3 粒，一共 7 粒。答案寫 7。",
          viz: "add10_2",
        },
        {
          headline: "開始練習",
          body: "全部答案都會喺 10 以內，放膽數！",
          viz: "add10_3",
        },
      ],
    },
    {
      id: 3,
      emoji: "👯",
      title: "雙同數",
      blurb: "一樣大嘅兩個數相加",
      typeLabel: "雙同數",
      teach: [
        {
          headline: "雙同數係咩？",
          body: "兩個一樣嘅數字加埋，例如 6＋6、7＋7，好易記！",
          viz: "doubles1",
        },
        {
          headline: "對稱好得意",
          body: "左右兩邊一樣高，加埋就係雙倍。5＋5＝10，好特別！",
          viz: "doubles2",
        },
        {
          headline: "記熟雙同數",
          body: "練多幾條，之後見到雙同數就即刻識答。",
          viz: "doubles3",
        },
      ],
    },
    {
      id: 4,
      emoji: "🌉",
      title: "跨十加法",
      blurb: "加埋超過 10，學過十",
      typeLabel: "跨十加法",
      teach: [
        {
          headline: "加埋超過 10",
          body: "好像 8＋5，結果大過 10。可以「過十」嚟想。",
          viz: "cross1",
        },
        {
          headline: "過十小秘訣",
          body: "8 再加 2 就到 10，5 入面用咗 2，剩 3。所以 10＋3＝13。",
          viz: "cross2",
        },
        {
          headline: "慢慢嚟就得",
          body: "唔使死記湊十，數清楚或者過十都得。開始練習啦！",
          viz: "cross3",
        },
      ],
    },
    {
      id: 5,
      emoji: "❓",
      title: "缺數同連加",
      blurb: "搵□同三個數加埋",
      typeLabel: "缺數／連加",
      teach: [
        {
          headline: "缺數係咩？",
          body: "□＋5＝12，問嘅係空格要填幾多。想：12 減 5，或者由 5 數到 12。",
          viz: "miss1",
        },
        {
          headline: "三個數連加",
          body: "2＋3＋4，可以先加前面兩個，再加第三個。",
          viz: "miss2",
        },
        {
          headline: "兩種都會練",
          body: "有啲題搵缺數，有啲題三數連加，加油！",
          viz: "miss3",
        },
      ],
    },
    {
      id: 6,
      emoji: "🎯",
      title: "拖數字湊總數",
      blurb: "三個空位拖出目標",
      typeLabel: "組合數式",
      teach: [
        {
          headline: "湊成目標數字",
          body: "下面有數字積木，拖三個去空位，令佢哋加埋等於目標。",
          viz: "compose1",
        },
        {
          headline: "空位長咁樣",
          body: "□ ＋ □ ＋ □ ＝ 目標。可以拖，又可以先撳數字再撳空位。",
          viz: "compose2",
        },
        {
          headline: "唔止一個答案",
          body: "只要三個數加埋啱目標就得。試下唔同組合啦！",
          viz: "compose3",
        },
      ],
    },
  ];

  function loadLearnProgress() {
    try {
      const raw = localStorage.getItem(LEARN_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          unlocked: Math.max(1, Math.min(6, Number(data.unlocked) || 1)),
          completed: Array.isArray(data.completed)
            ? data.completed.map(Number).filter((n) => n >= 1 && n <= 6)
            : [],
          bestStars: data.bestStars && typeof data.bestStars === "object" ? data.bestStars : {},
        };
      }
    } catch (_) { /* ignore */ }
    return { unlocked: 1, completed: [], bestStars: {} };
  }

  function saveLearnProgress(prog) {
    try {
      localStorage.setItem(LEARN_KEY, JSON.stringify(prog));
    } catch (_) { /* ignore */ }
  }

  function markLessonComplete(lessonId, stars) {
    const prog = loadLearnProgress();
    if (!prog.completed.includes(lessonId)) prog.completed.push(lessonId);
    const key = String(lessonId);
    const prev = Number(prog.bestStars[key]) || 0;
    if (stars > prev) prog.bestStars[key] = stars;
    if (lessonId >= prog.unlocked && lessonId < 6) {
      prog.unlocked = lessonId + 1;
    }
    if (lessonId === 6) prog.unlocked = 6;
    saveLearnProgress(prog);
    return prog;
  }


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
    learnMap: $("screen-learn-map"),
    teach: $("screen-teach"),
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


  // —— Mixed representations (numeral vs counting objects) ——
  // Easy slightly more pictures; hard mostly numbers. Overall ~20–30% objects.
  const OBJECT_CHANCE = { easy: 0.38, mid: 0.40, hard: 0.18 };
  const OBJECT_KINDS = ["cubes", "dots", "fruit", "stars"];
  const FRUIT_EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🥝", "🫐"];
  const STAR_EMOJIS = ["⭐", "🌟", "✨"];
  const DOT_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
    "#3b82f6", "#8b5cf6", "#ec4899", "#a855f7", "#06b6d4",
  ];

  function pickObjectKind() {
    return OBJECT_KINDS[randInt(0, OBJECT_KINDS.length - 1)];
  }

  /** Eligible when all countable shown quantities are ≤ 10 (and type supports pictures). */
  function canUseObjects(q) {
    if (!q || q.type === "compose") return false;
    const nums = [];
    if (q.viz && q.viz.length) {
      q.viz.forEach((p) => {
        if (p.n != null) nums.push(p.n);
      });
    }
    if (!nums.length) {
      // Fall back: parse simple prompts when viz empty (e.g. large simple20)
      return false;
    }
    return nums.every((n) => n >= 1 && n <= 10);
  }

  function shouldPickObjects(diffKey) {
    const p = OBJECT_CHANCE[diffKey] != null ? OBJECT_CHANCE[diffKey] : 0.22;
    return Math.random() < p;
  }

  /**
   * Attach displayMode / objectKind / operandModes to a question.
   * operandModes: parallel to viz number slots — 'numeral' | 'objects'
   * Mixed: sometimes only one side is pictorial.
   */
  function applyDisplayMode(q, diffKey) {
    q.displayMode = "numeral";
    q.objectKind = null;
    q.operandModes = null;
    if (!canUseObjects(q)) return q;
    if (!shouldPickObjects(diffKey || state.diff || "mid")) return q;

    const kind = pickObjectKind();
    const numSlots = (q.viz || []).filter((p) => p.n != null).length;
    // ~40% mixed (one side objects) when ≥2 number parts; else all objects
    let modes;
    if (numSlots >= 2 && Math.random() < 0.4) {
      modes = [];
      let objCount = 0;
      for (let i = 0; i < numSlots; i++) {
        const useObj = Math.random() < 0.55;
        modes.push(useObj ? "objects" : "numeral");
        if (useObj) objCount++;
      }
      if (objCount === 0) modes[0] = "objects";
      if (objCount === numSlots) modes[randInt(0, numSlots - 1)] = "numeral";
    } else {
      modes = Array(numSlots).fill("objects");
    }

    const anyObj = modes.some((m) => m === "objects");
    if (!anyObj) return q;

    q.displayMode = modes.every((m) => m === "objects") ? "objects" : "mixed";
    q.objectKind = kind;
    q.operandModes = modes;
    return q;
  }

  /** One chip px for every object on screen — bigger when fewer items. */
  function pickUniformChipPx(counts) {
    const list = (counts || []).filter((n) => n > 0);
    if (!list.length) return 32;
    const maxN = Math.max.apply(null, list);
    const groups = list.length;
    const total = list.reduce((a, b) => a + b, 0);
    // iPhone portrait: keep chips large; never drop to tiny sm sizes
    if (total <= 5 && groups <= 2) return 40;
    if (total <= 8 && maxN <= 5) return 36;
    if (total <= 12 && maxN <= 7) return 32;
    if (total <= 18) return 28;
    return 26;
  }

  function renderObjectGroup(n, kind) {
    const wrap = document.createElement("div");
    wrap.className = "obj-group";
    wrap.setAttribute("aria-label", String(n));
    wrap.dataset.count = String(n);
    const k = kind || "cubes";
    const count = Math.min(Math.max(n, 1), 10);

    if (k === "cubes") {
      wrap.classList.add("obj-cubes");
      for (let i = 0; i < count; i++) {
        const cube = document.createElement("span");
        cube.className = "obj-cube " + colorClass(count);
        wrap.appendChild(cube);
      }
    } else if (k === "dots") {
      wrap.classList.add("obj-dots");
      const color = DOT_COLORS[(count - 1) % DOT_COLORS.length];
      for (let i = 0; i < count; i++) {
        const dot = document.createElement("span");
        dot.className = "obj-dot";
        dot.style.background = DOT_COLORS[i % DOT_COLORS.length];
        if (i === 0) wrap.style.setProperty("--obj-accent", color);
        wrap.appendChild(dot);
      }
    } else if (k === "fruit") {
      wrap.classList.add("obj-emoji");
      const emoji = FRUIT_EMOJIS[(count - 1) % FRUIT_EMOJIS.length];
      for (let i = 0; i < count; i++) {
        const s = document.createElement("span");
        s.className = "obj-emoji-item";
        s.textContent = emoji;
        wrap.appendChild(s);
      }
    } else {
      wrap.classList.add("obj-emoji");
      const emoji = STAR_EMOJIS[(count - 1) % STAR_EMOJIS.length];
      for (let i = 0; i < count; i++) {
        const s = document.createElement("span");
        s.className = "obj-emoji-item";
        s.textContent = emoji;
        wrap.appendChild(s);
      }
    }
    return wrap;
  }

  function buildObjectsPromptHint(q) {
    if (q.type === "make10") return "數粒粒，湊成 10";
    if (q.type === "missing") return "數粒粒，搵缺數";
    if (q.type === "triple") return "數粒粒，三數加埋";
    if (q.type === "numberSense") return "數粒粒，有幾多？";
    if (q.type === "doubles") return "數粒粒，雙同數加埋";
    if (q.type === "cross10") return "數粒粒，加埋有幾多？";
    return "數粒粒，加埋有幾多？";
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

  function renderViz(parts, size, q) {
    const el = $("block-viz");
    el.innerHTML = "";
    el.classList.remove("has-objects");
    el.style.removeProperty("--obj-chip");
    // parts: array of {n} or {op: '+'} or {op: '='} or {blank: true}
    const useSize = size || (parts.filter((p) => p.n != null).every((p) => p.n <= 5) ? "lg" : "");
    const modes = q && q.operandModes ? q.operandModes.slice() : null;
    const card = el.closest(".question-card");
    if (card) card.classList.remove("card-objects");

    // Pre-scan object counts so every group shares one chip size
    const objCounts = [];
    if (q && (q.displayMode === "objects" || q.displayMode === "mixed")) {
      let scanIdx = 0;
      parts.forEach((p) => {
        if (p.n == null) return;
        const mode = modes ? modes[scanIdx] : (q.displayMode === "objects" ? "objects" : "numeral");
        scanIdx++;
        if (mode === "objects") objCounts.push(p.n);
      });
    }
    const hasObjects = objCounts.length > 0;
    if (hasObjects) {
      el.classList.add("has-objects");
      if (card) card.classList.add("card-objects");
      el.style.setProperty("--obj-chip", pickUniformChipPx(objCounts) + "px");
    }

    let numIdx = 0;
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
        const mode = modes ? modes[numIdx] : "numeral";
        numIdx++;
        if (mode === "objects" && q && q.objectKind) {
          el.appendChild(renderObjectGroup(p.n, q.objectKind));
        } else if (q && q.displayMode === "objects") {
          el.appendChild(renderObjectGroup(p.n, (q && q.objectKind) || "cubes"));
        } else {
          el.appendChild(renderBlockTower(p.n, useSize || (p.n > 6 ? "sm" : "")));
        }
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
    // Bias: both addends ≥ 4 when possible (e.g. 4+5, 5+5, 6+4); still within 1–10.
    let a, b;
    if (Math.random() < 0.7) {
      a = randInt(4, 6);
      b = randInt(4, 10 - a);
    } else {
      a = randInt(1, 9);
      b = randInt(1, 10 - a);
    }
    if (Math.random() < 0.2) {
      // Occasional double within 1–10 (e.g. 4+4, 5+5)
      const d = randInt(4, 5);
      a = d;
      b = d;
    }
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
    // Prefer both ≥ 4, sums 11–20 (crossing ten), and occasional doubles (6+6, 7+7, 8+8).
    let a, b;
    const roll = Math.random();
    if (roll < 0.18) {
      // Doubles: 5+5 … 9+9 (sums 10–18)
      const d = randInt(5, 9);
      a = d;
      b = d;
    } else if (roll < 0.85) {
      // Crossing / general: both ≥ 4, sum 11–20
      a = randInt(4, 9);
      const minB = Math.max(4, 11 - a);
      const maxB = Math.min(9, 20 - a);
      if (minB <= maxB) {
        b = randInt(minB, maxB);
      } else {
        b = randInt(4, Math.min(9, 20 - a));
      }
    } else {
      // Occasional wider range still within 1–20
      a = randInt(3, 12);
      b = randInt(3, Math.min(12, 20 - a));
      if (a + b < 8) b = Math.min(20 - a, Math.max(b, 8 - a));
    }
    // Avoid pure make-ten pairs most of the time (those are rare make10 type)
    if (a + b === 10 && a !== b && Math.random() < 0.7) {
      b = Math.min(9, b + randInt(1, 3));
      if (a + b > 20) b = 20 - a;
    }
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

  // —— Learn-zone question builders ——
  function genNumberSense() {
    const n = randInt(1, 10);
    const kind = pickObjectKind();
    const roll = Math.random();
    if (roll < 0.55) {
      // Count objects
      return applyDisplayModeForce({
        type: "numberSense",
        prompt: "有幾多粒？",
        viz: [{ n }],
        answer: n,
        choices: uniqueChoices(n, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((x) => x !== n), 4),
        displayMode: "objects",
        objectKind: kind,
        operandModes: ["objects"],
      });
    }
    // Identify numeral from tower / objects mixed
    return applyDisplayModeForce({
      type: "numberSense",
      prompt: "呢個數字係幾多？",
      viz: [{ n }],
      answer: n,
      choices: uniqueChoices(n, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((x) => x !== n), 4),
      displayMode: "numeral",
      objectKind: null,
      operandModes: ["numeral"],
    });
  }

  function applyDisplayModeForce(q) {
    // Already stamped — skip random applyDisplayMode
    return q;
  }

  function genDoubles() {
    const d = randInt(2, 9);
    const ans = d + d;
    return {
      type: "doubles",
      prompt: `${d} ＋ ${d} ＝ ？`,
      viz: [{ n: d }, { op: "＋" }, { n: d }],
      answer: ans,
      choices: uniqueChoices(ans, [ans - 2, ans - 1, ans + 1, ans + 2, d, 10, 2 * d - 2].filter((x) => x > 0), 4),
    };
  }

  function genCross10() {
    // Crossing ten: sum 11–18, both addends 2–9, prefer not pure make-ten
    let a, b;
    for (let i = 0; i < 40; i++) {
      a = randInt(3, 9);
      b = randInt(3, 9);
      const s = a + b;
      if (s >= 11 && s <= 18) break;
    }
    if (a + b < 11) {
      a = randInt(5, 9);
      b = randInt(11 - a, 9);
    }
    // Avoid exact complements of 10 as the main pattern
    if (a + b === 10) b = Math.min(9, b + 2);
    const ans = a + b;
    return {
      type: "cross10",
      prompt: `${a} ＋ ${b} ＝ ？`,
      viz: [{ n: a }, { op: "＋" }, { n: b }],
      answer: ans,
      choices: uniqueChoices(ans, [ans - 2, ans - 1, ans + 1, ans + 2, 10, a + b - 10 + 10, a, b].filter((x) => x > 0 && x <= 20), 4),
    };
  }

  function genLearnMissing() {
    const sum = randInt(6, 14);
    const known = randInt(2, Math.min(9, sum - 1));
    const missing = sum - known;
    const mode = Math.random() < 0.5 ? "left" : "right";
    let prompt, viz;
    if (mode === "left") {
      prompt = `□ ＋ ${known} ＝ ${sum}`;
      viz = known <= 10 && sum <= 10
        ? [{ blank: true }, { op: "＋" }, { n: known }, { op: "＝" }, { n: sum }]
        : [];
    } else {
      prompt = `${known} ＋ □ ＝ ${sum}`;
      viz = known <= 10 && sum <= 10
        ? [{ n: known }, { op: "＋" }, { blank: true }, { op: "＝" }, { n: sum }]
        : [];
    }
    return {
      type: "missing",
      prompt,
      viz,
      answer: missing,
      choices: uniqueChoices(missing, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, missing - 1, missing + 1].filter((x) => x > 0 && x <= 16), 4),
    };
  }

  function genLearnTriple() {
    let a = randInt(1, 6);
    let b = randInt(1, 6);
    let c = randInt(1, 6);
    while (a + b + c > 18) {
      a = randInt(1, 5);
      b = randInt(1, 5);
      c = randInt(1, 5);
    }
    const ans = a + b + c;
    return {
      type: "triple",
      prompt: `${a} ＋ ${b} ＋ ${c} ＝ ？`,
      viz: a <= 6 && b <= 6 && c <= 6
        ? [{ n: a }, { op: "＋" }, { n: b }, { op: "＋" }, { n: c }]
        : [],
      answer: ans,
      choices: uniqueChoices(ans, [ans - 2, ans - 1, ans + 1, ans + 2, a + b, b + c].filter((x) => x > 0), 4),
    };
  }

  function genLearnCompose() {
    // Gentler targets for lesson 6
    const prev = state.diff;
    state.diff = "mid";
    const q = genCompose();
    state.diff = prev;
    // Prefer targets 10–16
    if (q.target < 10 || q.target > 16) {
      const target = randInt(10, 16);
      const solution = splitSum(target, 3, Math.min(9, target - 2)) || [2, 3, target - 5];
      const poolSize = randInt(5, 6);
      const poolValues = solution.slice();
      while (poolValues.length < poolSize) {
        const d = randInt(1, 9);
        if (poolValues.filter((x) => x === d).length >= 2) continue;
        poolValues.push(d);
      }
      return {
        type: "compose",
        prompt: `拖三個數字湊成 ${target}`,
        viz: target <= 10 ? [{ n: target }] : [],
        target,
        pool: shuffle(poolValues).map((value, i) => ({
          id: "c" + i + "-" + value + "-" + Math.random().toString(36).slice(2, 6),
          value,
        })),
        solution: solution.slice(),
        mode: "drag",
      };
    }
    return q;
  }

  function buildLessonQuestions(lessonId) {
    const qs = [];
    const n = LESSONS_PER_PRACTICE;
    if (lessonId === 1) {
      for (let i = 0; i < n; i++) qs.push(genNumberSense());
    } else if (lessonId === 2) {
      for (let i = 0; i < n; i++) {
        const q = genSimple10();
        // Bias more objects for lesson 2
        qs.push(applyDisplayMode(q, "easy"));
      }
    } else if (lessonId === 3) {
      for (let i = 0; i < n; i++) qs.push(applyDisplayMode(genDoubles(), "easy"));
    } else if (lessonId === 4) {
      for (let i = 0; i < n; i++) qs.push(applyDisplayMode(genCross10(), "mid"));
    } else if (lessonId === 5) {
      for (let i = 0; i < n; i++) {
        const q = i % 2 === 0 ? genLearnMissing() : genLearnTriple();
        qs.push(applyDisplayMode(q, "mid"));
      }
    } else if (lessonId === 6) {
      for (let i = 0; i < n; i++) qs.push(genLearnCompose());
    }
    return shuffle(qs);
  }


  function buildRound(diffKey) {
    const weights = DIFF[diffKey].weights;
    const qs = [];
    const typeCounts = {};
    for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
      const t = pickWeighted(weights);
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      qs.push(applyDisplayMode(GENERATORS[t](), diffKey));
    }
    // Ensure variety: if mid/hard missing compose or triple, force inject
    if (diffKey === "mid") {
      ensureType(qs, "missing", weights, diffKey);
      ensureType(qs, "compose", weights, diffKey);
      ensureType(qs, "simple20", weights, diffKey);
    }
    if (diffKey === "hard") {
      ensureType(qs, "triple", weights, diffKey);
      ensureType(qs, "missing", weights, diffKey);
      ensureType(qs, "compose", weights, diffKey);
    }
    if (diffKey === "easy") {
      ensureType(qs, "simple10", weights, diffKey);
      ensureType(qs, "simple20", weights, diffKey);
      ensureType(qs, "make10", weights, diffKey);
    }
    return shuffle(qs);
  }

  function ensureType(qs, type, weights, diffKey) {
    if (weights[type] <= 0) return;
    if (qs.some((q) => q.type === type)) return;
    qs[randInt(0, qs.length - 1)] = applyDisplayMode(GENERATORS[type](), diffKey || state.diff || "mid");
  }

  // —— Screens ——
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function startGame(diff) {
    unlockAudio();
    SFX.blip();
    state.mode = "practice";
    state.lessonId = null;
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

  function startLessonPractice(lessonId) {
    unlockAudio();
    SFX.blip();
    state.mode = "learn";
    state.lessonId = lessonId;
    state.diff = "learn";
    state.questions = buildLessonQuestions(lessonId);
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
    if (state.mode === "learn" && state.lessonId) {
      const lesson = LEARN_LESSONS.find((L) => L.id === state.lessonId);
      $("type-badge").textContent = (lesson && lesson.typeLabel) || TYPE_LABELS[q.type] || "";
    } else {
      $("type-badge").textContent = TYPE_LABELS[q.type] || "";
    }

    const qt = $("question-text");
    const useObjects = q.displayMode === "objects" || q.displayMode === "mixed";
    if (useObjects && q.type !== "compose") {
      // Full objects: hide arabic equation; mixed: keep numerals for clarity
      if (q.displayMode === "objects") {
        qt.textContent = buildObjectsPromptHint(q);
        qt.classList.add("prompt-objects");
      } else {
        qt.textContent = q.prompt;
        qt.classList.remove("prompt-objects");
      }
    } else {
      qt.textContent = q.prompt;
      qt.classList.remove("prompt-objects");
    }

    if (q.type === "compose" && q.mode === "drag") {
      const el = $("block-viz");
      el.innerHTML = "";
      el.classList.remove("has-objects");
      el.style.removeProperty("--obj-chip");
      const card = el.closest(".question-card");
      if (card) card.classList.remove("card-objects");
      const big = document.createElement("div");
      big.className = "compose-big-target";
      big.textContent = String(q.target);
      el.appendChild(big);
    } else if (q.viz && q.viz.length) {
      renderViz(q.viz, null, q);
    } else {
      const el = $("block-viz");
      el.innerHTML = "";
      el.classList.remove("has-objects");
      el.style.removeProperty("--obj-chip");
      const card = el.closest(".question-card");
      if (card) card.classList.remove("card-objects");
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
      // MC answers stay as arabic numerals for clarity
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
    slotsRow.setAttribute("aria-label", "數式：三個數字加埋等於 " + q.target);
    const slots = [];
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        const op = document.createElement("span");
        op.className = "compose-op";
        op.setAttribute("aria-hidden", "true");
        op.textContent = "＋";
        slotsRow.appendChild(op);
      }
      const slot = document.createElement("div");
      slot.className = "compose-slot";
      slot.dataset.slot = String(i);
      slot.setAttribute("aria-label", "空位 " + (i + 1));
      slotsRow.appendChild(slot);
      slots.push(slot);
    }
    const eq = document.createElement("span");
    eq.className = "compose-op compose-eq";
    eq.setAttribute("aria-hidden", "true");
    eq.textContent = "＝";
    slotsRow.appendChild(eq);
    const targetNum = document.createElement("span");
    targetNum.className = "compose-eq-target";
    targetNum.textContent = String(q.target);
    targetNum.setAttribute("aria-label", "目標 " + q.target);
    slotsRow.appendChild(targetNum);
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
          .join('<span class="feedback-op">＋</span>') +
        '<span class="feedback-op">＝</span>' +
        '<span class="feedback-eq-target">' +
        q.target +
        "</span>" +
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
    const ratio = total ? c / total : 0;
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

    const againBtn = $("btn-again");
    const homeBtn = $("btn-home");

    if (state.mode === "learn" && state.lessonId) {
      const lesson = LEARN_LESSONS.find((L) => L.id === state.lessonId);
      const prog = markLessonComplete(state.lessonId, state.stars);
      const unlockedNext = state.lessonId < 6 && prog.unlocked >= state.lessonId + 1;
      if (ratio >= 0.5) {
        title = "完成！";
        msg = unlockedNext
          ? `「${lesson ? lesson.title : ""}」學完喇，下一課已解鎖！`
          : state.lessonId === 6
            ? "六課全部完成，你太叻啦！"
            : `「${lesson ? lesson.title : ""}」完成！`;
      } else {
        title = "完成練習！";
        msg = unlockedNext
          ? "已經解鎖下一課，想再練可以返地圖揀。"
          : "返地圖可以再練一次呢一課。";
      }
      againBtn.textContent = "再練一次";
      homeBtn.textContent = "完成";
    } else {
      againBtn.textContent = "再玩一次";
      homeBtn.textContent = "換難度";
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


  // —— Learn map & teach ——
  function renderLessonMap() {
    const prog = loadLearnProgress();
    const map = $("lesson-map");
    map.innerHTML = "";
    LEARN_LESSONS.forEach((lesson) => {
      const unlocked = lesson.id <= prog.unlocked;
      const done = prog.completed.includes(lesson.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lesson-card " + (unlocked ? (done ? "done" : "open") : "locked");
      btn.disabled = !unlocked;
      btn.setAttribute("role", "listitem");
      const best = Number(prog.bestStars[String(lesson.id)]) || 0;
      btn.innerHTML =
        '<span class="lesson-num">' + lesson.id + "</span>" +
        '<span class="lesson-info"><strong>' + lesson.emoji + " " + lesson.title + "</strong>" +
        "<small>" + lesson.blurb + "</small>" +
        (done
          ? '<div class="lesson-stars-mini">' +
            "★".repeat(Math.max(1, Math.round((best / LESSONS_PER_PRACTICE) * 5))) +
            "</div>"
          : "") +
        "</span>" +
        '<span class="lesson-status" aria-hidden="true">' +
        (unlocked ? (done ? "✅" : "▶️") : "🔒") +
        "</span>";
      if (unlocked) {
        btn.addEventListener("click", () => {
          unlockAudio();
          SFX.blip();
          openTeach(lesson.id);
        });
      }
      map.appendChild(btn);
    });
  }

  function showLearnMap() {
    renderLessonMap();
    showScreen("learnMap");
  }

  function openTeach(lessonId) {
    state.mode = "learn";
    state.lessonId = lessonId;
    state.teachStep = 0;
    renderTeachStep();
    showScreen("teach");
  }

  function teachAppendOp(el, text) {
    const op = document.createElement("span");
    op.className = "op";
    op.textContent = text;
    el.appendChild(op);
  }

  function renderTeachViz(kind) {
    const el = $("teach-viz");
    el.innerHTML = "";
    el.style.setProperty("--obj-chip", "34px");

    function addObjs(n, kindObj) {
      el.appendChild(renderObjectGroup(n, kindObj || "cubes"));
    }

    if (kind === "numberSense1") {
      el.appendChild(renderBlockTower(3, "lg"));
      teachAppendOp(el, "＝");
      addObjs(3, "dots");
    } else if (kind === "numberSense2") {
      addObjs(5, "fruit");
    } else if (kind === "numberSense3") {
      el.appendChild(renderBlockTower(4, "lg"));
      el.appendChild(renderBlockTower(7, ""));
    } else if (kind === "add10_1") {
      addObjs(2, "cubes");
      teachAppendOp(el, "＋");
      addObjs(3, "cubes");
      teachAppendOp(el, "＝");
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.textContent = "5";
      el.appendChild(big);
    } else if (kind === "add10_2") {
      el.appendChild(renderBlockTower(4, "lg"));
      teachAppendOp(el, "＋");
      el.appendChild(renderBlockTower(3, "lg"));
      teachAppendOp(el, "＝");
      el.appendChild(renderBlockTower(7, ""));
    } else if (kind === "add10_3") {
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.textContent = "1…10";
      el.appendChild(big);
    } else if (kind === "doubles1") {
      el.appendChild(renderBlockTower(6, ""));
      teachAppendOp(el, "＋");
      el.appendChild(renderBlockTower(6, ""));
    } else if (kind === "doubles2") {
      addObjs(5, "stars");
      teachAppendOp(el, "＋");
      addObjs(5, "stars");
      teachAppendOp(el, "＝");
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.textContent = "10";
      el.appendChild(big);
    } else if (kind === "doubles3") {
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.textContent = "7＋7";
      el.appendChild(big);
    } else if (kind === "cross1") {
      el.appendChild(renderBlockTower(8, "sm"));
      teachAppendOp(el, "＋");
      el.appendChild(renderBlockTower(5, "sm"));
      teachAppendOp(el, "＝");
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.textContent = "？";
      el.appendChild(big);
    } else if (kind === "cross2") {
      const wrap = document.createElement("div");
      wrap.className = "teach-bridge";
      const row1 = document.createElement("div");
      row1.className = "teach-bridge-row";
      row1.innerHTML =
        '<span class="teach-pill">8 ＋ 2 → 10</span>' +
        '<span class="teach-arrow">再</span>' +
        '<span class="teach-pill">＋ 3</span>';
      const row2 = document.createElement("div");
      row2.className = "teach-bridge-row";
      row2.innerHTML = '<span class="teach-pill">10 ＋ 3 ＝ <strong>13</strong></span>';
      wrap.appendChild(row1);
      wrap.appendChild(row2);
      el.appendChild(wrap);
    } else if (kind === "cross3") {
      el.appendChild(renderBlockTower(7, "sm"));
      teachAppendOp(el, "＋");
      el.appendChild(renderBlockTower(6, "sm"));
    } else if (kind === "miss1") {
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.style.fontSize = "2.2rem";
      big.textContent = "□ ＋ 5 ＝ 12";
      el.appendChild(big);
    } else if (kind === "miss2") {
      el.appendChild(renderBlockTower(2, "lg"));
      teachAppendOp(el, "＋");
      el.appendChild(renderBlockTower(3, "lg"));
      teachAppendOp(el, "＋");
      el.appendChild(renderBlockTower(4, "lg"));
    } else if (kind === "miss3") {
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.style.fontSize = "1.6rem";
      big.textContent = "缺數 · 連加";
      el.appendChild(big);
    } else if (kind === "compose1") {
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.textContent = "12";
      el.appendChild(big);
    } else if (kind === "compose2") {
      const big = document.createElement("span");
      big.className = "teach-big-num";
      big.style.fontSize = "1.5rem";
      big.textContent = "□ ＋ □ ＋ □ ＝ N";
      el.appendChild(big);
    } else if (kind === "compose3") {
      const wrap = document.createElement("div");
      wrap.className = "teach-bridge";
      wrap.innerHTML =
        '<span class="teach-pill">3＋4＋5</span>' +
        '<span class="teach-arrow">或</span>' +
        '<span class="teach-pill">2＋5＋5</span>';
      el.appendChild(wrap);
    }
  }

  function renderTeachStep() {
    const lesson = LEARN_LESSONS.find((L) => L.id === state.lessonId);
    if (!lesson) return;
    const step = lesson.teach[state.teachStep];
    const total = lesson.teach.length;
    $("teach-lesson-title").textContent = lesson.emoji + " " + lesson.title;
    $("teach-step-label").textContent = "第 " + (state.teachStep + 1) + " / " + total + " 步";
    $("teach-headline").textContent = step.headline;
    $("teach-body").textContent = step.body;
    renderTeachViz(step.viz);

    const dots = $("teach-dots");
    dots.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const d = document.createElement("span");
      d.className = "teach-dot" + (i === state.teachStep ? " on" : "");
      dots.appendChild(d);
    }

    const nextBtn = $("btn-teach-next");
    if (state.teachStep >= total - 1) {
      nextBtn.textContent = "開始練習";
    } else {
      nextBtn.textContent = "下一步";
    }
  }

  function advanceTeach() {
    unlockAudio();
    SFX.tap();
    const lesson = LEARN_LESSONS.find((L) => L.id === state.lessonId);
    if (!lesson) return;
    if (state.teachStep >= lesson.teach.length - 1) {
      startLessonPractice(state.lessonId);
    } else {
      state.teachStep += 1;
      renderTeachStep();
    }
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

  $("btn-learn-zone").addEventListener("click", () => {
    unlockAudio();
    SFX.blip();
    showLearnMap();
  });
  $("btn-map-back").addEventListener("click", () => {
    unlockAudio();
    SFX.tap();
    showScreen("home");
  });
  $("btn-teach-back").addEventListener("click", () => {
    unlockAudio();
    SFX.tap();
    showLearnMap();
  });
  $("btn-teach-next").addEventListener("click", () => advanceTeach());

  $("btn-quit").addEventListener("click", () => {
    unlockAudio();
    SFX.tap();
    if (state.mode === "learn") showLearnMap();
    else showScreen("home");
  });
  $("btn-again").addEventListener("click", () => {
    unlockAudio();
    SFX.tap();
    if (state.mode === "learn" && state.lessonId) {
      openTeach(state.lessonId);
    } else if (state.diff && state.diff !== "learn") {
      startGame(state.diff);
    }
  });
  $("btn-home").addEventListener("click", () => {
    unlockAudio();
    SFX.tap();
    if (state.mode === "learn") {
      showLearnMap();
    } else {
      showScreen("home");
    }
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

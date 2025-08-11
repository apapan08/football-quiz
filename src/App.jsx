import React, { useEffect, useMemo, useState } from "react";
import { questions as DATA_QUESTIONS } from "./data/questions";

/**
 * Football Quiz — single-file React + Tailwind (brand-font edition)
 *
 * This version:
 * - Loads 9 questions (with media) from src/data/questions.js
 * - Renders image / audio / video per question
 * - Uses q.points (not q.basePoints) and q.prompt (not q.text)
 * - Keeps X2 help & final wager
 * - Timer removed completely
 */

// ——— Brand font wiring ———
const FONT_LINK_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans:wght@400;700&display=swap&subset=greek";

const FONT_FAMILIES = {
  display:
    '"Noto Sans", Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  ui: '"Noto Sans",Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
};

// ——— Theme ———
const THEME = {
  gradientFrom: "#223B57",
  gradientTo: "#2F4E73",
  accent: "#F11467",
  card: "rgba(17, 24, 39, 0.55)",
  border: "rgba(255,255,255,0.08)",
};

// ——— Game constants ———
const STORAGE_KEY = "quiz_prototype_state_v2";
const STAGES = {
  CATEGORY: "category",
  QUESTION: "question",
  ANSWER: "answer",
  FINALE: "finale",
  RESULTS: "results",
};

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState];
}

export default function QuizPrototype() {
  // ——— Inject brand fonts + base CSS once ———
  useEffect(() => {
    let linkEl;
    let styleEl;
    if (FONT_LINK_HREF) {
      linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = FONT_LINK_HREF;
      document.head.appendChild(linkEl);
    }
    styleEl = document.createElement("style");
    styleEl.innerHTML = `
      :root { 
        --brand-grad-from: ${THEME.gradientFrom}; 
        --brand-grad-to: ${THEME.gradientTo}; 
        --brand-accent: ${THEME.accent}; 
        --brand-card: ${THEME.card}; 
        --brand-border: ${THEME.border};
        --howto-bg: rgba(15,23,42,0.95);
      }
      .font-display { font-family: ${FONT_FAMILIES.display}; }
      .font-ui { font-family: ${FONT_FAMILIES.ui}; }
      .font-mono { font-family: ${FONT_FAMILIES.mono}; }
      .btn { @apply rounded-2xl px-5 py-2 font-semibold shadow; }
      .btn-accent { background: var(--brand-accent); color: white; }
      .btn-accent:hover { filter: brightness(1.06); }
      .btn-neutral { background: rgba(148,163,184,0.15); color: white; }
      .btn-neutral:hover { background: rgba(148,163,184,0.25); }
      .card { background: var(--brand-card); border:1px solid var(--brand-border); border-radius: 1.5rem; padding:1.5rem; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
      .pill { border-radius: 999px; padding: .25rem .6rem; font-weight: 700; }

      /* HowTo modal helpers */
      .scroll-area { overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
      .scroll-area::-webkit-scrollbar { width:10px; }
      .scroll-area::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.18); border-radius:999px; }
      .howto-shadow { position: sticky; bottom: 0; height: 24px; background: linear-gradient(to top, var(--howto-bg), transparent); pointer-events: none; }
    `;
    document.head.appendChild(styleEl);
    return () => {
      if (linkEl) document.head.removeChild(linkEl);
      if (styleEl) document.head.removeChild(styleEl);
    };
  }, []);

  // ——— Load & order questions (from src/data/questions.js) ———
  const QUESTIONS = useMemo(
    () => [...DATA_QUESTIONS].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    []
  );

  // ——— Core game state ———
  const [index, setIndex] = usePersistentState(`${STORAGE_KEY}:index`, 0);
  const [stage, setStage] = usePersistentState(
    `${STORAGE_KEY}:stage`,
    STAGES.CATEGORY
  );

  const lastIndex = QUESTIONS.length - 1;
  const isFinalIndex = index === lastIndex;
  const q = QUESTIONS[index] ?? QUESTIONS[0];

  // Safety: if persisted index is out-of-range (e.g., you changed question count)
  useEffect(() => {
    if (index > lastIndex) setIndex(lastIndex < 0 ? 0 : lastIndex);
  }, [index, lastIndex, setIndex]);

  // ——— X2 help state (one use per player per game; arm only on Category) ———
  const [x2, setX2] = usePersistentState(`${STORAGE_KEY}:x2`, {
    p1: { available: true, armedIndex: null },
    p2: { available: true, armedIndex: null },
  });

  // Players
  const [p1, setP1] = usePersistentState(`${STORAGE_KEY}:p1`, {
    name: "Player 1",
    score: 0,
    streak: 0,
    maxStreak: 0,
  });
  const [p2, setP2] = usePersistentState(`${STORAGE_KEY}:p2`, {
    name: "Player 2",
    score: 0,
    streak: 0,
    maxStreak: 0,
  });
  const [lastCorrect, setLastCorrect] = usePersistentState(
    `${STORAGE_KEY}:lastCorrect`,
    null
  );

  // Finale wagers
  const [wager, setWager] = usePersistentState(`${STORAGE_KEY}:wager`, {
    p1: 0,
    p2: 0,
  });
  const [finalResolved, setFinalResolved] = usePersistentState(
    `${STORAGE_KEY}:finalResolved`,
    { p1: false, p2: false }
  );
  const [finalFirst, setFinalFirst] = usePersistentState(
    `${STORAGE_KEY}:finalFirst`,
    null
  );

  // How-to modal
  const [showHowTo, setShowHowTo] = useState(false);
  const [howToLang, setHowToLang] = useState("en");

  // On entering Category: reset finale flags
  useEffect(() => {
    if (stage !== STAGES.CATEGORY) return;
    setFinalResolved({ p1: false, p2: false });
    setFinalFirst(null);
    setWager({ p1: 0, p2: 0 });
  }, [stage, index]);

  // X2 helpers
  function canArmX2(side) {
    const player = x2[side];
    return player.available && !isFinalIndex && stage === STAGES.CATEGORY;
  }
  function armX2(side) {
    if (!canArmX2(side)) return;
    setX2((s) => ({
      ...s,
      [side]: { available: false, armedIndex: index }, // consume upon activation; applies to THIS question
    }));
  }
  function isX2ActiveFor(side) {
    const player = x2[side];
    return player.armedIndex === index; // active for this question only
  }

  function awardTo(side, base = 1, { useMultiplier = true } = {}) {
    // Multiplier = points × (x2 active? 2 : 1). Streak +1 applied after, not multiplied.
    const baseMult =
      (q.points || 1) *
      (useMultiplier ? (isX2ActiveFor(side) ? 2 : 1) : 1);
    const baseDelta = base * baseMult;

    if (side === "p1") {
      setP1((s) => {
        const newStreak = lastCorrect === "p1" ? s.streak + 1 : 1;
        const streakBonus = newStreak >= 3 ? 1 : 0; // not multiplied
        return {
          ...s,
          score: s.score + baseDelta + streakBonus,
          streak: newStreak,
          maxStreak: Math.max(s.maxStreak, newStreak),
        };
      });
      setP2((s) => ({ ...s, streak: lastCorrect === "p1" ? 0 : s.streak }));
      setLastCorrect("p1");
    } else {
      setP2((s) => {
        const newStreak = lastCorrect === "p2" ? s.streak + 1 : 1;
        const streakBonus = newStreak >= 3 ? 1 : 0;
        return {
          ...s,
          score: s.score + baseDelta + streakBonus,
          streak: newStreak,
          maxStreak: Math.max(s.maxStreak, newStreak),
        };
      });
      setP1((s) => ({ ...s, streak: lastCorrect === "p2" ? 0 : s.streak }));
      setLastCorrect("p2");
    }
  }

  function noAnswer() {
  // Break any ongoing streaks and clear last winner
  setLastCorrect(null);
  setP1((s) => ({ ...s, streak: 0 }));
  setP2((s) => ({ ...s, streak: 0 }));
}

  function finalizeOutcome(side, outcome) {
    const bet = side === "p1" ? wager.p1 : wager.p2;
    if (finalResolved[side] || bet <= 0) return;
    if (outcome === "correct") {
      if (!finalFirst) setFinalFirst(side);
      // No multipliers allowed in Final; just +/- bet
      (side === "p1" ? setP1 : setP2)((s) => ({ ...s, score: s.score + bet }));
    } else {
      (side === "p1" ? setP1 : setP2)((s) => ({ ...s, score: s.score - bet }));
    }
    setFinalResolved((fr) => ({ ...fr, [side]: true }));
  }

  function next() {
    if (stage === STAGES.CATEGORY) setStage(STAGES.QUESTION);
    else if (stage === STAGES.FINALE) setStage(STAGES.QUESTION);
    else if (stage === STAGES.QUESTION) setStage(STAGES.ANSWER);
    else if (stage === STAGES.ANSWER) {
      if (index < lastIndex) {
        setIndex((i) => i + 1);
        setStage(STAGES.CATEGORY);
      } else setStage(STAGES.RESULTS);
    }
  }
  function previous() {
    if (stage === STAGES.QUESTION) setStage(STAGES.CATEGORY);
    else if (stage === STAGES.ANSWER) setStage(STAGES.QUESTION);
    else if (stage === STAGES.FINALE) setStage(STAGES.CATEGORY);
    else if (stage === STAGES.RESULTS) setStage(STAGES.ANSWER);
    else if (stage === STAGES.CATEGORY && index > 0) {
      setIndex((i) => i - 1);
      setStage(STAGES.ANSWER);
    }
  }

  function resetGame() {
    setIndex(0);
    setStage(STAGES.CATEGORY);
    setP1({ name: p1.name, score: 0, streak: 0, maxStreak: 0 });
    setP2({ name: p2.name, score: 0, streak: 0, maxStreak: 0 });
    setWager({ p1: 0, p2: 0 });
    setFinalResolved({ p1: false, p2: false });
    setLastCorrect(null);
    setX2({
      p1: { available: true, armedIndex: null },
      p2: { available: true, armedIndex: null },
    });
  }

  async function exportShareCard() {
    const w = 1080,
      h = 1350;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, THEME.gradientFrom);
    g.addColorStop(1, THEME.gradientTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `800 64px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText("Football Quiz — Results", w / 2, 140);
    ctx.font = `700 52px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(`${p1.name}: ${p1.score}`, w / 2, 300);
    ctx.fillText(`${p2.name}: ${p2.score}`, w / 2, 370);
    const winner =
      p1.score === p2.score
        ? "Draw!"
        : p1.score > p2.score
        ? `${p1.name} Wins 🏆`
        : `${p2.name} Wins 🏆`;
    ctx.font = `800 76px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(winner, w / 2, 520);
    ctx.font = `600 42px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(
      `Longest streak — ${p1.name}: ${p1.maxStreak}`,
      w / 2,
      680
    );
    ctx.fillText(
      `Longest streak — ${p2.name}: ${p2.maxStreak}`,
      w / 2,
      740
    );
    ctx.font = `500 30px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("onlyfootballfans • play with a friend", w / 2, h - 80);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "quiz-results.png";
    a.click();
  }

  // ——— UI subcomponents ———
 function Header() {
  return (
    <div className="px-4 pt-6 pb-2 font-ui">
      <div className="flex items-center justify-center gap-3">
        {/* replace this: <span className="text-3xl">🧠⚽</span> */}
        <img src="/logo.png" alt="Brand logo" className="h-7 w-auto drop-shadow" />
        <span
          className="rounded-full px-3 py-1 text-sm font-semibold shadow"
          style={{ background: THEME.accent }}
        >
          Q {index + 1} of {QUESTIONS.length}
        </span>
      </div>
      <div className="mt-2 text-center text-xs uppercase tracking-wide text-slate-300">
        {stageLabel(stage)}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <button onClick={() => { setHowToLang('en'); setShowHowTo(true); }} className="pill bg-white text-black">🇬🇧 Instructions</button>
        <button onClick={() => { setHowToLang('el'); setShowHowTo(true); }} className="pill bg-white text-black">🇬🇷 Οδηγίες</button>
      </div>
    </div>
  );
}


  function StageCard({ children }) {
    return <div className="card">{children}</div>;
  }

  function CategoryStage() {
    return (
      <StageCard>
        <div className="flex items-center justify-between">
          <div className="text-rose-400 text-4xl">🏆</div>
          <div className="flex items-center gap-2">
            <div className="pill text-white bg-slate-700/70">
              Category ×{q.points || 1}
            </div>
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-wide font-display">
          {q.category}
        </h2>
        <p className="mt-2 text-center font-ui" style={{ color: THEME.accent }}>
          x{q.points || 1} Points
        </p>

        {/* X2 controls (Category only). Disabled on Final */}
        <div className="mt-5 rounded-2xl bg-slate-900/50 p-4">
          <div className="mb-2 text-center text-sm text-slate-300 font-ui">
            Βοήθεια Χ2
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <X2Control
              label={p1.name}
              side="p1"
              armed={isX2ActiveFor("p1")}
              available={x2.p1.available}
              disabled={!canArmX2("p1")}
              grad="linear-gradient(90deg,#BA1ED3,#F11467)"
              onArm={() => armX2("p1")}
              isFinal={isFinalIndex}
            />
            <X2Control
              label={p2.name}
              side="p2"
              armed={isX2ActiveFor("p2")}
              available={x2.p2.available}
              disabled={!canArmX2("p2")}
              grad="linear-gradient(90deg,#00A7D7,#2563EB)"
              onArm={() => armX2("p2")}
              isFinal={isFinalIndex}
            />
          </div>
          {isFinalIndex && (
            <div className="mt-2 text-center text-xs text-slate-400">
              Η Χ2 βοήθεια δεν επιτρέπεται στον Τελικό.
            </div>
          )}
        </div>

        {/* Final betting UI on last question */}
        {isFinalIndex && (
          <div className="mt-5 rounded-2xl bg-slate-900/50 p-4">
            <div className="mb-2 text-center text-sm text-slate-300 font-ui">
              Τελικός — Τοποθετήστε το ποντάρισμά σας (0–3)
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <WagerControl
                label={p1.name}
                value={wager.p1}
                onChange={(n) =>
                  setWager((w) => ({ ...w, p1: clamp(n, 0, 3) }))
                }
                grad="linear-gradient(90deg,#BA1ED3,#F11467)"
              />
              <WagerControl
                label={p2.name}
                value={wager.p2}
                onChange={(n) =>
                  setWager((w) => ({ ...w, p2: clamp(n, 0, 3) }))
                }
                grad="linear-gradient(90deg,#00A7D7,#2563EB)"
              />
            </div>
            <div className="mt-2 text-center text-xs text-slate-400">
              Σωστό = +ποντάρισμα • Λάθος = −ποντάρισμα • Προτείνεται
              ταυτόχρονη απάντηση.
            </div>
          </div>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <NavButtons />
        </div>
      </StageCard>
    );
  }

  function QuestionStage() {
    return (
      <StageCard>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-slate-700/70 px-3 py-1 text-xs font-semibold">
            Category ×{q.points || 1}
          </div>
          {/* Show per-player X2 status */}
          {isX2ActiveFor("p1") && (
            <div
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: "linear-gradient(90deg,#BA1ED3,#F11467)" }}
            >
              {p1.name}: ×2
            </div>
          )}
          {isX2ActiveFor("p2") && (
            <div
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: "linear-gradient(90deg,#00A7D7,#2563EB)" }}
            >
              {p2.name}: ×2
            </div>
          )}
        </div>

        <h3 className="mt-4 font-display text-2xl font-bold leading-snug">
          {q.prompt}
        </h3>

        {/* Media (image/audio/video) */}
        <div className="mt-4">
          <Media media={q.media} />
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setStage(STAGES.ANSWER)}
            className="btn btn-accent"
          >
            Reveal Answer
          </button>
        </div>
      </StageCard>
    );
  }

function AnswerStage() {
  // Clears streaks if nobody got it right
  function handleNoAnswer() {
    setLastCorrect(null);
    setP1((s) => ({ ...s, streak: 0 }));
    setP2((s) => ({ ...s, streak: 0 }));
  }

  return (
    <StageCard>
      <div className="text-center">
        <div className="font-display text-3xl font-extrabold">
          {q.answer}
        </div>
        {q.fact && (
          <div className="mt-2 font-ui text-sm text-slate-300">
            ℹ️ {q.fact}
          </div>
        )}
      </div>

      {/* Per-player X2 status reminder */}
      <div className="mt-3 text-center text-xs text-slate-400 font-ui">
        {isX2ActiveFor("p1") && <span className="mr-2">({p1.name}: ×2 ενεργό)</span>}
        {isX2ActiveFor("p2") && <span>({p2.name}: ×2 ενεργό)</span>}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 font-ui">
        <div>
          <div className="mb-2 text-sm text-slate-300">{p1.name}</div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className="btn text-white"
                style={{ background: "linear-gradient(90deg,#BA1ED3,#F11467)" }}
                onClick={() => awardTo("p1", n)}
              >
                +{n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm text-slate-300">{p2.name}</div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className="btn text-white"
                style={{ background: "linear-gradient(90deg,#00A7D7,#2563EB)" }}
                onClick={() => awardTo("p2", n)}
              >
                +{n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* No-answer control to break streaks */}
      <div className="mt-4 flex flex-col items-center gap-1">
        <button
          onClick={handleNoAnswer}
          className="btn btn-neutral px-3 py-1 text-xs"
          title="Reset streaks if nobody answered correctly"
        >
          No answer
        </button>
        <div className="text-xs text-slate-400">
          Press if nobody answered correctly — resets both streaks.
        </div>
      </div>

      {/* Final scoring controls on last question */}
      {isFinalIndex && (
        <div className="card font-ui mt-6">
          <div className="mb-2 text-sm text-slate-300">
            Τελικός — Απονέμετε πόντους βάσει πονταρίσματος
          </div>
          <div className="text-xs text-slate-400 mb-3">
            Τα Χ2 δεν ισχύουν στον Τελικό. Προτείνεται ταυτόχρονη απάντηση.
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm text-slate-300">{p1.name}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={finalResolved.p1 || wager.p1 === 0 || (finalFirst && finalFirst !== "p1")}
                  onClick={() => finalizeOutcome("p1", "correct")}
                  className="btn text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg,#BA1ED3,#F11467)" }}
                >
                  Correct +{wager.p1}
                </button>
                <button
                  disabled={finalResolved.p1 || wager.p1 === 0}
                  onClick={() => finalizeOutcome("p1", "wrong")}
                  className="btn btn-neutral disabled:opacity-50"
                >
                  Wrong −{wager.p1}
                </button>
                {finalResolved.p1 && <span className="text-xs text-emerald-300">Resolved ✔</span>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-slate-300">{p2.name}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={finalResolved.p2 || wager.p2 === 0 || (finalFirst && finalFirst !== "p2")}
                  onClick={() => finalizeOutcome("p2", "correct")}
                  className="btn text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg,#00A7D7,#2563EB)" }}
                >
                  Correct +{wager.p2}
                </button>
                <button
                  disabled={finalResolved.p2 || wager.p2 === 0}
                  onClick={() => finalizeOutcome("p2", "wrong")}
                  className="btn btn-neutral disabled:opacity-50"
                >
                  Wrong −{wager.p2}
                </button>
                {finalResolved.p2 && <span className="text-xs text-emerald-300">Resolved ✔</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <NavButtons />
      </div>
    </StageCard>
  );
}


  function ResultsStage() {
    const winner =
      p1.score === p2.score
        ? "Draw!"
        : p1.score > p2.score
        ? `${p1.name} wins 🏆`
        : `${p2.name} wins 🏆`;
    return (
      <StageCard>
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold">{winner}</div>
          <div className="mt-2 font-ui text-slate-300">
            {p1.name} {p1.score} — {p2.score} {p2.name}
          </div>
          <div className="mt-2 font-ui text-sm text-slate-400">
            Longest streaks: {p1.name} {p1.maxStreak} • {p2.name}{" "}
            {p2.maxStreak}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3 font-ui">
          <button onClick={resetGame} className="btn btn-accent">
            Play Again
          </button>
        </div>
      </StageCard>
    );
  }

  function X2Control({
    label,
    side,
    available,
    armed,
    disabled,
    onArm,
    grad,
    isFinal,
  }) {
    return (
      <div className="card font-ui">
        <div className="mb-2 text-sm text-slate-300">{label}</div>
        {/* Mobile-safe layout to avoid overflow */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full min-w-0">
          <div
            className="pill text-white shrink-0"
            style={{ background: grad }}
          >
            {available ? "Χ2 διαθέσιμο" : armed ? "Χ2 ενεργό" : "Χ2 χρησιμοποιήθηκε"}
          </div>
          <button
            className="btn btn-neutral disabled:opacity-50 w-full sm:w-auto whitespace-normal break-words text-center leading-snug text-sm"
            onClick={onArm}
            disabled={disabled}
            title={
              isFinal
                ? "Δεν επιτρέπεται στον Τελικό"
                : available
                ? "Ενεργοποίηση Χ2 για αυτόν τον γύρο"
                : "Δεν απομένει Χ2"
            }
          >
            Χρησιμοποίησε Χ2
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Μπορεί να χρησιμοποιηθεί μόνο μία φορά.
        </div>
      </div>
    );
  }

  function WagerControl({ label, value, onChange, grad }) {
    return (
      <div className="card font-ui">
        <div className="mb-2 text-sm text-slate-300">{label}</div>
        <div className="flex items-center gap-2">
          <button className="btn btn-neutral" onClick={() => onChange(value - 1)}>
            −
          </button>
          <div className="pill text-white" style={{ background: grad }}>
            {value}
          </div>
          <button className="btn btn-neutral" onClick={() => onChange(value + 1)}>
            +
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-400">Ποντάρισμα 0–3 πόντοι</div>
      </div>
    );
  }

  function NavButtons() {
    return (
      <div className="flex items-center justify-center gap-3">
        <button onClick={previous} className="btn btn-neutral">
          ← Previous
        </button>
        <button onClick={next} className="btn btn-accent">
          Next →
        </button>
      </div>
    );
  }

  function Media({ media }) {
    if (!media || !media.kind) return null;

    if (media.kind === "image") {
      return (
        <img
          src={media.src}
          alt={media.alt || ""}
          loading="lazy"
          className="max-h-96 w-auto mx-auto rounded-xl"
        />
      );
    }

    if (media.kind === "audio") {
      return (
        <audio key={media.src} controls preload="metadata" playsInline className="w-full mt-2">
          <source src={media.src} type="audio/mpeg" />
          Your browser can’t play this audio.
        </audio>
      );
    }

    if (media.kind === "video") {
      return (
        <video
          key={media.src}
          controls
          preload="metadata"
          playsInline
          poster={media.poster}
          className="w-full max-h-[70vh] rounded-xl"
        >
          <source src={media.src} type={media.type || "video/mp4"} />
          Your browser can’t play this video.
        </video>
      );
    }

    return null;
  }

  // ——— Lightweight self-tests (run with #selftest hash) ———
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#selftest") return;
    try {
      const applyFinal = (score, bet, outcome) =>
        outcome === "correct" ? score + bet : score - bet;
      console.assert(
        applyFinal(10, 3, "correct") === 13,
        "Final: +bet on correct"
      );
      console.assert(applyFinal(10, 2, "wrong") === 8, "Final: -bet on wrong");
      const streakBonus = (prev, same) =>
        (same ? prev + 1 : 1) >= 3 ? 1 : 0;
      console.assert(
        streakBonus(2, true) === 1 && streakBonus(1, true) === 0,
        "Streak bonus from 3rd correct"
      );
      console.log("%cSelf-tests passed", "color: #10b981");
    } catch (e) {
      console.warn("Self-tests failed", e);
    }
  }, []);

  return (
    <div
      className="min-h-screen w-full flex justify-center items-start p-4"
      style={{
        background: `linear-gradient(180deg, ${THEME.gradientFrom}, ${THEME.gradientTo})`,
      }}
    >
      <div className="w-full max-w-4xl space-y-4 text-slate-100">
        <Header />
        {showHowTo && (
          <HowToModal
            initialLang={howToLang}
            onClose={() => setShowHowTo(false)}
          />
        )}
        {stage === STAGES.CATEGORY && <CategoryStage />}
        {stage === STAGES.QUESTION && <QuestionStage />}
        {stage === STAGES.ANSWER && <AnswerStage />}

        {stage !== STAGES.RESULTS && (
          <>
            <div className="mt-2 text-center text-lg font-semibold font-ui">
              Player Scores
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PlayerPanel side="p1" player={p1} setPlayer={setP1} />
              <PlayerPanel side="p2" player={p2} setPlayer={setP2} />
            </div>
          </>
        )}

        {stage === STAGES.RESULTS && <ResultsStage />}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-300 font-ui">
          <div>Stage: {stageLabel(stage)}</div>
          <div className="flex items-center gap-3">
            <button className="btn btn-neutral" onClick={resetGame}>
              Reset Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function stageLabel(stage) {
  switch (stage) {
    case STAGES.CATEGORY:
      return "Category Stage";
    case STAGES.QUESTION:
      return "Question Stage";
    case STAGES.ANSWER:
      return "Answer Stage";
    case STAGES.FINALE:
      return "Finale (Wager)";
    case STAGES.RESULTS:
      return "Results";
    default:
      return "";
  }
}

// Hoisted to avoid remounting and input focus loss on each keystroke
function PlayerPanel({ side, player, setPlayer }) {
  const badgeGrad =
    side === "p1"
      ? "linear-gradient(90deg,#BA1ED3,#F11467)"
      : "linear-gradient(90deg,#00A7D7,#2563EB)";
  return (
    <div className="card font-ui">
      <div className="mb-2 flex items-center justify-between">
        <input
          className="w-40 rounded-lg bg-slate-900/60 px-2 py-1 text-slate-100 outline-none"
          value={player.name}
          onChange={(e) => setPlayer((s) => ({ ...s, name: e.target.value }))}
          aria-label={`${side} name`}
        />
        <div className="pill text-white" style={{ background: badgeGrad }}>
          {player.score}
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-300">Streak:</span>
          <span
            className="pill text-amber-200"
            style={{ background: "rgba(245, 158, 11, 0.25)" }}
          >
            {player.streak > 0 ? `🔥 +${player.streak}` : "—"}
          </span>
          <span className="text-slate-500 text-xs">(max {player.maxStreak})</span>
        </div>
      </div>
    </div>
  );
}

function HowToModal({ onClose, initialLang = "en" }) {
  const [lang, setLang] = useState(initialLang);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    setLang(initialLang);
  }, [initialLang]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="min-h-full flex items-start sm:items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="relative w-full max-w-[680px] font-ui rounded-2xl shadow-xl ring-1 ring-white/10 bg-[var(--howto-bg)] text-slate-100 flex flex-col overflow-hidden max-h-[clamp(420px,85dvh,760px)]">
          <div className="sticky top-0 z-10 px-6 py-4 bg-[var(--howto-bg)] backdrop-blur-sm rounded-t-2xl flex items-center justify-between border-b border-white/10">
            <h2 className="font-display text-2xl font-extrabold">
              {lang === "en" ? "How to Play" : "Πώς παίζεται"}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLang("en")}
                className={`pill bg-white text-black ${lang === "en" ? "ring-2 ring-[var(--brand-accent)]" : ""}`}
              >
                🇬🇧 EN
              </button>
              <button
                onClick={() => setLang("el")}
                className={`pill bg-white text-black ${lang === "el" ? "ring-2 ring-[var(--brand-accent)]" : ""}`}
              >
                🇬🇷 ΕΛ
              </button>
              <button onClick={onClose} className="btn btn-neutral">Close ✕</button>
            </div>
          </div>
          {lang === "en" ? (
            <div className="scroll-area px-6 pb-6 pt-2 flex-1 min-h-0 space-y-4 text-slate-100 text-sm md:text-base leading-relaxed">
              <section>
                <h3 className="font-display text-lg font-bold">Quick Start</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>2 players on one device. Enter your names.</li>
                  <li>
                    Each round shows the <strong>Category (with its points)</strong>, then the <strong>Question</strong>, then the <strong>Answer</strong>. On the final question, each player wagers how many points they’ll play for.
                  </li>
                  <li>
                    <strong>Rule:</strong> Each player has <strong>one spoken guess</strong> per question.
                  </li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Flow & Scoring</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li><strong>Question:</strong> Make your single guess.</li>
                  <li>
                    <strong>Reveal:</strong> Press <em>“Reveal Answer”</em> and award points to the <strong>fastest correct</strong> player using <strong>+1/+2/+3</strong>. If the first person was wrong but the second was right, <strong>the points go to the second</strong>.
                  </li>
                  <li>
                    <strong>Streak:</strong> Starting from the <em>3rd consecutive correct</em> answer, add an extra <strong>+1</strong>. <em>(Streak is not multiplied.)</em>
                  </li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">X2 Help</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Each player has <strong>one (1) X2</strong> per game.</li>
                  <li>Activate it <strong>only on the Category screen</strong>, before the question/answer is shown.</li>
                  <li>When you award <strong>+1/+2/+3</strong>, the system <strong>automatically doubles the base points</strong> for the player with X2 active on that question. <em>(X2 does not affect the streak +1.)</em></li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Final</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Before the final question, each player <strong>wagers 0–3</strong> points.</li>
                  <li><strong>Answer:</strong> Prefer simultaneous answers (or write them down). <strong>Right = +wager</strong>, <strong>Wrong = −wager</strong>.</li>
                  <li><strong>X2 is not allowed</strong> in the Final.</li>
                </ul>
              </section>
              <div className="howto-shadow" />
            </div>
          ) : (
            <div className="scroll-area px-6 pb-6 pt-2 flex-1 min-h-0 space-y-4 text-slate-100 text-sm md:text-base leading-relaxed">
              <section>
                <h3 className="font-display text-lg font-bold">Γρήγορη εκκίνηση</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>2 παίκτες στην ίδια συσκευή. Βάλτε τα ονόματά σας.</li>
                  <li>
                    Σε κάθε γύρο εμφανίζεται πρώτα η κατηγορία με τους αντίστοιχους πόντους, μετά η ερώτηση και μετά η απάντηση. Στην τελευταία ερώτηση κάθε παίκτης ποντάρει πόσους πόντους θα παίξει.
                  </li>
                  <li><strong>Κανόνας:</strong> Κάθε παίκτης έχει <strong>μία προφορική προσπάθεια</strong> ανά ερώτηση.</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Ροή & Βαθμολογία</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li><strong>Ερώτηση:</strong> Δώστε τη μία προσπάθειά σας.</li>
                  <li>
                    <strong>Αποκάλυψη:</strong> Πατήστε «Reveal Answer» και δώστε πόντους <strong>στον πιο γρήγορο που απάντησε σωστά</strong> με <strong>+1/+2/+3</strong>. <strong>Αν ο πρώτος που απάντησε δεν ήταν σωστός αλλά ο δεύτερος ήταν, τότε τους πόντους τους παίρνει ο δεύτερος.</strong>
                  </li>
                  <li><strong>Streak:</strong> Από την <em>3η συνεχόμενη σωστή</em> απάντηση και μετά, προστίθεται <strong>+1</strong> επιπλέον.</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Βοήθεια Χ2</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Κάθε παίκτης διαθέτει <strong>μία (1) Χ2</strong> ανά παιχνίδι.</li>
                  <li>Η ενεργοποίηση γίνεται <strong>μόνο στην οθόνη Κατηγορίας</strong>, πριν εμφανιστεί η ερώτηση/αποκάλυψη.</li>
                  <li>Όταν απονείμετε <strong>+1/+2/+3</strong>, το σύστημα <strong>διπλασιάζει αυτόματα τους βασικούς πόντους</strong> για τον παίκτη που έχει ενεργό το Χ2 σε αυτή την ερώτηση. <em>(Το Χ2 δεν επηρεάζει το streak +1.)</em></li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Τελικός</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Πριν εμφανιστεί η τελική ερώτηση, κάθε παίκτης <strong>ποντάρει 0–3</strong> πόντους.</li>
                  <li><strong>Απάντηση:</strong> Προτείνεται ταυτόχρονη (ή γραπτή). <strong>Σωστό = +στοίχημα</strong>, <strong>Λάθος = −στοίχημα</strong>.</li>
                  <li><strong>Το Χ2 δεν επιτρέπεται</strong> στον Τελικό.</li>
                </ul>
              </section>
              <div className="howto-shadow" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

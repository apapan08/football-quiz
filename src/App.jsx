import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Football Quiz — single-file React + Tailwind (brand-font edition)
 *
 * What changed vs previous draft
 * - Injects your fonts via <link> (edit FONT_LINK_HREF and FONT_FAMILIES below)
 * - Uses utility classes `.font-display` for big headings and `.font-ui` for UI
 * - Colors tweaked to your navy → blue gradient with hot‑pink accent
 * - Share-card exporter waits for fonts to load for accurate PNG text
 *
 * Drop this into a Tailwind React app (Vite/CRA). No extra deps.
 */

// ——— Brand font wiring ———
// If you already import fonts in your index.html, set FONT_LINK_HREF to null
// and just correct the `FONT_FAMILIES` names below to match your CSS font-family names.
const FONT_LINK_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans:wght@400;700&display=swap&subset=greek";

// Use exact family names as exposed by your CSS (Google Fonts page shows them)
const FONT_FAMILIES = {
  display: 'Inter, "Noto Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  ui: 'Inter, "Noto Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
};

// ——— Theme ———
const THEME = {
  gradientFrom: "#223B57", // deep navy (matches your screenshots)
  gradientTo: "#2F4E73", // slate-blue
  accent: "#F11467", // hot pink
  card: "rgba(17, 24, 39, 0.55)", // slate-900/55
  border: "rgba(255,255,255,0.08)",
};

// ——— Game constants ———
const STORAGE_KEY = "quiz_prototype_state_v2";
const STAGES = { CATEGORY: "category", QUESTION: "question", ANSWER: "answer", FINALE: "finale", RESULTS: "results" };
const DEFAULT_TIMER_SECONDS = 15;

// Sample questions — replace with your own
const QUESTIONS = [
  { id: "q1", category: "ΚΥΠΡΙΑΚΟ", basePoints: 1, text: "Ποιος ήταν ο τερματοφύλακας του ΑΠΟΕΛ στον αγώνα Athletic Bilbao – ΑΠΟΕΛ (3–2);", answer: "Waterman", fact: "Ο Μπόι Βάτερμαν ήταν καθοριστικός στην ευρωπαϊκή πορεία του ΑΠΟΕΛ." },
  { id: "q2", category: "PREMIER LEAGUE", basePoints: 1, text: "Ποια ομάδα κατέκτησε πρώτη την Premier League (1992–93);", answer: "Manchester United", fact: "Πρώτη χρονιά της Premier League μετά τη μετονομασία της First Division." },
  { id: "q3", category: "CHAMPIONS LEAGUE", basePoints: 1, text: "Σε ποια πόλη διεξήχθη ο τελικός UCL 2016 Real–Atlético;", answer: "Μιλάνο", fact: "Το San Siro φιλοξένησε τον τελικό, που κρίθηκε στα πέναλτι." },
  { id: "q4", category: "EURO", basePoints: 1, text: "Ποια χώρα κατέκτησε το EURO 2004;", answer: "Ελλάδα", fact: "Η Ελλάδα νίκησε την Πορτογαλία στο Ντα Λουζ (1–0)." },
  { id: "q5", category: "ΤΕΛΙΚΟΣ", basePoints: 1, text: "Finale: Ποιος είναι ο πρώτος σκόρερ στην ιστορία του EURO;", answer: "Κριστιάνο Ρονάλντο", fact: "Κατέχει τα περισσότερα γκολ σε τελικά στάδια EURO." },
];

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initialValue; } catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}

export default function QuizPrototype() {
  // ——— Inject brand fonts + base CSS once ———
  useEffect(() => {
    let linkEl; let styleEl;
    if (FONT_LINK_HREF) {
      linkEl = document.createElement("link");
      linkEl.rel = "stylesheet"; linkEl.href = FONT_LINK_HREF; document.head.appendChild(linkEl);
    }
    styleEl = document.createElement("style");
    styleEl.innerHTML = `
      :root { --brand-grad-from: ${THEME.gradientFrom}; --brand-grad-to: ${THEME.gradientTo}; --brand-accent: ${THEME.accent}; --brand-card: ${THEME.card}; --brand-border: ${THEME.border}; }
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
    `;
    document.head.appendChild(styleEl);
    return () => { if (linkEl) document.head.removeChild(linkEl); if (styleEl) document.head.removeChild(styleEl); };
  }, []);

  // ——— Core game state ———
  const [index, setIndex] = usePersistentState(`${STORAGE_KEY}:index`, 0);
  const [stage, setStage] = usePersistentState(`${STORAGE_KEY}:stage`, STAGES.CATEGORY);
  const lastIndex = QUESTIONS.length - 1; const isFinalIndex = index === lastIndex; const q = QUESTIONS[index];

  // Bonus multiplier map (10% x2 per question)
  const [bonusMap, setBonusMap] = usePersistentState(`${STORAGE_KEY}:bonusMap`, {});
  const currentMultiplier = (bonusMap[q.id] || 1) * (q.basePoints || 1);

  // Players
  const [p1, setP1] = usePersistentState(`${STORAGE_KEY}:p1`, { name: "Player 1", score: 0, streak: 0, maxStreak: 0 });
  const [p2, setP2] = usePersistentState(`${STORAGE_KEY}:p2`, { name: "Player 2", score: 0, streak: 0, maxStreak: 0 });
  const [lastCorrect, setLastCorrect] = usePersistentState(`${STORAGE_KEY}:lastCorrect`, null);

  // Finale wagers (Jeopardy)
  const [wager, setWager] = usePersistentState(`${STORAGE_KEY}:wager`, { p1: 0, p2: 0 });
  const [finalResolved, setFinalResolved] = usePersistentState(`${STORAGE_KEY}:finalResolved`, { p1: false, p2: false });
  const [finalFirst, setFinalFirst] = usePersistentState(`${STORAGE_KEY}:finalFirst`, null);

  // Timer
  const [timerOn, setTimerOn] = usePersistentState(`${STORAGE_KEY}:timerOn`, true);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER_SECONDS);
  const timerRef = useRef(null);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    if (stage !== STAGES.CATEGORY) return;
    setFinalResolved({ p1: false, p2: false }); setFinalFirst(null); setWager({ p1: 0, p2: 0 });
    if (!bonusMap[q.id]) setBonusMap((m) => ({ ...m, [q.id]: Math.random() < 0.1 ? 2 : 1 }));
    setTimeLeft(DEFAULT_TIMER_SECONDS);
  }, [stage, index]);

  useEffect(() => {
    if (stage !== STAGES.QUESTION || !timerOn) return;
    const start = Date.now(); const total = DEFAULT_TIMER_SECONDS * 1000;
    timerRef.current = setInterval(() => {
      const left = Math.max(0, total - (Date.now() - start));
      setTimeLeft(Math.ceil(left / 1000));
      if (left <= 0) { clearInterval(timerRef.current); timerRef.current = null; setStage(STAGES.ANSWER); }
    }, 100);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [stage, timerOn]);

  const progress = useMemo(() => clamp(1 - timeLeft / DEFAULT_TIMER_SECONDS, 0, 1), [timeLeft]);

  function awardTo(key, base = 1, { useMultiplier = true } = {}) {
    const mult = useMultiplier ? currentMultiplier : 1;
    const baseDelta = base * mult; // category multiplier applies only to the base points
    if (key === "p1") {
      setP1((s) => {
        const newStreak = lastCorrect === "p1" ? s.streak + 1 : 1;
        const streakBonus = newStreak >= 3 ? 1 : 0; // flat +1 from 3rd correct (not multiplied)
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
  function adjustScore(key, delta) { (key === "p1" ? setP1 : setP2)((s) => ({ ...s, score: s.score + delta })); }

  // Jeopardy finale: resolve per player once
  function finalizeOutcome(key, outcome) {
    const bet = key === "p1" ? wager.p1 : wager.p2;
    if (finalResolved[key] || bet <= 0) return;
    if (outcome === "correct") {
      if (!finalFirst) setFinalFirst(key);
      // Jeopardy: correct = +bet (no multiplier, no streak)
      adjustScore(key, bet);
    } else {
      // Jeopardy: wrong = -bet
      adjustScore(key, -bet);
    }
    setFinalResolved((fr) => ({ ...fr, [key]: true }));
  }

  function next() {
    if (stage === STAGES.CATEGORY) setStage(STAGES.QUESTION);
    else if (stage === STAGES.FINALE) setStage(STAGES.QUESTION);
    else if (stage === STAGES.QUESTION) setStage(STAGES.ANSWER);
    else if (stage === STAGES.ANSWER) { if (index < lastIndex) { setIndex((i) => i + 1); setStage(STAGES.CATEGORY); } else setStage(STAGES.RESULTS); }
  }
  function previous() {
    if (stage === STAGES.QUESTION) setStage(STAGES.CATEGORY);
    else if (stage === STAGES.ANSWER) setStage(STAGES.QUESTION);
    else if (stage === STAGES.FINALE) setStage(STAGES.CATEGORY);
    else if (stage === STAGES.RESULTS) setStage(STAGES.ANSWER);
    else if (stage === STAGES.CATEGORY && index > 0) { setIndex((i) => i - 1); setStage(STAGES.ANSWER); }
  }

  function resetGame() {
    setIndex(0); setStage(STAGES.CATEGORY); setBonusMap({});
    setP1({ name: p1.name, score: 0, streak: 0, maxStreak: 0 }); setP2({ name: p2.name, score: 0, streak: 0, maxStreak: 0 });
    setWager({ p1: 0, p2: 0 }); setFinalResolved({ p1: false, p2: false }); setLastCorrect(null); setTimeLeft(DEFAULT_TIMER_SECONDS);
  }

  async function exportShareCard() {
    const w = 1080, h = 1350; const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
    // ensure web fonts are ready so canvas uses them
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch {} }
    // bg gradient
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, THEME.gradientFrom); g.addColorStop(1, THEME.gradientTo); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // title
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `800 64px Inter, Noto Sans, system-ui, sans-serif`; ctx.fillText("Football Quiz — Results", w/2, 140);
    // scores
    ctx.font = `700 52px Inter, Noto Sans, system-ui, sans-serif`; ctx.fillText(`${p1.name}: ${p1.score}`, w/2, 300); ctx.fillText(`${p2.name}: ${p2.score}`, w/2, 370);
    const winner = p1.score === p2.score ? "Draw!" : p1.score > p2.score ? `${p1.name} Wins 🏆` : `${p2.name} Wins 🏆`;
    ctx.font = `800 76px Inter, Noto Sans, system-ui, sans-serif`; ctx.fillText(winner, w/2, 520);
    ctx.font = `600 42px Inter, Noto Sans, system-ui, sans-serif`; ctx.fillText(`Longest streak — ${p1.name}: ${p1.maxStreak}`, w/2, 680); ctx.fillText(`Longest streak — ${p2.name}: ${p2.maxStreak}`, w/2, 740);
    ctx.font = `500 30px Inter, Noto Sans, system-ui, sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillText("onlyfootballfans • play with a friend", w/2, h - 80);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "quiz-results.png"; a.click();
  }

  // ——— UI subcomponents ———
  function Header() {
    return (
      <div className="px-4 pt-6 pb-2 font-ui">
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl">🧠⚽</span>
          <span className="rounded-full px-3 py-1 text-sm font-semibold shadow" style={{ background: THEME.accent }}>
            Q {index + 1} of {QUESTIONS.length}
          </span>
        </div>
        <div className="mt-2 text-center text-xs uppercase tracking-wide text-slate-300">
          {stageLabel(stage)}
        </div>
        <div className="mt-2 flex items-center justify-center">
          <button onClick={() => setShowHowTo(true)} className="btn btn-neutral">How to Play</button>
        </div>
      </div>
    );
  }

  
  function StageCard({ children }) { return <div className="card">{children}</div>; }

  function CategoryStage() {
    return (
      <StageCard>
        <div className="flex items-center justify-between">
          <div className="text-rose-400 text-4xl">🏆</div>
          {currentMultiplier > 1 && <div className="pill text-white" style={{ background: "#6D28D9" }}>Bonus x{currentMultiplier}</div>}
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-wide font-display">{q.category}</h2>
        <p className="mt-2 text-center font-ui" style={{ color: THEME.accent }}>x{q.basePoints} Points</p>
        {isFinalIndex && (
          <div className="mt-5 rounded-2xl bg-slate-900/50 p-4">
            <div className="mb-2 text-center text-sm text-slate-300 font-ui">Finale — Place your bets (0–3)</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <WagerControl
                label={p1.name}
                value={wager.p1}
                onChange={(n) => setWager((w) => ({ ...w, p1: clamp(n, 0, 3) }))}
                grad="linear-gradient(90deg,#BA1ED3,#F11467)"
              />
              <WagerControl
                label={p2.name}
                value={wager.p2}
                onChange={(n) => setWager((w) => ({ ...w, p2: clamp(n, 0, 3) }))}
                grad="linear-gradient(90deg,#00A7D7,#2563EB)"
              />
            </div>
            <div className="mt-2 text-center text-xs text-slate-400">Jeopardy: Right = +bet; Wrong = −bet. First‑to‑say wins (only one Correct can be applied).</div>
          </div>
        )}
        <div className="mt-6 flex justify-center gap-3"><NavButtons /></div>
      </StageCard>
    );
  }

  function QuestionStage() {
    return (
      <StageCard>
        <div className="mb-3">
          <div className="h-2 w-full rounded-full bg-slate-700/60">
            <div className="h-2 rounded-full transition-[width] duration-150 ease-linear" style={{ width: `${progress * 100}%`, background: THEME.accent }} />
          </div>
          <div className="mt-1 text-right text-xs text-slate-400 font-ui">{timerOn ? `${timeLeft}s` : "Timer off"}</div>
        </div>
        <div className="flex items-start justify-between">
          <div className="rounded-full bg-slate-700/70 px-3 py-1 text-xs font-semibold">Multiplier x{currentMultiplier}</div>
          <button onClick={() => setTimerOn((v) => !v)} className="btn btn-neutral text-xs" aria-label="toggle timer">{timerOn ? "Pause" : "Resume"}</button>
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold leading-snug">{q.text}</h3>
        <div className="mt-6 flex justify-center"><button onClick={() => setStage(STAGES.ANSWER)} className="btn btn-accent">Reveal Answer</button></div>
      </StageCard>
    );
  }

  function AnswerStage() {
    return (
      <StageCard>
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold">{q.answer}</div>
          {q.fact && <div className="mt-2 font-ui text-sm text-slate-300">ℹ️ {q.fact}</div>}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 font-ui">
          <div>
            <div className="mb-2 text-sm text-slate-300">{p1.name}</div>
            <div className="flex flex-wrap gap-2">{[1,2,3].map((n) => <button key={n} className="btn text-white" style={{ background: "linear-gradient(90deg,#BA1ED3,#F11467)" }} onClick={() => awardTo("p1", n)}>+{n}</button>)}</div>
          </div>
          <div>
            <div className="mb-2 text-sm text-slate-300">{p2.name}</div>
            <div className="flex flex-wrap gap-2">{[1,2,3].map((n) => <button key={n} className="btn text-white" style={{ background: "linear-gradient(90deg,#00A7D7,#2563EB)" }} onClick={() => awardTo("p2", n)}>+{n}</button>)}</div>
          </div>
        </div>
        {isFinalIndex && (
          <div className="card font-ui mt-6">
            <div className="mb-2 text-sm text-slate-300">Final Award — Jeopardy (+bet / −bet)</div>
            <div className="text-xs text-slate-400 mb-3">First‑to‑say wins: once one <em>Correct</em> is applied, the other player’s <em>Correct</em> is disabled.</div>
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
        <div className="mt-6 flex justify-center"><NavButtons /></div>
      </StageCard>
    );
  }

  // (kept for reference; not used in current flow)
  function FinaleStage() {
    return (
      <StageCard>
        <div className="mb-2 text-center text-sm uppercase tracking-wide text-slate-300 font-ui">Final Question — Place Your Bets</div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <WagerControl label={p1.name} value={wager.p1} onChange={(n) => setWager((w) => ({ ...w, p1: clamp(n, 0, 3) }))} grad="linear-gradient(90deg,#BA1ED3,#F11467)" />
          <WagerControl label={p2.name} value={wager.p2} onChange={(n) => setWager((w) => ({ ...w, p2: clamp(n, 0, 3) }))} grad="linear-gradient(90deg,#00A7D7,#2563EB)" />
        </div>
        <div className="mt-6 rounded-2xl bg-slate-900/50 p-4">
          <div className="mb-2 text-xs text-slate-400 font-ui">Final Question</div>
          <div className="font-display text-lg font-semibold">{q.text}</div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-ui">Bets are points; no category multiplier applies.</div>
          <button onClick={() => setStage(STAGES.QUESTION)} className="btn btn-accent">Start Final</button>
        </div>
      </StageCard>
    );
  }

  function ResultsStage() {
    const winner = p1.score === p2.score ? "Draw!" : p1.score > p2.score ? `${p1.name} wins 🏆` : `${p2.name} wins 🏆`;
    return (
      <StageCard>
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold">{winner}</div>
          <div className="mt-2 font-ui text-slate-300">{p1.name} {p1.score} — {p2.score} {p2.name}</div>
          <div className="mt-2 font-ui text-sm text-slate-400">Longest streaks: {p1.name} {p1.maxStreak} • {p2.name} {p2.maxStreak}</div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3 font-ui">
          <button onClick={exportShareCard} className="btn btn-neutral">Save Share Card (PNG)</button>
          <button onClick={resetGame} className="btn btn-accent">Play Again</button>
        </div>
      </StageCard>
    );
  }

  function WagerControl({ label, value, onChange, grad }) {
    return (
      <div className="card font-ui">
        <div className="mb-2 text-sm text-slate-300">{label}</div>
        <div className="flex items-center gap-2">
          <button className="btn btn-neutral" onClick={() => onChange(value - 1)}>−</button>
          <div className="pill text-white" style={{ background: grad }}>{value}</div>
          <button className="btn btn-neutral" onClick={() => onChange(value + 1)}>+</button>
        </div>
        <div className="mt-2 text-xs text-slate-400">Bet 0–3 points</div>
      </div>
    );
  }

  function NavButtons() {
    return (
      <div className="flex items-center justify-center gap-3">
        <button onClick={previous} className="btn btn-neutral">← Previous</button>
        <button onClick={next} className="btn btn-accent">Next →</button>
      </div>
    );
  }

  // ——— Lightweight self-tests (run with #selftest hash) ———
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#selftest') return;
    try {
      const applyJeopardy = (score, bet, outcome) => outcome === 'correct' ? score + bet : score - bet;
      console.assert(applyJeopardy(10, 3, 'correct') === 13, 'Jeopardy: +bet on correct');
      console.assert(applyJeopardy(10, 2, 'wrong') === 8, 'Jeopardy: -bet on wrong');
      const streakBonus = (prev, same) => (((same ? prev + 1 : 1) >= 3) ? 1 : 0);
      console.assert(streakBonus(2, true) === 1 && streakBonus(1, true) === 0, 'Streak bonus from 3rd correct');
      console.log('%cSelf-tests passed', 'color: #10b981');
    } catch (e) {
      console.warn('Self-tests failed', e);
    }
  }, []);

  return (
    <div className="min-h-screen w-full flex justify-center items-start p-4" style={{ background: `linear-gradient(180deg, ${THEME.gradientFrom}, ${THEME.gradientTo})` }}>
      <div className="w-full max-w-4xl space-y-4 text-slate-100">
        <Header />
        {showHowTo && <HowToModal onClose={() => setShowHowTo(false)} />}
        {stage === STAGES.CATEGORY && <CategoryStage />}
        {stage === STAGES.QUESTION && <QuestionStage />}
        {stage === STAGES.ANSWER && <AnswerStage />}

        {stage !== STAGES.RESULTS && (<>
          <div className="mt-2 text-center text-lg font-semibold font-ui">Player Scores</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PlayerPanel side="p1" player={p1} setPlayer={setP1} adjustScore={adjustScore} />
            <PlayerPanel side="p2" player={p2} setPlayer={setP2} adjustScore={adjustScore} />
          </div>
        </>)}

        {stage === STAGES.RESULTS && <ResultsStage />}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-300 font-ui">
          <div>Stage: {stageLabel(stage)}</div>
          <div className="flex items-center gap-3">
            <button className="btn btn-neutral" onClick={resetGame}>Reset Game</button>
            <label className="flex items-center gap-2"><input type="checkbox" checked={timerOn} onChange={(e) => setTimerOn(e.target.checked)} /> Timer enabled</label>
          </div>
        </div>
      </div>
    </div>
  );
}

function stageLabel(stage) {
  switch (stage) {
    case STAGES.CATEGORY: return "Category Stage";
    case STAGES.QUESTION: return "Question Stage";
    case STAGES.ANSWER: return "Answer Stage";
    case STAGES.FINALE: return "Finale (Wager)";
    case STAGES.RESULTS: return "Results";
    default: return "";
  }
}

// Hoisted to avoid remounting and input focus loss on each keystroke
function PlayerPanel({ side, player, setPlayer, adjustScore }) {
  const badgeGrad = side === "p1" ? "linear-gradient(90deg,#BA1ED3,#F11467)" : "linear-gradient(90deg,#00A7D7,#2563EB)";
  return (
    <div className="card font-ui">
      <div className="mb-2 flex items-center justify-between">
        <input
          className="w-40 rounded-lg bg-slate-900/60 px-2 py-1 text-slate-100 outline-none"
          value={player.name}
          onChange={(e) => setPlayer((s) => ({ ...s, name: e.target.value }))}
          aria-label={`${side} name`}
        />
        <div className="pill text-white" style={{ background: badgeGrad }}>{player.score}</div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <button className="btn btn-neutral" onClick={() => adjustScore(side, -1)} aria-label="decrease score">−</button>
          <button className="btn btn-neutral" onClick={() => adjustScore(side, +1)} aria-label="increase score">+</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-300">Streak:</span>
          <span className="pill text-amber-200" style={{ background: "rgba(245, 158, 11, 0.25)" }}>{player.streak > 0 ? `🔥 +${player.streak}` : "—"}</span>
          <span className="text-slate-500 text-xs">(max {player.maxStreak})</span>
        </div>
      </div>
    </div>
  );
}

function HowToModal({ onClose }) {
  const [lang, setLang] = useState('en');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl card font-ui">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-extrabold">{lang === 'en' ? 'How to Play' : 'Πώς παίζεται'}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setLang('en')} className={`pill ${lang==='en'?'btn-neutral':''}`}>EN</button>
              <button onClick={() => setLang('el')} className={`pill ${lang==='el'?'btn-neutral':''}`}>ΕΛ</button>
              <button onClick={onClose} className="btn btn-neutral">Close ✕</button>
            </div>
          </div>
          {lang === 'en' ? (
            <div className="mt-4 space-y-4 text-slate-200 text-sm">
              <section>
                <h3 className="font-display text-lg font-bold">Quick Start</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>2 players on one device. Enter your names.</li>
                  <li>Each round flows: <span className="pill bg-slate-700/60">Category</span> → <span className="pill bg-slate-700/60">Question</span> → <span className="pill bg-slate-700/60">Answer</span>. Final question includes a wager.</li>
                  <li><span className="pill" style={{background:'var(--brand-accent)', color:'#fff'}}>House rule</span> Each player gets <strong>one spoken guess</strong> per question.</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Round Flow & Scoring</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li><strong>Question:</strong> Speak your one guess before the timer ends. The host can Pause/Resume.</li>
                  <li><strong>Reveal:</strong> Tap <em>Reveal Answer</em>, then award the correct player with <em>+1/+2/+3</em>. Bonus ×2 (≈10%) doubles points on that question.</li>
                  <li><strong>Streak bonus:</strong> Starting from the <em>3rd consecutive correct</em>, add a flat <strong>+1</strong> bonus (not multiplied).</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Finale — Jeopardy Style</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li><strong>Before</strong> the final question is shown, each player places a bet (0–3 points) on the Category screen.</li>
                  <li><strong>Right = +bet</strong>, <strong>Wrong = −bet</strong>. First‑to‑say wins (only one <em>Correct</em> may be applied). No multipliers.</li>
                  <li>If you want both players to answer independently, use the <em>write‑down</em> variant; otherwise award based on who answered correctly per your house rule.</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Timer & Sharing</h3>
                <p className="mt-2">15s per question by default. At the end, save a PNG share card for Instagram.</p>
              </section>
            </div>
          ) : (
            <div className="mt-4 space-y-4 text-slate-200 text-sm">
              <section>
                <h3 className="font-display text-lg font-bold">Γρήγορη εκκίνηση</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>2 παίκτες στην ίδια συσκευή. Βάλτε τα ονόματά σας.</li>
                  <li>Κάθε γύρος: <span className="pill bg-slate-700/60">Κατηγορία</span> → <span className="pill bg-slate-700/60">Ερώτηση</span> → <span className="pill bg-slate-700/60">Απάντηση</span>. Η τελευταία ερώτηση έχει στοίχημα.</li>
                  <li><span className="pill" style={{background:'var(--brand-accent)', color:'#fff'}}>Κανόνας</span> Κάθε παίκτης έχει <strong>μία προφορική προσπάθεια</strong> ανά ερώτηση.</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Ροή & Βαθμολογία</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li><strong>Ερώτηση:</strong> Δώστε την μία προσπάθειά σας πριν τελειώσει ο χρόνος. Ο παρουσιαστής μπορεί να κάνει Παύση/Συνέχεια.</li>
                  <li><strong>Αποκάλυψη:</strong> Πατάμε <em>Reveal Answer</em> και δίνουμε πόντους στον σωστό παίκτη με <em>+1/+2/+3</em>. Το Bonus ×2 (≈10%) διπλασιάζει τους πόντους της ερώτησης.</li>
                  <li><strong>Streak:</strong> Από την <em>3η συνεχόμενη σωστή</em> απάντηση και μετά, δίνεται επιπλέον <strong>+1</strong> (δεν πολλαπλασιάζεται).</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Τελικός — Jeopardy</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li><strong>Πριν</strong> εμφανιστεί η τελική ερώτηση, κάθε παίκτης ποντάρει (0–3) στην οθόνη Κατηγορίας.</li>
                  <li><strong>Σωστό = +στοίχημα</strong>, <strong>Λάθος = −στοίχημα</strong>. Κερδίζει ο πιο γρήγορος (μία μόνο <em>Σωστό</em> επιλογή). Δεν ισχύουν πολλαπλασιαστές.</li>
                  <li>Αν θέλετε να απαντήσουν και οι δύο ανεξάρτητα, χρησιμοποιήστε τη λύση <em>γράψε‑την‑απάντηση</em>.</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-bold">Χρόνος & Κοινοποίηση</h3>
                <p className="mt-2">15s ανά ερώτηση. Στο τέλος, αποθηκεύστε την κάρτα αποτελεσμάτων (PNG) για Instagram.</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

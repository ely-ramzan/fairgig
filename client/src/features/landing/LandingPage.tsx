import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SmoothScroll } from '../../components/shared/SmoothScroll';

const HERO_LINES = [
  'Your labor is real.',
  'Your data is yours.',
  "It's time to prove it.",
];
  
const TICKER_TEXT =
  '[CAREEM] - GULBERG - 12 HRS - PKR 4500 - 30% DEDUCTION • ' +
  '[FOODPANDA] - DHA PHASE 5 - NET PKR 2100 • ' +
  '[UBER] - CANTT - 9 HRS - PKR 3900 - 22% DEDUCTION • ' +
  '[INDRIVER] - JOHAR TOWN - NET PKR 2600 • ';

export function LandingPage() {
  const problemSectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: problemSectionRef,
    offset: ['start start', 'end end'],
  });
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-65%']);

  return (
    <SmoothScroll>
      <>
        {/* ── Fixed nav (user guidance) ────────────────────────────────── */}
        <header className="fixed w-full z-50 border-b border-border bg-bg/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 md:px-10">
            <div className="font-serif text-2xl text-t1">FAIRGIG.</div>
            <div className="flex items-center gap-6">
              <Link
                to="/login"
                className="font-mono text-xs text-t2 hover:text-amber transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="border border-border px-5 py-2 font-mono text-xs bg-t1 text-bg hover:bg-t2 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </header>

        <section className="relative min-h-screen overflow-hidden bg-bg">
          <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
            <motion.div
              className="whitespace-nowrap font-mono text-[12px] md:text-base tracking-[0.18em] uppercase text-t3 opacity-10"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ repeat: Infinity, duration: 30, ease: 'linear' }}
            >
              <span className="pr-8">{TICKER_TEXT}</span>
              <span className="pr-8">{TICKER_TEXT}</span>
              <span className="pr-8">{TICKER_TEXT}</span>
              <span className="pr-8">{TICKER_TEXT}</span>
            </motion.div>
          </div>

          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center pt-24 px-6 text-center md:px-10">
            <div className="space-y-1 md:space-y-3">
              {HERO_LINES.map((line, index) => (
                <div key={line} className="overflow-hidden">
                  <motion.h1
                    initial={{ y: '120%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    transition={{
                      duration: 0.9,
                      ease: [0.22, 1, 0.36, 1],
                      delay: index * 0.2,
                    }}
                    className="font-playfair text-t1 text-[clamp(3.2rem,8vw,8rem)] leading-[0.95] tracking-[-0.02em]"
                  >
                    {line}
                  </motion.h1>
                </div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: [0, 6, 0] }}
              transition={{
                opacity: { delay: 1.1, duration: 0.5 },
                y: { repeat: Infinity, duration: 1.8, ease: 'easeInOut' },
              }}
              className="mt-12 font-mono text-[10px] md:text-xs tracking-[0.22em] uppercase text-amber"
            >
              SCROLL TO INVESTIGATE ↓
            </motion.div>
          </div>
        </section>

        <section ref={problemSectionRef} className="relative h-[300vh] bg-bg">
          <div className="sticky top-0 flex h-screen items-center overflow-hidden">
            <motion.div style={{ x }} className="flex gap-8 px-[8vw] md:gap-12">
              <article className="w-[85vw] md:w-[45vw] max-w-[600px] shrink-0 rounded-sm border border-border bg-surface p-8 md:p-12 flex flex-col justify-center">
                <p className="mb-8 font-mono text-[10px] tracking-[0.2em] uppercase text-amber">
                  The Problem
                </p>
                <h2 className="font-serif text-t1 text-[clamp(2rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.02em]">
                  The Algorithmic
                  <br />
                  Black Box.
                </h2>
                <p className="mt-8 max-w-xl font-sans text-base leading-relaxed text-t2 md:text-lg">
                  Workers operate inside opaque systems that decide their income,
                  penalties, and survival without transparent records.
                </p>
              </article>

              <article className="w-[85vw] md:w-[45vw] max-w-[600px] shrink-0 rounded-sm border border-border bg-surface p-8 md:p-12 flex flex-col justify-center">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-t3">
                  Case 01
                </p>
                <h3 className="mt-4 font-serif text-t1 text-[clamp(1.8rem,4vw,3.2rem)] leading-tight">
                  Unpredictable Commissions.
                </h3>
                <p className="mt-4 max-w-lg font-sans text-t2 leading-relaxed">
                  A week that starts with predictable rates can end with sudden
                  extraction. No notice. No appeal.
                </p>
                <div className="mt-10 rounded-sm border border-border bg-bg/60 p-5">
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-t3">
                    Commission Ledger
                  </p>
                  <div className="mt-4 flex items-center gap-4 font-mono text-xl md:text-2xl">
                    <span className="text-t2 line-through">15%</span>
                    <span className="text-t3">→</span>
                    <span className="text-rust">30%</span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-rust">
                    Overnight rate spike detected
                  </p>
                </div>
              </article>

              <article className="w-[85vw] md:w-[45vw] max-w-[600px] shrink-0 rounded-sm border border-border bg-surface p-8 md:p-12 flex flex-col justify-center">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-t3">
                  Case 02
                </p>
                <h3 className="mt-4 font-serif text-t1 text-[clamp(1.8rem,4vw,3.2rem)] leading-tight">
                  Unexplained Deactivations.
                </h3>
                <p className="mt-4 max-w-lg font-sans text-t2 leading-relaxed">
                  Days of perfect attendance can end in one silent system flag and
                  a locked livelihood.
                </p>
                <div className="mt-10 rounded-sm border border-border bg-bg/60 p-5">
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-t3">
                    14-Day Activity Trail
                  </p>
                  <div className="mt-4 grid grid-cols-7 gap-2">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-2 rounded-full ${i < 13 ? 'bg-jade/50' : 'bg-rust'}`}
                      />
                    ))}
                  </div>
                  <div className="mt-5 inline-flex items-center rounded-md border border-rust/30 bg-rust/10 px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] uppercase text-rust">
                    Account suspended
                  </div>
                </div>
              </article>

              <article className="w-[85vw] md:w-[45vw] max-w-[600px] shrink-0 rounded-sm border border-border bg-surface p-8 md:p-12 flex flex-col justify-center">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-t3">
                  Case 03
                </p>
                <h3 className="mt-4 font-serif text-t1 text-[clamp(1.8rem,4vw,3.2rem)] leading-tight">
                  Invisible Footprints.
                </h3>
                <p className="mt-4 max-w-lg font-sans text-t2 leading-relaxed">
                  Without verified records, workers cannot prove earnings to
                  landlords, lenders, or banks. Real work becomes invisible.
                </p>
                <div className="mt-10 space-y-3">
                  <div className="rounded-sm border border-border bg-bg/60 p-4">
                    <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-t3">
                      Payslip requested
                    </p>
                    <p className="mt-2 font-sans text-sm text-t2">
                      “Please provide official monthly proof of income.”
                    </p>
                  </div>
                  <div className="rounded-sm border border-rust/30 bg-rust/10 p-4">
                    <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-rust">
                      Document unavailable
                    </p>
                    <p className="mt-2 font-sans text-sm text-rust/90">
                      Platform app history is not accepted as legal income proof.
                    </p>
                  </div>
                </div>
              </article>
            </motion.div>
          </div>
        </section>

        <section className="bg-bg px-6 py-24 md:px-10 md:py-32">
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* Left sticky rail */}
              <aside className="lg:col-span-4">
                <div className="lg:sticky lg:top-32">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-jade">
                    THE LEDGER
                  </div>
                  <h2 className="mt-5 font-serif text-t1 text-[clamp(2.2rem,4.4vw,4.4rem)] leading-[0.98] tracking-[-0.02em]">
                    Log. Verify.
                    <br />
                    Empower.
                  </h2>
                  <p className="mt-6 max-w-sm font-sans text-base leading-relaxed text-t2">
                    FairGig turns fragmented app screenshots and inconsistent histories
                    into a defensible ledger — verified entries, anomaly signals, and
                    community proof at scale.
                  </p>
                </div>
              </aside>

              {/* Right scrolling cards */}
              <div className="lg:col-span-8">
                <div className="flex flex-col gap-10">
                  <motion.article
                    initial={{ y: 18, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-sm border border-border bg-surface p-7 md:p-9"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-t3">
                          Log &amp; Verify
                        </div>
                        <h3 className="mt-3 font-serif text-t1 text-2xl md:text-3xl">
                          A shift becomes a record.
                        </h3>
                      </div>
                      <span className="shrink-0 rounded-full border border-jade/30 bg-jade/10 px-3 py-1 font-mono text-[10px] tracking-[0.16em] uppercase text-jade">
                        VERIFIED ✓
                      </span>
                    </div>

                    <div className="mt-8 rounded-sm border border-border bg-bg/60 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-t3">
                          [CAREEM] · Gulberg · 12 hrs
                        </div>
                        <div className="font-mono text-t1 text-xl md:text-2xl tracking-[-0.02em]">
                          PKR 5,420
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-3">
                        <div className="rounded-sm border border-border bg-surface/60 p-3">
                          <div className="font-mono text-[9px] tracking-widest uppercase text-t4">
                            Gross
                          </div>
                          <div className="mt-2 font-mono text-sm text-t1">
                            PKR 7,100
                          </div>
                        </div>
                        <div className="rounded-sm border border-border bg-surface/60 p-3">
                          <div className="font-mono text-[9px] tracking-widest uppercase text-t4">
                            Deductions
                          </div>
                          <div className="mt-2 font-mono text-sm text-t2">
                            PKR 1,680
                          </div>
                        </div>
                        <div className="rounded-sm border border-border bg-surface/60 p-3">
                          <div className="font-mono text-[9px] tracking-widest uppercase text-t4">
                            Rate
                          </div>
                          <div className="mt-2 font-mono text-sm text-amber">
                            23.6%
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.article>

                  <motion.article
                    initial={{ y: 18, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                    className="rounded-sm border border-border bg-surface p-7 md:p-9"
                  >
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-t3">
                      Anomaly Detection
                    </div>
                    <h3 className="mt-3 font-serif text-t1 text-2xl md:text-3xl">
                      Z-score engine, human clarity.
                    </h3>
                    <p className="mt-4 max-w-xl font-sans text-t2 leading-relaxed">
                      FairGig flags sudden commission spikes and income drops with
                      explainable signals — not vibes.
                    </p>

                    <div className="mt-8 rounded-sm border border-border bg-bg/60 p-5">
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-t3">
                          Rolling Average Drop
                        </div>
                        <div className="font-mono text-2xl md:text-3xl text-rust tracking-[-0.02em]">
                          -22%
                        </div>
                      </div>
                      <div className="mt-5 rounded-sm border border-rust/30 bg-rust/10 p-4">
                        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-rust">
                          SEVERITY: HIGH
                        </div>
                        <div className="mt-2 font-mono text-sm text-rust">
                          Z-SCORE: 2.4
                        </div>
                      </div>
                    </div>
                  </motion.article>

                  <motion.article
                    initial={{ y: 18, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                    className="rounded-sm border border-border bg-surface p-7 md:p-9"
                  >
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-t3">
                      Grievance Community
                    </div>
                    <h3 className="mt-3 font-serif text-t1 text-2xl md:text-3xl">
                      Proof becomes collective.
                    </h3>
                    <p className="mt-4 max-w-xl font-sans text-t2 leading-relaxed">
                      K-anonymity protects individuals while revealing patterns — the
                      scale of impact is visible without exposing anyone.
                    </p>

                    <div className="mt-8 rounded-sm border border-border bg-bg/60 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="rounded-full border border-amber/25 bg-amber-bg px-3 py-1 font-mono text-[10px] tracking-[0.14em] uppercase text-amber">
                          #CommissionSpike
                        </span>
                        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-t3">
                          12 workers · Gulberg
                        </span>
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-3">
                        {['open', 'escalated', 'resolved'].map((s) => (
                          <div key={s} className="rounded-sm border border-border bg-surface/60 p-3">
                            <div className="font-mono text-[9px] tracking-widest uppercase text-t4">
                              {s}
                            </div>
                            <div className="mt-2 font-mono text-sm text-t1">
                              {s === 'open' ? '08' : s === 'escalated' ? '03' : '01'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.article>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Light break: The Certificate ──────────────────────────────── */}
        <section
          className="px-6 py-24 md:px-10 md:py-32"
          style={{ backgroundColor: '#FDFAF5', color: '#1A160C' }}
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
              {/* Left copy */}
              <div className="lg:col-span-6">
                <div
                  className="font-mono text-[10px] tracking-[0.25em] uppercase"
                  style={{ color: 'rgba(26,22,12,0.55)' }}
                >
                  Physical proof
                </div>
                <h2 className="mt-5 font-serif text-5xl md:text-6xl leading-[0.95] tracking-[-0.02em]">
                  The ultimate goal:
                  <br />
                  Proof.
                </h2>
                <p className="mt-6 font-sans text-xl leading-relaxed max-w-xl" style={{ color: 'rgba(26,22,12,0.78)' }}>
                  Generate a verifiable, shareable income certificate for landlords, banks, and life.
                </p>
              </div>

              {/* Right: 3D floating paper */}
              <div className="lg:col-span-6">
                <div
                  className="relative mx-auto w-full max-w-full sm:max-w-[520px]"
                  style={{ perspective: '1200px' }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <motion.div
                      animate={{
                        rotateX: [8, 11, 8],
                        rotateY: [-10, -6, -10],
                        y: [0, -10, 0],
                      }}
                      transition={{
                        duration: 4.6,
                        ease: 'easeInOut',
                        repeat: Infinity,
                      }}
                      className="rounded-sm border"
                      style={{
                        transformStyle: 'preserve-3d',
                        background: '#FFFFFF',
                        borderColor: 'rgba(200,190,176,0.9)',
                      }}
                    >
                      {/* Paper header */}
                      <div className="px-6 sm:px-8 pt-7 sm:pt-8 pb-5 sm:pb-6 border-b" style={{ borderColor: 'rgba(200,190,176,0.7)' }}>
                        <div className="flex items-start justify-between gap-6">
                          <div>
                            <div className="font-mono text-[10px] tracking-[0.28em] uppercase" style={{ color: 'rgba(26,22,12,0.55)' }}>
                              FairGig Certificate
                            </div>
                            <div className="mt-3 font-serif text-2xl md:text-3xl tracking-[-0.02em]">
                              FAIRGIG VERIFIED EARNINGS
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(26,22,12,0.55)' }}>
                              Certificate No.
                            </div>
                            <div className="mt-2 font-mono text-sm">FG-2A9C-17E0</div>
                          </div>
                        </div>
                      </div>

                      {/* Paper body */}
                      <div className="px-6 sm:px-8 py-6 sm:py-7">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(26,22,12,0.55)' }}>
                              Verified net income
                            </div>
                            <div className="mt-2 font-mono text-3xl tracking-[-0.02em]">
                              PKR 84,200
                            </div>
                            <div className="mt-3 font-sans text-sm" style={{ color: 'rgba(26,22,12,0.72)' }}>
                              Range: Feb 01 → Mar 31, 2026
                            </div>
                          </div>
                          <div className="rounded-sm border p-4" style={{ borderColor: 'rgba(200,190,176,0.7)', background: '#FAF7F2' }}>
                            <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(26,22,12,0.55)' }}>
                              Included platforms
                            </div>
                            <div className="mt-3 flex flex-col gap-2 font-mono text-sm">
                              <div className="flex items-center justify-between">
                                <span>CAREEM</span>
                                <span style={{ color: 'rgba(26,22,12,0.62)' }}>52%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>FOODPANDA</span>
                                <span style={{ color: 'rgba(26,22,12,0.62)' }}>31%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>UBER</span>
                                <span style={{ color: 'rgba(26,22,12,0.62)' }}>17%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Barcode / footer strip */}
                        <div className="mt-8 flex items-end justify-between gap-6">
                          <div>
                            <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(26,22,12,0.55)' }}>
                              Verification hash
                            </div>
                            <div className="mt-2 font-mono text-sm">9f3e·8c11·2a7d·ff0b</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(26,22,12,0.55)' }}>
                              Barcode
                            </div>
                            <div className="mt-2 font-mono text-xs tracking-[0.45em]">
                              ||| |||| || ||||| |||| |||
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Soft desk shadow intentionally removed (anti-AI sharp aesthetic) */}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer / Climax ───────────────────────────────────────────── */}
        <footer className="bg-bg px-6 py-24 md:px-10 md:py-32">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex flex-col items-center text-center gap-10">
              <h2 className="font-serif text-t1 text-[clamp(2.6rem,6.6vw,6.8rem)] leading-[0.92] tracking-[-0.03em]">
                RECLAIM YOUR RECORD.
              </h2>

              <div className="flex w-full flex-col flex-wrap items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-6">
                <Link
                  to="/register?role=worker"
                  className="rounded-sm bg-amber px-6 py-3 font-mono text-[11px] tracking-[0.18em] uppercase text-black hover:opacity-80 transition-opacity"
                >
                  Join as Worker
                </Link>
                <Link
                  to="/register?role=verifier"
                  className="rounded-sm border border-border px-6 py-3 font-mono text-[11px] tracking-[0.18em] uppercase text-t1 hover:bg-surface transition-colors"
                >
                  Join as Verifier
                </Link>
                <Link
                  to="/register?role=advocate"
                  className="px-4 py-3 font-mono text-sm text-t2 underline underline-offset-4 hover:text-t1 transition-colors"
                >
                  Access Advocate Portal
                </Link>
              </div>

              <p className="max-w-xl font-sans text-sm text-t3 leading-relaxed">
                Built for workers, verifiers, and advocates. A ledger that turns platform volatility into proof.
              </p>
            </div>
          </div>
        </footer>
      </>
    </SmoothScroll>
  );
}

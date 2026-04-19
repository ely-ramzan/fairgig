// All design tokens as typed constants.
// Injected as CSS custom properties by ThemeContext via useLayoutEffect.
// Consume via var(--fg-*) in Tailwind or inline styles.

export type ThemeMode = 'dark' | 'light';

// Use a structural type (not literal equality) so LIGHT_TOKENS can differ safely.
export type DesignTokens = Record<`--fg-${string}`, string>;

export const DARK_TOKENS = {
  '--fg-bg':        '#0D1411', // Vault Obsidian
  '--fg-surface':   '#15201B', // Safe Deposit
  '--fg-elevated':  '#1C2A24',
  '--fg-border':    '#25362F',
  '--fg-border-2':  '#344A41',
  '--fg-t1':        '#E8ECE9', // Watermark White
  '--fg-t2':        '#9AA6A0',
  '--fg-t3':        '#68756F',
  '--fg-t4':        '#3B4540',
  '--fg-amber':     '#D19F5C', // Polished Brass (Action/Highlights)
  '--fg-amber-bg':  'rgba(209, 159, 92, 0.1)',
  '--fg-amber-bdr': 'rgba(209, 159, 92, 0.25)',
  '--fg-jade':      '#448065', // Minted Green (Verified)
  '--fg-jade-bg':   'rgba(68, 128, 101, 0.1)',
  '--fg-jade-bdr':  'rgba(68, 128, 101, 0.25)',
  '--fg-rust':      '#BA6843', // Oxidized Copper (Anomaly/Dispute)
  '--fg-rust-bg':   'rgba(186, 104, 67, 0.1)',
  '--fg-rust-bdr':  'rgba(186, 104, 67, 0.25)',
  '--fg-slate':     '#526B5F',
  '--fg-slate-bg':  'rgba(82, 107, 95, 0.1)',
  '--fg-font-serif': "'Fraunces', Georgia, serif",
  '--fg-font-sans':  "'DM Sans', system-ui, sans-serif",
  '--fg-font-mono':  "'JetBrains Mono', monospace",
} as const satisfies DesignTokens;

export const LIGHT_TOKENS = {
  '--fg-bg':        '#F1F4F2', // Bond Paper
  '--fg-surface':   '#FAFCFB', // Crisp Note
  '--fg-elevated':  '#FFFFFF',
  '--fg-border':    '#D2DBD7',
  '--fg-border-2':  '#B8C4BE',
  '--fg-t1':        '#151E19', // Intaglio Ink
  '--fg-t2':        '#57665F',
  '--fg-t3':        '#8A9992',
  '--fg-t4':        '#C2CCC7',
  '--fg-amber':     '#B88645', // Aged Brass
  '--fg-amber-bg':  'rgba(184, 134, 69, 0.08)',
  '--fg-amber-bdr': 'rgba(184, 134, 69, 0.25)',
  '--fg-jade':      '#2E5946', // Banknote Green
  '--fg-jade-bg':   'rgba(46, 89, 70, 0.08)',
  '--fg-jade-bdr':  'rgba(46, 89, 70, 0.25)',
  '--fg-rust':      '#A9623D', // Oxidized Copper
  '--fg-rust-bg':   'rgba(169, 98, 61, 0.08)',
  '--fg-rust-bdr':  'rgba(169, 98, 61, 0.25)',
  '--fg-slate':     '#455E52',
  '--fg-slate-bg':  'rgba(69, 94, 82, 0.08)',
  '--fg-font-serif': "'Fraunces', Georgia, serif",
  '--fg-font-sans':  "'DM Sans', system-ui, sans-serif",
  '--fg-font-mono':  "'JetBrains Mono', monospace",
} as const satisfies DesignTokens;

# Design — ms-web (Java Microservices demo)

A locked design system for this app. Every page redesign reads this file before emitting code.
Do not regenerate per page — extend or amend this file when the system needs to grow.

## Genre
modern-minimal (product-grade, Linear/Stripe school)

## Macrostructure family
- Search page (`app/page.tsx`): compact header → integrated search control → result-count meta → card grid.
- Detail page (`app/product/[id]/page.tsx`): back-link → eyebrow + display name + mono price → description → labeled spec grid.
- Loaders + not-found mirror the shape of the page they stand in for.

## Theme (light-first)
- `--color-paper`   oklch(99% 0.003 95)
- `--color-paper-2` oklch(97.5% 0.004 95)
- `--color-paper-3` oklch(94.5% 0.006 95)
- `--color-ink`     oklch(23% 0.015 265)
- `--color-ink-2`   oklch(46% 0.012 265)
- `--color-ink-3`   oklch(60% 0.01 265)
- `--color-rule`    oklch(90% 0.006 265)
- `--color-rule-2`  oklch(83% 0.008 265)
- `--color-accent`  oklch(52% 0.16 256)  (cool blue — ≤5% per viewport)
- `--color-accent-2` oklch(46% 0.16 256)
- `--color-accent-ink` oklch(99% 0.01 256)
- `--color-focus`   oklch(52% 0.16 256)
- Semantics (distinct from accent): `--color-ok` oklch(52% 0.12 150) · `--color-warn` oklch(55% 0.19 27) · `--color-star` oklch(72% 0.15 75)

## Typography
- Display + Body: Geist (`var(--font-geist-sans)`), weights 400/500/600
- Outlier (labels, prices, counts, eyebrows, meta): Geist Mono (`var(--font-geist-mono)`)
- Display scale: `--text-display` clamp(2rem, 1.35rem + 2.6vw, 3.25rem); `--text-title` clamp(1.5rem, 1.2rem + 1.3vw, 2.15rem)
- Eyebrows: mono, uppercase, tracking 0.18–0.2em, `--color-ink-3`

## Spacing
Tailwind default 4-pt scale via utilities. Tokens for radii: `--radius-card` 14px, `--radius-control` 10px.

## Motion (motion-cut project — CSS only)
- Card hover: `-translate-y-0.5` + `border-rule-2` + `shadow-card`, 200ms `--ease-out`
- Buttons: `hover:bg-accent-2`, `active:translate-y-px`
- Focus: instant 2px accent ring (`:focus-visible`), never animated
- `prefers-reduced-motion: reduce` collapses all transitions/animations

## Microinteractions stance
- Silent success; no toasts. Links/cards reveal the accent on hover. Focus ring instant.

## CTA voice
- Primary: filled accent, `rounded-control`, mono-free label, `px-5 py-3`
- Back-link: mono, `text-ink-3` → `hover:text-accent`

## What pages MUST share
- Geist + Geist Mono pairing; mono for all numerals/labels/eyebrows.
- The single blue accent and its ≤5% placement.
- Card shape (`rounded-card`, hairline `border-rule`, hover lift) and the hairline-divided footer row.
- The eyebrow → heading rhythm (mono uppercase eyebrow above, heading below — stacked, never two-column).

## What pages MAY differ on
- Container width (`max-w-5xl` grid pages vs `max-w-2xl` detail/content).
- Presence of the search control (search page only).

## Exports
See `tokens.css` at the project root for the drop-in token block. Tailwind v4 consumes these via
the `@theme` block in `app/globals.css` (utilities: `bg-paper`, `text-ink`, `border-rule`,
`text-accent`, `rounded-card`, `shadow-card`, `text-display`, `font-mono`, …).

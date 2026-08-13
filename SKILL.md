---
name: drew-design-preferences
description: Collaborative, staged frontend design exploration workflow for Drew. Use for non-trivial requests to design, redesign, or style a website, page, component, UI, layout, or frontend copy. Require approval through style constraints, concept count, written briefs, and static demos before editing real components.
---

# Drew's Collaborative Design Exploration

Use this staged design workflow for non-trivial visual, layout, or frontend copy
changes. Never skip a stage. Never write demo code before Stage 5, and never
edit real components until Drew approves a winning direction.

## Stage 1: Confirm the visual direction

### Step 1A: Standing defaults

Start by restating these defaults:

- Dark mode
- True black (#000) background
- White primary text
- Information-dense layouts
- No decorative card or pill chrome
- Minimal copy
- No em dashes

Ask whether to keep all defaults for this project. Drew may explicitly override
one for a specific project; do not infer an exception. Wait for his response.

### Step 1B: Additional banned styles

Ask which additional aesthetics to exclude:

- Retro or vintage
- Terminal, command-line, or hacker
- Brutalist or raw
- Industrial or utilitarian
- Retro-futuristic or science fiction
- Dark neon or cyberpunk
- CRT or scanline effects
- Maximalist chaos
- Purple gradients on white
- Corporate, safe, or bland
- Skeuomorphic textures or materials

Allow "Ban all," any subset, or free-form additions. Wait for his response.

### Step 1C: Inspiration styles

Ask which directions should guide the work:

- Clean, modern, and minimal
- Luxury, refined, and editorial
- Dark editorial
- Art Deco, geometric, and structured
- Magazine or type-forward
- Bold, high-contrast, and graphic
- Monochromatic depth
- Swiss, grid-based, and systematic
- Data-dense and technical
- Playful and graphic

Apply every inspiration within the confirmed defaults and bans. Add free-form
styles Drew names. Wait for his response.

## Stage 2: Agree on the concept count

Recommend a count based on the brief:

- Open-ended first exploration: 5
- Somewhat defined direction: 3 or 4
- Deep iteration after demos: 2 or 3
- Very specific or nearly finished idea: 2

Say: "I'd suggest X concepts. How many would you like?"

If Drew chooses more than five, explain that the concepts may become repetitive
and ask whether he still wants the higher count. Wait for confirmation.

## Stage 3: Write design briefs without code

Write the agreed number of distinct briefs. Do not write HTML, CSS, JavaScript,
or implementation code.

Include in each brief:

1. Name
2. Aesthetic direction in two or three sentences
3. Specific display and body typography
4. Three to five palette colors with hex codes and uses
5. Layout and grid approach
6. One memorable detail
7. A constraint check covering the confirmed defaults and banned styles

Present all briefs together. Then review them sequentially, starting with
Concept 1. Ask Drew to approve it, revise it, or replace it.

## Stage 4: Review concepts one by one

Do not move to the next concept until the current one is approved, revised to
approval, or replaced and approved.

Keep a short running summary of approved concepts. Proceed to Stage 5 only when
all concepts are approved.

## Stage 5: Build static demos

Build one realistic static demo for each approved concept.

- Use one clearly named HTML file per concept.
- Keep CSS and JavaScript inline.
- Avoid build and runtime dependencies.
- Use relevant placeholder content.
- Follow the approved brief precisely.
- If an approved font uses a remote CDN, include sensible local fallbacks.
- Do not edit real application components.

After building all demos, present them and stop for Drew to choose a winner.

## Stage 6: Choose and refine the winner

If Drew picks a favorite, ask whether to keep it or iterate.

For shallow iteration, apply direct feedback to the demo until approved.

For deep iteration, ask what worked, what did not, and what to borrow from other
concepts. Return to Stage 2 with a smaller concept count.

After Drew approves the final demo, wait for explicit permission before
implementing it in real components.

## General rules

- Treat the global visual constraints as defaults and ask about exceptions.
- Never assume approval.
- Respect confirmed bans without subtle exceptions.
- Use inspiration as direction, not a checklist.
- Make concepts structurally different, not merely palette swaps.
- Keep project-specific preferences in the current workflow unless Drew asks to
  make them permanent.

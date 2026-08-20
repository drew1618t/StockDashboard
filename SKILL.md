---
name: drew-design-preferences
description: Explore and approve frontend designs with Drew through visual constraints, distinct briefs, and verified static demos before editing real components. Use for non-trivial requests to design, redesign, or style a website, page, component, UI, layout, or frontend copy. Do not use for disposable utility HTML created only to inspect or compare information.
---

# Drew's Collaborative Design Exploration

Use this staged design workflow for non-trivial visual, layout, or frontend copy
changes. Start at the earliest unresolved stage. Treat explicit decisions in
the current conversation as completed inputs, but preserve every remaining
approval gate. Do not write demo code before Stage 5 or edit real components
until Drew approves a winning direction.

## Out of scope: disposable utility HTML

Skip this entire workflow when Drew asks for a throwaway HTML page to look at
or compare something (e.g. "make an HTML viewer for X," "give me an HTML page
comparing Y") rather than to design or ship a real UI. Apply the standing
global visual defaults directly and build the page immediately, with no stages,
questions, or approval gates.

If Drew asks to iterate on it as a real design afterward, switch into the
staged workflow from Stage 1.

## Stage 1: Confirm the visual direction

### Step 1A: Standing defaults

Read the standing visual defaults from the current global instructions and any
project-specific design rules. Summarize the active defaults and explicit
overrides already supplied. Ask only about unresolved exceptions. This step is
complete when every standing default is accepted or explicitly overridden for
the current project.

### Step 1B: Additional banned styles

If the current conversation does not resolve the bans, ask which additional
aesthetics to exclude:

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

Allow "Ban all," any subset, or free-form additions. Wait only when the bans
remain unresolved. This step is complete when the active bans are explicit.

### Step 1C: Inspiration styles

If the current conversation does not supply a direction, ask which styles
should guide the work:

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
styles Drew names. Wait only when the direction remains unresolved. This step
is complete when at least one direction is explicit.

## Stage 2: Agree on the concept count

Recommend a count based on the brief:

- Open-ended first exploration: 5
- Somewhat defined direction: 3 or 4
- Deep iteration after demos: 2 or 3
- Very specific or nearly finished idea: 2

If Drew already chose a count, use it. Otherwise say: "I'd suggest X concepts.
How many would you like?"

If Drew chooses more than five, explain that the concepts may become repetitive
and ask whether he still wants the higher count. This stage is complete when
the count is explicit and any above-five warning is resolved.

## Stage 3: Write design briefs without code

Write the agreed number of distinct briefs. Do not write HTML, CSS, JavaScript,
or implementation code.

Inspect only enough of the current interface to identify its content,
structure, design constraints, and reusable assets. Stop researching when each
brief can be grounded in those facts.

Include in each brief:

1. Name
2. Aesthetic direction in two or three sentences
3. Specific display and body typography
4. Three to five palette colors with hex codes and uses
5. Layout and grid approach
6. One memorable detail
7. Any constraint conflict, risk, or intentional exception. Omit this item when
   none exists.

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
- Render and inspect each demo at desktop and narrow viewport sizes.
- Resolve visible layout errors and material differences from the approved
  brief before presenting the demo.

This stage is complete when every demo renders correctly at both viewport sizes
and materially matches its approved brief. Present all demos and stop for Drew
to choose a winner.

## Stage 6: Choose and refine the winner

If Drew picks a favorite, ask whether to keep it or iterate.

For shallow iteration, apply direct feedback to the demo until approved.

For deep iteration, ask what worked, what did not, and what to borrow from other
concepts. Return to Stage 2 with a smaller concept count.

After Drew approves the final demo, wait for explicit permission before
implementing it in real components. Once authorized, implement the approved
direction, run the project's relevant tests, and inspect the real interface at
desktop and narrow viewport sizes. The workflow is complete when the
implementation materially matches the approved demo and proportional
validation passes.

## General rules

- Never assume approval.
- Respect confirmed bans without subtle exceptions.
- Use inspiration as direction, not a checklist.
- Make concepts structurally different, not merely palette swaps.
- Keep project-specific preferences in the current workflow unless Drew asks to
  make them permanent.

---
name: codebase-analyzer
description: >-
  Analyze an unfamiliar codebase, identify its most important flows, and illustrate
  each one with a diagram (Mermaid in Markdown, or an interactive HTML page). Use this
  whenever the user wants to understand, map, document, or visualize how a codebase
  works — its architecture, request/execution lifecycle, data flow, module dependencies,
  or state machines. Trigger on phrases like "map this codebase", "diagram the main
  flows", "how does this system work", "visualize the architecture", "chart the request
  lifecycle", "give me an overview of this repo", "onboard me to this project", or any
  request to turn code into flow diagrams — even when the user doesn't say the word
  "diagram" but clearly wants to see how the pieces connect.
---

# Codebase Analyzer

Turn an unfamiliar codebase into a small set of accurate, readable flow diagrams that
show how it actually works. The goal is the map a senior engineer would sketch on a
whiteboard to onboard someone: a few high-value flows, each traced through real code,
each with a diagram and a short explanation.

## The one rule that makes this useful: ground everything in real code

A diagram that *looks* right but doesn't match the code is worse than no diagram — it
teaches the reader something false and they'll trust it. The entire value of this skill
is that its diagrams are **traced, not guessed**. Before a box or arrow goes into a
diagram, you should be able to point at the file and line that justifies it.

Concretely, this means:

- **Follow the calls, don't pattern-match on names.** A function called `handleRequest`
  tells you a name, not a flow. Open it, read what it calls, follow those calls. The
  diagram comes from what the code *does*, not what things are named.
- **Cite as you go.** Every node/edge in a flow should trace to a `path/to/file.ts:123`.
  You'll surface these citations in the output so the reader can verify and go deeper.
- **When you can't confirm a hop, say so** rather than inventing it. A dashed edge
  labeled "async, not fully traced" is honest; a solid arrow you guessed at is a bug.

If you find yourself writing a diagram faster than you're reading code, stop — you're
guessing.

## Workflow

### 1. Scope: what are we mapping?

Two modes, and you'll usually know which from the request:

- **Targeted** — the user named a subsystem, entrypoint, feature, or directory ("map
  the auth flow", "how does the updater work", "diagram `src/scheduler`"). Map flows
  *within or through* that target. Start from the named thing and trace outward.
- **Overview** — the user wants the lay of the land ("map this codebase", "onboard me").
  You choose the flows. Aim for the 3–5 that a newcomer most needs to understand the
  system. Don't try to diagram everything; a map of everything is a map of nothing.

If the scope is genuinely ambiguous and the codebase is large, it's fine to do a quick
recon pass and then tell the user which flows you're planning to map before investing in
tracing all of them — but don't over-ask. A reasonable default set is better than a
question.

### 2. Recon: get your bearings fast

Build a cheap mental model before deep tracing:

- Identify language(s), framework(s), and the build/entry manifest (`package.json`,
  `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, etc.). The manifest's scripts,
  entrypoints, and dependencies tell you what kind of system this is (web server, CLI,
  library, daemon, batch job).
- Find the **entrypoints** — `main`, server bootstrap, CLI command registration, HTTP
  route tables, message/queue consumers, cron/scheduler registration, exported public
  API. These are where flows begin.
- Skim the top-level directory structure to learn the module vocabulary.

Use search tools (glob/grep) for breadth; read files for depth. Read the manifest and
top-level entrypoints fully — they're worth it.

### 3. Select the flows worth mapping

A "flow" is a coherent path of execution or data with a clear start and end. Good
candidates, roughly in priority order for an overview:

1. **The primary request/execution lifecycle** — what happens on the system's main job
   (an HTTP request, a CLI invocation, a processed message) from entry to response.
2. **Module / dependency map** — the high-level components and how they depend on each
   other. One of these orients the reader before the detailed flows.
3. **Key data flows** — how important data enters, transforms, and lands (persistence,
   external calls, queues).
4. **State machines / lifecycles** — for stateful entities (sessions, jobs, orders,
   connections), the states and transitions.

Pick flows by *importance to understanding the system*, not by what's easiest to
diagram. For a targeted request, the target dictates the set.

### 4. Trace each flow through the code

For each selected flow, walk the actual code path. Start at the entrypoint, read what it
calls, follow into those functions, and keep a running list of the meaningful steps and
the `file:line` where each happens. Collapse trivial plumbing; keep the steps that carry
meaning (a decision, a boundary crossing, a side effect, an external call). Aim for the
altitude where a step is something you'd mention explaining the flow aloud — not every
function call, not just "it works."

Note boundaries specially: network calls, DB reads/writes, queue publish/consume,
process/VM/thread hops, third-party APIs. These are the parts readers most want to see.

### 5. Choose the right diagram type per flow

Match the diagram to the flow's shape. See `references/mermaid-recipes.md` for copy-ready
templates, syntax, and styling for each — **read it before writing your first diagram**.
Quick guide:

| Flow shape | Diagram type |
|---|---|
| Ordered interaction between actors/components over time | `sequenceDiagram` |
| Branching process with decisions | `flowchart` |
| How components depend on / contain each other | `flowchart` (or `graph`) |
| Data moving and transforming across stages | `flowchart` (left-to-right) |
| A stateful entity's states and transitions | `stateDiagram-v2` |

Keep each diagram readable: roughly 5–12 nodes. If a flow is bigger, split it — an
overview diagram plus a zoomed-in one for the gnarly part beats one unreadable wall of
boxes.

### 6. Assemble the output

Default to **committed Markdown with Mermaid** — it lives with the code, renders on
GitHub, and diffs. Produce an HTML **artifact** instead (or in addition) when the user
wants something visual/shareable, asks for an interactive page, or the diagrams benefit
from rendering (e.g. presenting to non-engineers). When unsure, Markdown is the safe
default; offer the artifact as a follow-up.

Each flow gets the same structure so the document reads consistently:

```markdown
## <Flow name>

<1–3 sentences: what this flow does and when it runs.>

```mermaid
<diagram>
```

**Path:** `entry.ts:12` → `router.ts:44` → `handler.ts:88` → `db.ts:210`

<Optional: 2–4 bullets on non-obvious steps, decisions, or boundaries worth calling out.>
```

Structure the whole document as:

1. **Title + one-paragraph orientation** — what the system is, in plain language.
2. **Module/dependency map** — the big picture, first, so later flows have a frame.
3. **The detailed flows**, each in the structure above.
4. Optional **"Where to look"** table mapping each flow to its key files.

Write the file into the repo where docs live (`docs/`, `ARCHITECTURE.md`, or alongside
the relevant module) unless the user says otherwise. Tell the user the path and give a
2–3 line summary of what you mapped and any flow you deliberately left out.

## Quality bar before you hand it over

- **Every diagram traces to real code.** You could defend each arrow with a `file:line`.
- **The diagrams render.** Mermaid syntax is valid (see the recipes reference for the
  gotchas — labels with special characters, reserved words, quoting).
- **Right altitude.** A newcomer learns the system from these; an expert doesn't cringe
  at oversimplification or drown in detail.
- **Honest about gaps.** Anything you couldn't trace is marked, not smoothed over.
- **Consistent structure**, so the reader learns to read one flow and can read them all.

## HTML artifact notes

When producing an artifact, load the `artifact-design` skill first. Mermaid needs a
script to render; since artifacts block external CDNs, either inline the Mermaid library
or pre-render diagrams to inline SVG. If that's impractical, prefer the Markdown output
and say so rather than shipping a broken page.

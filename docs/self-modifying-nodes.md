# Self-Modifying Nodes — boundaries, not hooks

A design spec for a packaged Mac app where non-programmer users describe changes
in natural language and the AI **freely rewrites code** — new nodes, forks of
existing nodes, large functionality changes. The AI has the whole codebase; it
forks a node by *copying its code and modifying it*, not by filling in a plugin
API.

So this is **not** a plugin API (an exhaustive catalog of hooks). It is the
opposite: the **smallest set of boundaries** the runtime enforces so that
independently-written nodes coexist safely — plus an **open capability library**
the AI may use but is never limited to.

## The core principle

> **The surface is the set of seams between independently-owned code — and
> nothing else. Anything one party owns alone is free; only what two parties must
> agree on is a contract.**

`onMessageSend`, `onAIMessageFinish`, streaming, citation parsing — these live
*inside one node*. They cross no boundary, so they are on **no** surface; the AI
just writes them. You can't enumerate them and shouldn't try.

What *does* cross a boundary, and therefore must be defined:

- **node ↔ canvas** — the runtime mounts, moves, sizes, deletes, persists a node
  without knowing its insides.
- **node ↔ node** — messaging.
- **node ↔ host** — capabilities (`createNode`, `llm`, `tab.readPage`).
- **node ↔ agent** — structured output / tools.

Inside a node: no surface. Free code.

### The inversion

In a plugin system you *maximize* the API. Here the AI owns the codebase, so
every pre-defined hook is a ceiling on what the AI may imagine. Therefore:
**minimize the enforced surface; never try to complete it.** Stop once you've
covered (1) what the canvas needs to host any node, (2) what nodes must share to
message, (3) what must be sandboxed. Past that, more API is a liability — if
something's missing, the AI adds it.

### The fork rule

> **Copy freely below the boundary; conform strictly at the boundary.**

Fork the whole component body. But a forked node must still speak the same
message protocol, expose the same identity/lifecycle, and serialize through the
same validated state path — or nodes can't coexist. Body: free. Seam: enforced.

### Two clocks: types are generated, instances are populated

> **Code generation creates *types*; the running app creates *instances*. The
> runtime LLM emits data that fills a schema — never code.**

There are two completely separate moments, and conflating them is a category
error:

- **Modification-time (rare, produces code).** The AI writes a node *type* once —
  component, `dataSchema`, `accepts`, handlers. Slow, validated, lint/type-checked,
  versioned, hot-reloaded, reviewed like any code change.
- **Run-time (frequent, produces only data).** Instantiating that type is a
  structured LLM call (or plain logic) that returns JSON conforming to its
  `dataSchema`, fed to `createNode(kind, { data })`. No code generated.

This is the line between *the AI modifying the software* and *the software
running*. Keep them apart. Per-instance generated UI (writing fresh HTML on every
drop) is the wrong side of every tradeoff — no reuse, unvalidated code on the hot
path, an HTML blob persisted as "state" (defeating the Part 1 boundary), and a
compile/reload cycle per action. The runtime should essentially never emit code;
a true one-off is still "a type used once," not runtime HTML.

Example: a `youtube-summary` **type** (component + `dataSchema:
{ videoNodeId, segments: { seconds, text }[] }`) is generated once. Every dropped
video is an **instance**: `tab.readPage` → `llm.run({ schema })` returns
`segments` → `createNode('youtube-summary', { data })`. Re-uses the type forever;
restyling the type updates every instance.

---

## Part 1 — the enforced boundary (small, complete, the AI cannot violate it)

This is the entire node ↔ canvas contract. It is intentionally ~6 things.

| Seam | What the canvas owns / requires | Node's part |
|---|---|---|
| **Identity** | `id`, `kind`, `version` | declares `kind`, `version` |
| **Spatial** | move / setPosition / delete; renders at `position`+`size` | opts into `resizable`; otherwise size is intrinsic |
| **Render** | mounts the component inside a per-node **error boundary** | a React component `({ id, data, host, selected })` |
| **State** | stores `data` as serializable JSON, **schema-validated** before it touches the shared doc | `dataSchema`; optional `persist`/`hydrate` (default identity) |
| **Ports + messaging** | routes messages along authorized edges | declares hideable input/output ports + `onMessage(msg, host)` it accepts |
| **Drop** | routes an OS-file or node drop to the node under the cursor | optional `onDrop(payload, host)` |

Notes:
- **Validation + error boundary are what make free code safe.** A broken
  generated node degrades to a placeholder; a malformed `data` is rejected before
  it can corrupt the `canvas.json` holding the *good* nodes.
- **Paste is not here.** It is a canvas-level ingest concern, not a node concern
  (and out of scope — we care about drop, not paste).
- **`version` enables rollback.** Non-programmers will generate broken
  iterations; canvas docs pin a node-type version so a bad one reverts cleanly.

A node also declares, for *discovery* (so other nodes and the generator can find
it) but not as enforcement:
- `menu?: { label, keycap }` — Actions-legend row + shortcut (omit = not
  user-spawnable; born only via drop / messaging / the agent).
- `accepts?` / `sends?` — the message types it handles / emits, with payload
  shapes. Used for validation + so a forked sender knows a command *exists*.
- `agent?: { prompt, outputSchema }` — for AI-driven nodes: text injected into a
  wired chat's system prompt + the structured-output shape the renderer parses.

---

## Part 2 — node ↔ node: messaging (not "connections")

Reframe edges entirely as **message channels**. An edge authorizes two nodes to
message each other; the **arrow is the direction** of messaging.

- A **message** is `{ type, ...payload }`, validated against the receiver's
  `accepts[type]`.
- `host.send(targetId, msg)` → routed to the target's `onMessage`.
- Targets resolve from the node's own edges: `host.neighbors(myId, dir)`.
- An edge also grants **read access**: connected nodes may read each other's
  published state (subject to direction), which is how a "context" relationship
  (note always visible to chat) reduces to the same primitive as an imperative
  command (citation click → highlight).

This subsumes today's edge taxonomy. There are no more "edge kinds" — context /
output / fork / derive become *protocols the two endpoints agree on over an
authorized, directed channel*:
- context = chat *reads* note's published content
- output = chat *sends* edits to note
- citation = chat *sends* `highlight` to PDF

Declared `accepts`/`sends` are what make cross-node generation reliable: forking
the PDF node to accept `highlight` lets the chat side discover the message exists
rather than guess.

---

## Part 3 — node ↔ host: the open capability library

Not a contract — a *library*. Additive (new methods never break existing nodes),
optional (use what you need), and extensible (missing method → the AI adds it).
The same surface is re-exposed to the **agent as tools**, governed by CLAUDE.md
policy — build once, expose twice.

**Canvas** *(also agent tools)* — `createNode(kind, {near?, data?})`,
`deleteNode(id)`, `connect(srcId, dstId)`, `updateNodeData(id, patch)`,
`placeNear(id, opts)`, `getNode(id)`, `neighbors(id, dir?)`.

**Messaging** — `send(targetId, msg)`.

**Services** *(node code; gated by what the node declares it needs)* —
`llm.run({ prompt, schema?, model? })`, `tab.readPage(id)` (webview extraction),
`file.read(...)`, `net.fetch(...)`.

**UI / lifecycle** — `openPanel(id, mode)`, `toast(msg)`, `setStatus(id, …)`.

CLAUDE.md "when I ask for images, spawn connected nodes" needs *only* this plane:
the agent calls `createNode` + `connect` N times, no new node type — the cheapest
end-to-end proof of self-modification.

---

## Worked examples, in the model

**Image rule (CLAUDE.md)** — host/agent plane only. `createNode('file')` +
`connect(chatId, id)` ×N, triggered by plain-language policy.

**YouTube on drop** — a node (or the canvas) receives the URL via `onDrop`,
calls `tab.readPage`, runs `llm.run` for an interactive summary, `createNode`s a
transcript node whose segment clicks `send(ytId, {type:'seek', seconds})`. The
YouTube tab node declares `accepts: { seek, play }`.

**PDF citations** — the genuinely cross-cutting one: a *forked* PDF node that
`accepts: { highlight }`, plus a *forked* chat node with `agent.prompt`/
`outputSchema` and a renderer that parses citations into chips; a chip click
`send`s `highlight` along the chat→PDF channel. Not one node — a node fork +
a message type + an agent-output contract. The planner must treat it as a
bundle, not a single artifact. **This is the one case where "just fork a node"
is insufficient; some features are relationships.**

---

## Build order (each step independently useful)

1. **Node registry + per-type validated state** — the core stops reading
   `n.data.*`; persist/hydrate move onto each type. Until this exists nothing is
   safe to generate.
2. **Host library, exposed twice** (functions + agent tools) — unlocks the image
   rule almost for free.
3. **Messaging + per-node `onDrop`** — unlocks YouTube.
4. **`accepts`/`sends` declarations + the agent-output contract** — unlocks PDF
   citations (last; most cross-cutting).

## The generation loop

Classify the request into plane(s) and show a plain-language plan → fork/copy and
modify against the boundary + library → validate (schema, types, lint) → isolate
(error boundary, capability scope) → hot-reload and iterate → version so it can
roll back.

## Honest hard parts

- **Some features are relationships, not nodes** (citations). The planner edits
  both ends + the agent contract coherently. This is the real difficulty.
- **Trust boundary** — users running AI-written code makes validation,
  sandboxing, and undo first-class, not afterthoughts.
- **The boundary doc is the prompt.** Reliability rests on Part 1–3 staying small
  and stable. Every addition to the *enforced* surface is forever.

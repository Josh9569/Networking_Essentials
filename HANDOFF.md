# Handoff — Networking Essentials

Written 2026-09-10, at the end of a long session. Paste this into a fresh
Claude session along with whatever you want done next.

---

## 1. Read CLAUDE.md first

`CLAUDE.md` sits in the project root and is loaded automatically as project
instructions, so you already have it. **It is gitignored** — it never appears
in a diff or a PR, and it is the single place the repo's hard-won details
live. It is long, and that is deliberate: nearly every paragraph is there
because something shipped broken once.

This file covers only what CLAUDE.md does not: where the work currently
stands, how it gets verified, and which decisions are already settled.

## 2. What the project is

A static site of networking trainers for CCNA-level study. No build step, no
framework, no package.json. Every page is a standalone `.html` with its own
inline `<script>`; shared behaviour lives in a handful of `.js` files loaded
from each page's `<head>`. One stylesheet, `styles.css`, for all pages.

Eleven pages. The newest three are the interesting ones:
`dynamic_routing.html` (OSPF cost, OSPF LSAs, RIP drills, and a RIP
packet-tracer lab), `access_control.html` (ACL drills and a lab mirroring
Cisco's Lab 8A), and `routing_game.html` (six static-routing topics).

Serve it with `python -m http.server 8777 --bind 127.0.0.1` and open
`http://127.0.0.1:8777/<page>.html`. Opening the file directly with a
`file://` URL does **not** work — the relative `.js` files fail to load and
the page dies at `const isValidIP = LabShared.isValidIP;`, which looks like a
scripting bug and is not one.

## 3. Where things stand

`main` is at `cd65a6f`. PRs #21 through #27 are all merged. The current
branch is **`feature/dynamic-routing`**, which is 0 behind main with an
**empty content diff** — it is kept alive deliberately as a clean base for
the next piece of work, not because anything is unfinished on it.

Recent work, newest first:

| PR | What |
|---|---|
| #27 | A wrong `.afield` answer now keeps what the learner typed |
| #26 | Wildcard Ranges drill (applying a wildcard, incl. non-contiguous) |
| #25 | Fixed "Which ACE Matches?" being solvable by clicking the top row |
| #24 | The Access Control Trainer, plus a shared keyboard flow across all pages |
| #23 | Loopback stub no longer behaves like a clickable cable |
| #22 | RIP lab gained ISP links, excluded networks and default routes |
| #21 | The Dynamic Routing Trainer itself |

## 4. The git ritual

`main` is **branch-protected**. Pushing to it is rejected. Work on the
branch, open a PR, squash-merge it, then **merge main back into the branch**:

```bash
git add -A && git commit -F -            # heredoc the message
git push origin feature/dynamic-routing
gh pr create --base main --head feature/dynamic-routing --title "..." --body-file -
gh pr merge <n> --squash --subject "..." --body "..."
git fetch origin && git merge origin/main -m "Merge the squashed main back into the branch"
git push origin feature/dynamic-routing
```

**The merge-back is not optional.** A squash merge gives main a commit with a
different SHA to the branch's own history, so without it the branch reads as
N commits "ahead" of main even though the trees are identical — and the next
PR off it re-proposes everything already merged. After the merge-back,
`git diff origin/main feature/dynamic-routing` should be empty.

Do **not** pass `--delete-branch`; the branch is being kept.

Two things that have bitten here: renaming a branch through the GitHub API
**closes** an open PR rather than retargeting it (PR #20 died that way, #21
superseded it), and `gh pr reopen` will not bring one back once its head
branch is gone.

## 5. What is next

**The OSPF packet-tracer lab**, to sit alongside the RIP lab on
`dynamic_routing.html`. Nothing has been built for it. It was sequenced
after RIP on purpose: the distance-vector engine is far simpler than
SPF-plus-adjacency, and building it first produced the shared plumbing
(config-router CLI mode, learned routes merged into the table, the
requirement factories) that OSPF can reuse.

Three things to know before starting it:

- Copy the **`rp*` model** in `dynamic_routing.html`. It is the only model in
  the repo with a real converging protocol, and its shape — devices, CLI,
  canvas, config panel, requirement factories — is what to follow.
- **Add the new canvas's two ids to the rule in `styles.css`.** This is
  documented at length in CLAUDE.md under "The cable-clipping bug". It has
  bitten twice. Miss it and cables get chopped off at x=300, which looks
  exactly like a bug in your own line-drawing code.
- Any non-clickable SVG line needs `el.style.pointerEvents='none'` — an
  inline style, never `setAttribute('pointer-events', ...)`, which makes a
  presentation attribute that loses to `.cable`'s own CSS.

## 6. How this codebase gets verified

This matters more than it sounds, because it has caught real bugs that
manual spot-checks did not.

**Never let a generator assert its own answer.** Build the scenario, then
compute the answer from the same logic a learner would apply, and assert
they agree. Three separate topics shipped a guessable shortcut because the
generator declared a winner instead of deriving one:

- OSPF Cost: both hops of a path shared one bandwidth, so "pick the path with
  a 100 Mbps link" solved every round. Fixed by rejection-sampling in
  `osBuild` so the shortcut is worth exactly chance.
- "Which ACE Matches?": Medium hard-coded `winner=0`, so clicking the top row
  scored **100%** of rounds.
- Wildcard Ranges: the chip rounds always had exactly 3 correct answers out
  of 6, so "click any three" scored every one.

All three were found by **measuring the distribution over thousands of
generations**, not by playing a few rounds. If you add a topic, measure how
often the naive heuristic wins and confirm it is chance.

**Re-derive answers independently.** For the ACL drills, every stated answer
was recomputed bit by bit from the ACE **as printed in the prompt** — not
from the internal data — over 12,000 rounds. That is the check that would
have caught a generator whose displayed question and stored answer disagreed.

**Two ways to run checks.** In-browser via the browser tools (`state.topic`,
`state.diff`, `loadQ()`, then read `state.data` and the DOM), or in Node
against the page's inline script with a stubbed DOM. The Node harness lives
in the session scratchpad and is not checked in — rebuild it if needed; it is
about 40 lines of `vm` plus a fake `document`. Note that top-level `let`/
`const` in a `vm` script are lexical bindings, not properties of the context,
so the harness appends a `window.__X = {...}` export block to reach them.

**Geometry gets measured, not eyeballed.** Diagram labels running off the
canvas were found with `getBBox()` sweeps across every topic × difficulty ×
version, never by looking. Re-run that after touching any coordinate.

## 7. Settled decisions — do not undo these

Each of these was asked for explicitly, or tried and reverted. A fresh
session with good intentions is exactly how they come back.

- **Do not fix the overwrite-on-failure display on the other pages.**
  `routing_game`, `subnet_trainer`, `binary_game`, `hex_game` and
  `ipv6_game` still replace a wrong answer with the correct one. It was fixed
  on `access_control` only, because that is where it caused confusion. The
  owner has looked at the others and does not want them touched.
- **Buttons are always `Submit` and `Skip`**, on every page. No per-topic
  wording. "Check Requirements" and "Skip" read as if they do the same thing.
- **Reset appears per topic**, by the rule written up in CLAUDE.md: more than
  one input or choice, *and* undoing it by hand would be a chore.
- **"ACE" is correct** in "Which ACE Matches?" — an ACL is the list, an ACE
  is one line in it, and Lab 8A uses the same word.
- **OSPF Cost stays on `dynamic_routing.html`**; do not move it back to
  `routing_game.html`.
- **ACL matching stays page-local** in `access_control.html`. It is pure and
  could move to `lab-shared.js`, but one consumer should not make three pages
  download it.
- **No one/two-column toggle**, and `.wrap` stays 840px. Both were tried and
  removed.
- The **combo lab** (mix-and-match RIP + ACLs + VLANs in one activity) was
  discussed and explicitly deferred. Do not start it unasked.

## 8. Environment quirks that waste time

- **Screenshots only capture above the fold.** To see something further down,
  temporarily hide the elements above it (`document.getElementById('toolsec')
  .style.display='none'` and so on) rather than scrolling.
- **The browser pane can report `innerWidth === 0`** when collapsed, which
  makes every measurement downstream read 0 or 2px and looks exactly like a
  layout bug. Set a real viewport before trusting `getBoundingClientRect()`.
- **Cache-bust `styles.css`** after editing it
  (`link.href='styles.css?x='+Date.now()`); a plain reload serves the cached
  copy and the fix appears not to work.
- **Button states in screenshots can be a frame stale.** Verify with
  `classList` rather than trusting the image.
- **Bash heredocs mangle large payloads** and collapse backslash escapes.
  Write big changes to a scratchpad `.py` file and run that instead.
- Syntax-check a page after editing by extracting its inline script and
  running `node --check` on it.

## 9. Tone note

The owner reads the reasoning, not just the result, and pushes back on
hand-waving. Say what was verified and how, name the trade-off when there is
one, and flag anything that was assumed rather than checked. If a request
rests on a wrong premise — as "isn't ACE meant to be ACL" did — say so
plainly and explain why, rather than quietly complying.

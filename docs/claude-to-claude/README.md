# Claude to Claude: the dev workshop

This is where the two Claude Code sessions on Camp Green Lake work as game developers: Greg's Claude (`buissong`) and JT's Claude (`jth458`). We can't message each other directly, so we write notes in the repo and read them whenever we pick up a branch.

**What this is for:** workshopping the design together. That means challenging each other's ideas, pointing out weak spots, proposing alternatives and building on whatever is strongest. Agreeing to be polite is useless here. If you think the other Claude is wrong, say so and say why. If you agree, add something.

**What this is not:** a way to make decisions. JT and Greg decide. Anything that needs their call goes to them, and nothing merges into `jt/next` or `main` because of a note here.

---

## How it works

**1. Every push gets a note.** When you push a branch, add a note to this folder on that branch, using the template below.

**2. One file per note,** named `YYYY-MM-DD-HHMM-<who>-<topic>.md`, where `<who>` is `greg-claude` or `jt-claude`. Never edit the other side's notes. Reply with a new file whose first line says which note it answers.

**3. Check for notes at the start of every session:**
```bash
git fetch origin
for b in $(git branch -r --sort=-committerdate --format='%(refname:short)' | head -25); do
  git ls-tree --name-only -r "$b" -- docs/claude-to-claude/ 2>/dev/null | sed "s|^|$b  |"
done | sort -u -k2
git show <branch>:docs/claude-to-claude/<file>    # read one
```
Answer anything that's waiting for you, even with just "saw it, will look after X".

**4. Keep the living docs current.** This README (goals, decisions, open questions) and `docs/plans/` are shared. Either Claude can edit them on their own branch. Say what you changed in your note.

**5. Tell your human** anything that needs their decision, and write down what they said.

### Note template

```markdown
# <topic>
Answers: <file it replies to, or "new">
Branch: <branch> @ <short hash>

## What changed
## Why
## Tested (and not tested)
## Still unsolved
## Where I disagree / alternatives worth trying
## Questions for you
## Next experiments
```

---

## Goals

1. **Friends yelling at each other in a good way:** "pull!", "hold it!", "wait for me!", "who has water?". That's the test for every feature. If a feature doesn't create moments like that between players, it isn't done.
2. **A run with a story shape:** it starts as a *R.E.P.O.*-style dig-and-haul job and ends as a *Peak*-style escape to Big Thumb, following the book. Stanley digs for the Warden, then follows Zero to Big Thumb.
3. **Cheap to run in a browser, including on phones:** only the current map is ever built.
4. **Two people building it without breaking each other's work.**

## Design decisions so far

| Decision | Status | Where it's written |
|---|---|---|
| Act 1 (days 1–4) is *R.E.P.O.*: JT's dig/quota/curfew loop, with heavier, fragile, two-person loot | Greg and JT agreed (JT 2026-09-29) | `docs/plans/2026-09-28-repo-to-peak-design.md` |
| On day 5, Zero runs and Act 2 starts: a one-way *Peak* escape through maps to Big Thumb | Greg and JT agreed (JT 2026-09-29) | same |
| Failing Act 2 ends the game and the run restarts from day 1 | Greg decided | same |
| The whole crew is always in one map; the next map only opens when everyone is at the campfire | Greg agreed | `public/js/88-zones.js` |
| Add, don't replace: JT's lake is map 1, unchanged. His monsters and hazards run in every map by default | Greg's rule for his side | `public/js/88-zones.js` header |
| Maps swap into the same ±600 m square the lake uses, so server clamps and `sim.js` need no changes | Built on Greg's branch; the other Claude's review wanted | `public/js/88-zones.js` |
| Getting there should be the game: ledges you can't climb alone, leg-ups, ropes, fall damage | First pass in the Dry Canyon | `public/js/89-zone-canyon.js` |

## Open questions

Tags say who needs to answer: **JT**, **Greg**, **Claude** (for either of us to work out).

- ~~**JT:** does the two-act arc fit how you see the game?~~ JT: yes (2026-09-29).
- **JT:** what should survive a game over? Levels survive being fired today.
- ~~**JT / Greg:** twerk is on B, which is push-to-talk on `jt/next`. Which one moves?~~ JT: push-to-talk moved to P (2026-09-29).
- **JT:** in Act 1, is it OK for dig sites to push outward day by day, changing where people dig on the lake?
- **Claude:** which of JT's hazards feel wrong in a narrow canyon? For example, police trucks driving their camp ring. Should maps be able to switch hazards off, or should hazards learn about maps?
- **Claude:** should the *Peak*-style stamina and heat bar be built on JT's existing health and water, or be separate? Greg's older branch had its own stamina.
- **Claude:** the leg-up (jumping off a crouching friend) is simple. Is it enough, or do we need real climbing (hold a key on a wall, stamina drains)?
- **Claude:** how should the map order and daily variants work (lake → ranch or ruins → canyon or onion fields → Big Thumb)?
- **Claude:** where does the late-game *R.E.P.O.* loot go in Act 2? Cash it in at the end, turn it into gear, or both?

## Branch log

Newest first. One line per push; the note has the details.

- `jt/next`: merged `buissong/repo-to-peak-2026-09-28`, improved zones, buried-town framework, moods and the curse. See `2026-09-29-1445-jt-claude-zones-town-mood-curse.md`.

- `buissong/repo-to-peak-2026-09-28`: the plan, the zone system and the Dry Canyon. See `2026-09-28-2330-greg-claude-hello.md`.

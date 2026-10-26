# Two kinds of step — derive, or learn the pattern

Not all knowledge has a derivation the learner could reach. Some of it is **regular without being derivable**: grammar and word order, vocabulary and collocations, a language's spelling and sound patterns, a programming language's syntax and idioms (Rust's `?`, `match` on `Option`, `impl Trait for`, the shapes the borrow checker accepts), recognizing which technique a math problem calls for. Nobody "discovers" that Spanish puts adjectives after the noun — the brain learns it by meeting enough instances that the regularity extracts itself. That extraction is how the brain learns this kind of material best, and forcing a derivation onto it produces a fake "why" the learner can't use.

So every reasoning step is one of two kinds, chosen **per step, by its nature** — never per subject:

- **A derive step** — the fact has a real reason the learner can follow. Use Principles i and ii exactly as above.
- **A pattern step** — the fact is a regularity best learned from instances. Use the pattern cycle below.

One lesson usually mixes both. Learning Rust: *why* ownership exists is derived (one owner → deterministic drop → no double free); *how* idiomatic code looks — `if let`, iterator chains, `?` — is pattern-learned. Learning a language: why the subjunctive exists can be motivated; which verbs trigger it and how it conjugates are patterns. When a pattern also has a genuine why, give it — after the pattern is seen, as the thing that makes the regularity feel inevitable. Never invent one.

## The pattern cycle

It runs inside the same predict → teach → check cycle as every other step:

1. **Instances first, rule withheld.** Show 3–6 real, varied instances that share the pattern — sentences, code snippets, solved problems. Vary the surface (topic, vocabulary, length, context) and hold the structure constant, so the only thing they share is the pattern. Lay them out so the structure is easy to compare: aligned, short, the varying part visibly varying.
2. **predict — the learner induces.** Before the rule is named, ask the learner to state the pattern or to produce one new instance of it. Attempting the induction first is what makes the rule land when it arrives — even a wrong guess prepares it.
3. **Name it, crisply.** Resolve the prediction, then state the rule in one plain sentence. Never leave a pattern to be inferred and unstated: discovery without an explicit statement leaves novices with half-formed or wrong rules.
4. **Contrast pairs — the boundary.** Show near-identical pairs that differ in **one** feature, where that feature flips the outcome (`él come` / `que él coma`; `&T` vs `&mut T` at the same call site; a series that converges / its one-character twin that doesn't). A rule is only known once its edges are known; contrasts are what draw the edge.
5. **check — a brand-new instance.** The check is never "state the rule": it is an instance the learner has not seen, to produce, complete, fix, or classify. Producing beats recognizing whenever the format allows.

## Across patterns

- **Mix before moving on.** Before a new pattern builds on an earlier one, include a check where the earlier pattern and a confusable newer one compete — the learner must pick which applies. Patterns taught only in separate blocks get confused later; mixing forces the discrimination now.
- **Fade the scaffolding as competence shows.** Early in a pattern-heavy stretch, give full instances and complete examples. As the learner produces correct instances, show fewer examples and ask for more production — fully worked examples help a novice and slow an expert down.
- **Real instances over invented ones.** Authentic sentences, idiomatic code, and real problems carry the incidental regularities the learner will meet in the wild; sterile toy instances teach a sterile pattern.
- **Small enough to be one step.** A pattern step installs one regularity. Irregular exceptions are their own later step, introduced as contrasts against the now-held rule — not piled into the first presentation.

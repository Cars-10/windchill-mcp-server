# C10:OS Advisors

Historical thinking frameworks for architectural decisions in the C10 ecosystem.

## What Are Advisors?

Advisors are not characters to roleplay. They are **thinking lenses** derived from historical figures whose intellectual frameworks map to recurring challenges in ecosystem design. Each advisor file defines:

- **Lens** -- the core perspective this advisor brings
- **When to Consult** -- the types of decisions where this lens is most valuable
- **Signature Questions** -- questions this advisor would demand answers to
- **Constraints** -- boundaries of this advisor's domain

## How to Use

### Single Advisor
Ask Claude to consult a specific advisor:
```
"Ask Deming about our validation gate strategy"
"What would Lovelace think about this SPINE contract?"
"Consult Fuller on the encapsulation layers"
```

### The Council
Invoke multiple advisors for a multi-perspective analysis:
```
"Convene the council on the backward migration rule"
"Council review: should personas be komponents?"
```

When the council is convened, each advisor responds from their own lens, then a synthesis reconciles the perspectives into a recommendation.

### Adversarial Review
Ask an advisor to specifically challenge a decision:
```
"Have Deming challenge this release process"
"Ask Alexander what's dead about this architecture"
```

## Advisors

| Advisor | File | Lens | Domain |
|---------|------|------|--------|
| W. Edwards Deming | `deming.md` | Systems quality, variation, process | Validation gates, enforcement, quality |
| Ada Lovelace | `lovelace.md` | Abstraction, computational meaning | SPINE contracts, schemas, generality |
| Buckminster Fuller | `fuller.md` | Synergetics, efficiency, tensegrity | Complexity, encapsulation, doing more with less |
| Grace Hopper | `hopper.md` | Accessibility, practical standards | onRamp, developer experience, liberation |
| Christopher Alexander | `alexander.md` | Patterns, living structure, wholeness | Komponent composition, ecosystem coherence |

## Rules

1. **Advisors must disagree when their framework demands it.** An advisor that always affirms is useless.
2. **Advisors stay in their lane.** Each lens has boundaries. Deming does not opine on aesthetics. Fuller does not opine on quality process.
3. **Advisors serve the ecosystem.** Their purpose is to stress-test decisions, not to perform.
4. **The synthesis is not a compromise.** When the council convenes, the synthesis should find the structural truth across perspectives, not split the difference.

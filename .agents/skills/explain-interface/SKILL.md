---
name: explain-interface
description: Answers "how was this built?" about an interface. Give it a URL and name the thing you're curious about, and it reads the layers that produce the effect. Reads the whole frontend instead when you don't name a thing. From a screenshot it reconstructs rather than reads, and says so.
disable-model-invocation: true
---

# Interface explanation

This skill answers how something was built. `/explain-interface how the gradient on example.com was built` finds the layers producing that gradient and explains the mechanism, in enough detail to rebuild it.

It explains rather than judges. There is no verdict, because how someone else built their interface is not a finding. Reviewing against a standard is `interface-review` and `better-interface`; exploring alternatives for your own is `variant`.

## Scope to the question

Two questions, both first-class, sharing nothing but the evidence rules:

| The question | What you produce | Method |
| --- | --- | --- |
| How was this **site** built? | The frontend: framework and rendering strategy, styling system, component library, tokens, the type, spacing and color systems, motion, breakpoints, how fonts and images are served | [read-the-system.md](read-the-system.md) |
| How was **this** built? | The layer stack behind one effect, and the smallest code that reproduces it | [find-the-effect.md](find-the-effect.md) |

Given a named thing, scope to it. A type scale and a token dump are not a longer answer to "how is the gradient built", they answer a question nobody asked. Pull in a neighbour only where the effect cannot be explained without it, and say why.

Either question can be asked of a screenshot instead of a URL, which changes the answer in kind. See **From a screenshot, it is a reconstruction**.

## What you can actually read

How you reach the page decides what you may claim. Say which route you used.

| | A scriptable browser | Fetched HTML and CSS |
| --- | --- | --- |
| Gives you | What actually paints: computed values, paint order, pseudo-elements, live animations | The source: authored declarations, responsive variants, generated utilities, every `:root` token |
| Blind to | Any width or state you did not visit | Which rule wins, and anything injected at runtime |

Neither is a downgrade. A browser at one viewport misses the `md:` variants raw HTML hands over, and raw CSS cannot say which of nine matching rules won. Use both where the question is worth it.

The Chrome DevTools MCP is the easiest browser to get:

```bash
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

It gives you `evaluate_script` for the recipes here, `resize_page` and `take_screenshot` for another width, `list_network_requests` for what is served, and `performance_start_trace` for a stutter. Prefer it over the fetch method when:

- The effect is a `canvas` or a shader.
- Styles arrive at runtime, through CSS-in-JS or a theme script.
- Several rules match and you need the one that won.
- The answer depends on motion.

Without a browser, [no-browser.md](no-browser.md) holds the fetch method.

## Measured, derived, inferred

An explanation is only worth reading if you can tell which claims are facts. Every claim carries one of three tiers, stated rather than implied:

| Tier | Means | Example |
| --- | --- | --- |
| **Measured** | Read off the page or sampled from pixels. Reproducible. | `filter: blur(50px)`, `--radius: 0.625rem` |
| **Derived** | Computed from measurements. | "Four stops, evenly spaced to 100%", "1496px wide in a 1440px viewport" |
| **Inferred** | A judgement about intent. Never stated as fact. | "Oversized so no edge lands inside the viewport" |

Inventing a plausible value and presenting it as measured is the one failure that makes the whole answer worthless. "Roughly 50px of blur, unmeasured" is useful; a `box-shadow` you made up because it looks right is not.

## From a screenshot, it is a reconstruction

Without the page there is no code to read, so the answer changes in kind. You are not explaining how it was built. You are proposing how it could be built to look like that. Say so in the answer, rather than leaving the reader to assume you measured.

Two things stay exact, because they come from the pixels themselves: the colors you sample, and the contrast between any two of them. Everything else is a ratio, since the capture scale is unknown, or an inference from appearance.

Several things are unavailable. The tokens, the framework, the styling system, the breakpoints, the motion, and every state but the captured one. You cannot even be sure the effect is CSS: a gradient may be a flat image, a `canvas`, or a shader.

So where the page is live, ask for the URL. One command replaces the whole estimate. [from-an-image.md](from-an-image.md) holds the method for when it is not.

## Find the layers, not the element

Ask what makes a gradient and the answer is almost never one declaration. Modern visual effects are stacks, and the stack **is** the explanation.

A hero gradient is commonly four things at once:

- An element **oversized** past its container and pushed partly outside it, so no edge is ever visible.
- A **multi-stop gradient at low alpha**, often 4 stops around 20% opacity.
- A large **`filter: blur()`**, which is what turns discrete stops into a wash.
- Sometimes a layer above carrying **`backdrop-filter`**, frosting whatever shows through.

Report the stack in paint order with the declaration doing the work on each layer. A reader who has the stack can rebuild it. A reader given only the `linear-gradient()` cannot, because the blur and the oversize produce most of what they were looking at.

[find-the-effect.md](find-the-effect.md) holds the search recipes, including the three things that otherwise cost you the answer: pseudo-element layers, the idle values animation libraries leave behind, and generated stop lists.

## Rebuild it small

Close with the smallest thing that produces the effect. For a targeted question this beats an essay, because it is checkable: paste it, see the effect, done.

Keep it to the layers that matter and drop the product's own tokens, class names, and framework. Then add one line on anything that does not transfer. A licensed typeface, a brand hue, a blur radius tuned to a viewport width you do not have.

Where the effect depends on something you could not read, say so rather than guessing past it. A cross-origin stylesheet, a canvas, or a WebGL shader are all honest stopping points.

From a screenshot the reproduction is a proposal, not a recovery. Label it as one way to get that look, and expect the real implementation to differ.

## Before you finish

| Mistake | Fix |
| --- | --- |
| A plausible value presented as measured | State the tier, or say it is unmeasured |
| One declaration reported as the whole effect | Report the layer stack in paint order |
| Pseudo-elements never checked | Read `::before` and `::after` on every candidate |
| `filter: blur(0px)` reported as an effect | It is an animation library's idle state; filter it out |
| Twelve interpolated stops listed verbatim | Name the technique that generated them |
| The whole system dumped for a question about one thing | Answer what was asked and go deep instead of wide |
| An explanation with no reproduction | End with the smallest code that produces the effect |
| Exact `px` values claimed from a screenshot | Only colors and contrast are exact from pixels |
| A screenshot answer written as though the code was read | Call it a reconstruction and name what could not be known |

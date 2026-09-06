# Models launch kit

Status: drafts, not posted. No maintainer outreach has been sent.

## Position

A model dropdown is easy. Keeping its settings correct is the work.

Models discovers provider catalogs, validates selected options, and maps them
back to provider requests. Install one TypeScript package and keep the UI in
your own codebase. This is the claim the demo must prove.

## Short launch post

I built Models because an AI model picker needs more than a list of names.

Reasoning effort, speed modes, and provider options change with the model.
Models pairs live catalogs with validated settings and shows the resulting
selection. One TypeScript package; the UI is yours to copy and edit.

Try it without an API key:
https://axel-rock.github.io/models/

Code: https://github.com/axel-rock/models

If you maintain model lists or option mappings in a chat app, I would like to
hear which part is hardest to keep correct.

## Show HN draft

Title: Show HN: Models, live AI model catalogs and copyable selectors
URL: https://axel-rock.github.io/models/

First comment:

I made this for the part between choosing a model and sending the request.
Model IDs alone do not describe which settings to show or how those settings
map to a provider. Models keeps source evidence, unknown capabilities, and
mapping warnings explicit.

The demo works without credentials. There is one npm package with core,
providers, and optional AI SDK imports. UI components are copied source.

This is an early release. I would especially value examples of provider
settings the current mapping does not handle. It selects and maps models; it
does not route requests or claim every provider fact is known.

## Visual sequence

Use the real playground and a live catalog. No generated output or fake user counts.

1. Show the composer with a selected model.
2. Open the menu and change reasoning effort or speed.
3. Show the resulting selection JSON.
4. End on the install command and repository URL.

Keep the whole sequence under 20 seconds. Use the caption:
"A model dropdown is easy. Keeping its settings correct is the work."
The checked-in composer.png is an actual browser screenshot, not a design mockup.

## Relevant distribution candidates

These are places to investigate, not endorsements or confirmed integrations.

- OpenRouter's first-party sign-in starter: https://github.com/OpenRouterTeam/sign-in-with-openrouter
  Last push checked on 2026-09-06: 2026-08-25. It supports several frameworks. Explore whether a catalog and settings example
  helps users after authentication. Do not propose replacing its auth layer.
- Vercel's Svelte AI chatbot: https://github.com/vercel/ai-chatbot-svelte
  Last push checked on 2026-09-06: 2025-06-06. Lower priority until maintenance activity is confirmed. Check model settings before proposing a small example.
  The package can be useful without adopting the copied UI.
- Svelte AI Chat: https://github.com/YusufCeng1z/svelte-ai-chat
  Last push checked on 2026-09-06: 2026-02-07. Lower priority than a recently active project. The copyable Svelte interface is a relevant audience. Review its current model
  configuration before suggesting an integration.
- OpenRouter's community: https://www.reddit.com/r/openrouter/
  Use the current project-sharing thread if its rules permit. Lead with a working
  OpenRouter demo, disclose that you made it, and answer technical questions.
- Svelte community: https://www.reddit.com/r/sveltejs/
  Verify current self-promotion rules. Share the SvelteKit example and explain the
  browser-only custom-element registration and lifecycle cleanup.

## Small adoption experiment

Publish one demo in one relevant place. Spend the next few days helping users
integrate it. Record where users get stuck before building anything else.

Observe repository visitors and referrers, demo clicks, starter downloads where
measurement exists, and actual integration reports. npm downloads include CI and
bots; stars express interest and do not prove use. Do not infer conversions from
unrelated counts. There is no new visitor tracking in this release.

After ten real attempts, ask: did people understand the problem, get the example
running, and keep the package? If they did not, fix that specific failure. More
features and more landing pages are not the default answer.

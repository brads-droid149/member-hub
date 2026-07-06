Add the Tolt tracking script to the site's `index.html` `<head>` section.

Change:
- `index.html`

What to do:
- Insert the provided `<script async src="https://files.tlt-cdn.com/tlt.js" data-tolt="pk_2zaetezVjr4FoNdF3hrkxpPz"></script>` tag inside the existing `<head>` section, alongside the current scripts and metadata.
- Do not remove or modify any existing tags, JSON-LD blocks, or meta elements.

Why this location:
- This is a Vite React SPA; `index.html` is the shell loaded for every route, so the script must live here to load on every page rather than in a route-specific component.

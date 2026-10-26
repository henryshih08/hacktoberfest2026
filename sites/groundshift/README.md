# Groundshift hosting source

This Sites project publishes the Groundshift interface and its imagery API together. The API runs in a Cloudflare Worker; no API key is required.

- `public/`: the explorer, original case study, and assets.
- `app/route.ts`: the main HTML response.
- `app/api/[...path]/route.ts`: catalogue search, image rendering proxy, and original case study questions.
- `lib/groundshift/`: source catalogue and evidence logic shared with the local app.
- `.openai/hosting.json`: the hosted Site identity.

The existing root project remains the local development source. Before republishing frontend or catalogue changes, synchronize these files into this project and use the Sites source and publishing helpers.

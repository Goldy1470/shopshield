# ShopShield — the violations & account-health defense agent for TikTok Shop

A demo web app: a marketing landing plus the agent's console, built statically (no build step, no dependencies).

## What ships

- `index.html` — the landing: last-night's-watch panel, questions as rows (one opened to the appeal letter), pricing with monthly/annual switch, connection rows
- `app.html` — the console demo: a month of nights, the queue table, the case file with Approve / Edit / Reject, and four states in the URL (`?s=loading`, `?s=empty`, `?s=error`, full by default)
- `site.css` / `app.css` + `tokens.css` / `base.css` — the Dusk theme tokens and page styles
- `photos/` — the hero hour photograph

## Running it

Open `index.html` in a browser, or serve the folder:

```
python -m http.server 8000
```

## Demo data

Everything shown in the console (the queue, the tally, the letter) is demo data, marked in the top bar. No metrics, quotes or logos are invented anywhere on the pages; sample values read as samples.

## Credits

- Photograph: [Thomas Bresson](https://commons.wikimedia.org/wiki/File:Vallee-brouillard.jpg), CC BY 3.0, Wikimedia Commons
- Fonts: Wix Madefor Display / Text via Google Fonts
- Design process: built with the [Hallmark](https://github.com/nutlope/hallmark) skill (Dusk theme, draw `d4bd9c`)

**ShopShield is not affiliated with TikTok or ByteDance.**

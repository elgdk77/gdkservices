# gdkservices

Source for [gdkservices.co.uk](https://gdkservices.co.uk/), the single-page portfolio of Gavin Knowles: AI developer, IT support & infrastructure engineer and performance tester, based in Norwich, UK.

The site is static HTML, CSS and JavaScript served by a small Node server that also relays contact-form messages via [Postmark](https://postmarkapp.com/). It has no npm dependencies and no build step.

## What's on the page

- **Hero**: who I am and what I do
- **Work**: project cards for Services CRM, Prompt Improver and AgenticAI (Document Q&A)
- **Skills**: AI development, IT support & infrastructure, performance & quality testing, cloud & DevOps, operations & delivery
- **About**: experience, certifications and education
- **Contact**: a form that emails enquiries through Postmark

## Project structure

```
.
├── index.html          # The whole page, plus SEO, Open Graph and JSON-LD metadata
├── server.js           # Static file server and /api/contact endpoint
├── package.json        # Start script and Node version (no dependencies)
├── og-image.png        # 1200×630 social sharing image
├── robots.txt
└── assets/
    ├── site.css        # All styles
    ├── site.js         # Scroll and reveal animations (ES module)
    ├── fonts/          # Self-hosted Archivo and JetBrains Mono (woff2)
    ├── projects/       # SVG artwork for the project cards
    └── vendor/         # Motion 14.5.0, vendored
```

## Running locally

Requires **Node.js 18 or later** (the server uses the built-in `fetch`).

```bash
npm start
```

Then open <http://localhost:3000>. The page works without any configuration. The contact form returns "not configured yet" until the Postmark variables below are set.

## Configuration

Set these as environment variables. Never commit them.

| Variable | Required | Description |
| --- | --- | --- |
| `POSTMARK_SERVER_TOKEN` | For contact form | Postmark server API token |
| `CONTACT_FROM` | For contact form | A verified Postmark sender, e.g. `GDK Services <hello@yourdomain.com>` |
| `CONTACT_TO` | No | Where enquiries are delivered (defaults to the site owner's address) |
| `PORT` | No | Port to listen on (default `3000`; Railway sets it automatically) |

To try the form locally:

```bash
POSTMARK_SERVER_TOKEN=xxxx CONTACT_FROM="GDK Services <hello@yourdomain.com>" npm start
```

## How the server works

- **Allow-listed files only.** It serves `/`, `index.html`, `og-image.png`, `robots.txt` and anything under `/assets/`. Every other path returns 404, and path traversal out of `assets/` is blocked.
- **Caching and compression.** HTML is sent with `no-cache`; other assets are cached for a day. Text responses over 1 KB are Brotli- or gzip-compressed according to `Accept-Encoding`.
- **`POST /api/contact`** accepts JSON `{ name, email, message }` and:
  - rate-limits to 5 messages per IP per 10 minutes
  - silently drops submissions that fill in the hidden `website` honeypot field
  - validates the fields and trims them to sensible lengths
  - sends the email through Postmark with `Reply-To` set to the sender, so replies go straight back to them

## Deployment

The site is deployed on [Railway](https://railway.app/). Railway detects the Node app, runs `npm start` and provides `PORT`. Set `POSTMARK_SERVER_TOKEN`, `CONTACT_FROM` and, if needed, `CONTACT_TO` in the service's variables.

If the domain changes, update the canonical URL, `og:url`, `og:image` and JSON-LD `url` in the `<head>` of `index.html`.

## Design notes

- Fonts are self-hosted and preloaded, so there are no render-blocking third-party requests.
- Animations use the vendored Motion library. If the script fails to start within 2.5 seconds, a fallback class shows all content without animation.
- Includes a skip link and semantic headings for accessibility.

## Contact

- Website: <https://gdkservices.co.uk/>
- LinkedIn: <https://www.linkedin.com/in/gavin-knowles-a7ba4b8/>
- GitHub: <https://github.com/elgdk77/>

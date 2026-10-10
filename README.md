# Career Day UniBo 2026

**English** · [Italiano](README.it.md)

A dashboard I built to prepare my visit to the University of Bologna Career Day: explore **174 companies**, save favourites and plan a route on the stand map.

**[Open the dashboard](https://cometasensitiva.github.io/Career-Day-UniBo-2026/)**

![Dashboard with company filters and the stand map](docs/screenshots/dashboard-overview.png)

I built it for myself and later proposed it to the university. It is an independent student project. The dataset describes the **2026 event**, rather than current vacancies; company details and AI overviews should be checked against their sources.

## What it does

- Search and filter by industry, degree course and personal preferences.
- Save favourites, plan a stand route and export selected companies or a map image.
- Sync signed-in preferences with Firebase in the user's own node.
- Generate company overviews using a Gemini API key stored in the user's browser.

## Run locally

Requires **Node.js 20 or later** and **Python 3.11 or later**. From a clean clone:

```sh
git clone https://github.com/CometaSensitiva/Career-Day-UniBo-2026.git
cd Career-Day-UniBo-2026
npm ci
npm run build:tailwind
python3 -m http.server 8000
```

Open [localhost:8000](http://127.0.0.1:8000/). Firebase sign-in needs a domain authorized in the Firebase project; browsing the dataset does not require sign-in. The Gemini feature needs your own API key.

## Ideas

Update the dataset and stand map each year, preserving the previous edition. The [data update guide](docs/DATA_UPDATE_WORKFLOW.md) covers scraping, logos and validation. For a new event, prepare its stand map and check the source URL before running the updater:

```sh
python3 tools/update_dashboard.py --year 2027 --mapping-file tools/stand_map_2027.json --dry-run
```

The 2027 mapping file must be created first. A future edition could select the year in the dashboard, without changing the current GitHub Pages URL.

## Developers

```sh
npm run check:js
npm run check:py
npm run validate:data
```

CI also builds the CSS; Dependabot is configured. Some companies have no confirmed stand, email or HTTPS website. The validator reports these gaps.

[Documentation](docs/README.md) · [Architecture](docs/ARCHITECTURE.md) · [MIT license](LICENSE). Company logos, trademarks and source data retain their respective rights.

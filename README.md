# Financial Projection Dashboard

A polished client-side React + TypeScript app for guided wealth planning.

The flow is:

1. Enter name, current age, and projection end age.
2. Add income and expenses as either generic sums or itemized breakdowns.
3. Add inflation assumptions and future income, expense, and life events by age.
4. Add an investment portfolio by asset type, current value, expected return, recurring contribution, and dividend treatment.
5. Add asset allocation shifts, such as moving equities into bonds near retirement.
6. Review a main dashboard chart through age 100 showing income, dividend income, expenses plus investment contributions, investment value, and total assets.
7. Enable investment drawdowns to fund post-retirement cash deficits when free cash is exhausted.

Assets are defined as projected current investment values plus accumulated excess cash not invested after expenses.

## Run locally

```bash
npm install
npm run dev
```

## Build and test

```bash
npm test
npm run build
```

## Deployment packages

```bash
npm run package:deploy
```

This creates:

- `standalone.html` for a single-file local version
- `deploy/netlify` and `deploy/financial-projection-netlify.zip`
- `deploy/cloudflare-pages` and `deploy/financial-projection-cloudflare-pages.zip`

For Netlify, deploy the `deploy/netlify` folder or upload the zip. For Cloudflare Pages, upload the `deploy/cloudflare-pages` folder or zip as a static site.

The repository also includes root-level `netlify.toml` and `wrangler.toml` files for source-based deployments that run `npm run build`.

## GitHub Pages

The `docs/` folder contains a single-file static version for GitHub Pages.

To publish from GitHub:

1. Push this repository to GitHub.
2. Open repository `Settings > Pages`.
3. Set source to `Deploy from a branch`.
4. Choose branch `main` and folder `/docs`.
5. Save. The app will be available at the GitHub Pages URL shown on that page.

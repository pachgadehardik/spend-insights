# Spend Insights — local edition

A clean, empty edition of the spending dashboard. Statements are parsed in the browser; no statement-processing API, analytics or cloud chat is used. The current app source contains no private statement seed or Sites project identity. This existing repository remains private: its earlier Git history contains the original dashboard data. Removing files from the current version does not remove that history. Use a separate clean repository or a reviewed history-cleanup process before any public release.

## Run locally

With Node.js 22 or later:

```sh
git clone https://github.com/pachgadehardik/spend-insights.git
cd spend-insights
npm run dev
```

Open **http://127.0.0.1:4174**. Dependencies are already vendored in `dist`, so running the app does not require an install step. The server binds only to this computer's loopback address. Stop it with Ctrl+C.

The default screen offers two choices:

- **Use without saving:** financial data remains in this tab's memory. Closing or reloading loses it unless you download an encrypted backup.
- **Create encrypted vault:** save all analyses and category corrections encrypted in this browser. A passphrase of at least 12 characters is required. There is no recovery service or password reset.

The app locks on reload. Use **Lock vault** when leaving an unlocked tab; there is no automatic idle lock in this version. Other tabs have their own unlock state. Conflicting saves are rejected rather than silently overwriting another tab. Browser storage may be cleared or evicted, so keep encrypted backups.

## What works without AI

CSV, Excel, Numbers, text PDF, scanned PDF and clear statement photos can be parsed locally. English OCR is bundled. Match the columns, review rows, and optionally enter the debit total, credit total and transaction count printed on the statement. A mismatch blocks import. Categories, running-balance checks, exact totals, recurring candidates, monthly comparisons, search and the graph all work without a model.

INR is the only supported currency. Files are limited to 20 MB; PDFs to 100 pages, including at most 20 pages needing OCR. Unknown layouts can require manual correction or a CSV export. Handwriting and non-English OCR are not supported.

**All Indian banks are not verified.** The private prototype was tried with an ICICI statement; this edition is validated with synthetic formats. Real variations for ICICI, HDFC, SBI, Axis, Kotak and other banks still need a consented, preferably redacted fixture set and independent expected totals. Do not describe format recognition as bank certification.

## Optional EmbeddingGemma

The explorer uses fixed query plans and arithmetic, with evidence linked to transaction rows. It is not a general-purpose generative chatbot or an ownership/fraud inference engine.

Enabling semantic search explicitly downloads `onnx-community/embeddinggemma-2-ONNX` revision `daa72c51243991dfcaf9f9137d2c573d8f7790c0`. This integration uses its **text embeddings**, after normal PDF extraction or OCR. It does not feed statement images to the model.

Model/tokenizer files are about 207 MB. The local ONNX runtime adds about 26 MB. WebGPU is required. Browser RAM/GPU usage is greater than download size and has not been benchmarked across devices. Embeddings, questions and graph results stay in memory; public model weights can remain in the browser cache. Similarity produces candidate groups, not a confidence percentage or proof of a relationship. Users can remove irrelevant groups from an answer.

Transformers.js 4.3.1 is vendored. Both model calls and the remote URL template are pinned, because its tokenizer metadata probe otherwise defaults to `main`. The fetch wrapper permits only GET requests to the pinned model path. Runtime code is served from this app's own origin. Hosting and model providers can still see ordinary download access logs.

## Offline use

In **Privacy & offline**, select **Prepare offline access** while online. About 47 MB of fixed app, PDF, OCR and runtime files are cached. The UI confirms when installation finishes. Your browser may offer Install app / Add to Home Screen. This is an installable web app, not a packaged native binary.

Enable semantic search online once to cache its separate model files before trying it offline. Core analysis needs no model. A new service worker waits for all older app tabs to close before activating, to avoid replacing code during a session. Clearing browser caches can remove offline availability.

The service worker caches an explicit list of public assets. It never caches statement files, exports, vaults, query URLs or arbitrary responses. Rebuild its manifest after changing `dist`:

```sh
npm run build
```

## Storage and security boundaries

The encrypted record is in IndexedDB `spend-insights-private-v1`, store `vaults`. It contains a revision number and an AES-GCM-256 envelope, with a random 16-byte salt and a fresh random 12-byte IV per save. PBKDF2-SHA256 uses 600,000 iterations. KDF metadata is authenticated, keys are nonextractable WebCrypto keys kept in memory, and encrypted backups have a bounded, versioned format. Saves are serialized; IndexedDB revision checks prevent stale writers and deleted-vault resurrection.

Raw statements and PDF passwords are not saved. The vault includes parsed transactions, source names, account labels, independent-check results, analysis names and category rules. Questions and derived embeddings are never persisted. **Encrypted `.sivault` backups are the default. CSV and graph JSON exports are unencrypted.** Legacy single-analysis JSON backups can be imported locally.

Locking clears the active UI and application references, cancels imports and terminates the semantic worker. It is not a promise of forensic memory erasure. Vault deletion removes the browser record; existing file exports, system backups and other browser profiles are separate. Malicious extensions, compromised app code or an untrusted device can access data while it is unlocked. This version has functional privacy tests, not an independent security audit.

The local server supplies a Content Security Policy, no-referrer policy and nosniff header. A future static host must preserve equivalent headers (especially `frame-ancestors`, which cannot be supplied through the HTML meta policy), HTTPS and same-origin runtime assets. There is no backend requirement.

## Tests

```sh
npm test
npm run build
```

The unit suites cover authenticated encryption, tampering, wrong passwords, IV uniqueness, save ordering, conflicts, failed writes, deletion races, synthetic INR layouts, PDF geometry, independent totals and graph/query evidence.

Browser suites use Playwright and Chrome, against the server above. Install Playwright in a separate QA directory or provide its module path:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/browser.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/model-browser.mjs
```

Set `CHROME_PATH` for another Chrome installation. The model test downloads real public weights and uses a persistent synthetic QA profile under `/tmp/spend-local-model-profile`. Test fixtures contain synthetic transactions only. See `LOCAL-VALIDATION.md` for the results and outstanding publication work.

This edition is maintained in the existing private GitHub repository. Updating the repository is separate from publishing the website; the deployed Sites version is unchanged by this update.

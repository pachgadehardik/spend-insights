# Spend Insights

An owner-private statement explorer. It supports local Numbers, Excel, CSV, TSV, text PDFs, scanned PDFs and clear JPG/PNG/WebP statement photos. The current release assumes INR and English printed transaction tables. Unknown layouts, poor scans, handwriting and other currencies are not universally supported; users review column mappings, source totals, warnings and OCR output before importing.

The original private dataset retains its existing storage key and 1,589 transactions. New analyses start empty and use independent browser-storage keys; switching analyses preserves each dataset, category overrides and merchant rules. JSON backup/restore acts on the current analysis. This remains the owner's private site, not a public multi-user service.

All processing stays in the browser. PDF.js 6.4.299 extracts selectable text and renders scanned pages; Tesseract.js 7.0.0 runs OCR using vendored English recognition assets. There are no runtime external analytics, OCR endpoints or model APIs. Limits: 20 MB per file, 100 PDF pages, 20 OCR pages, 8 million rendered pixels per page. Recognition needs review even when balances reconcile. Common references and UPI addresses are masked where detected; sanitized transactions still contain private financial information.

`core.mjs` owns normalization, conservative category suggestions, duplicate detection and reconciliation. Malformed transaction rows remain visible as errors; the raw extraction table is editable. Debits/credits, ambiguous dates, conflicting direction flags and duplicate column mappings are checked. The original data and fingerprints remain compatible. Bank and card activity remain distinct, and card settlements are not treated as purchases.

`explorer.mjs` derives account → category → merchant relationships from effective transactions. Nodes and links retain supporting transaction IDs and source rows/pages. Selected nodes open evidence; question chips, search, account/date/category filters and direction controls change the view. Exports include the complete matching graph, including nodes hidden by visual caps. This is deterministic statement analysis; no embeddings model is loaded and similarity is not treated as a verified relationship.

Run `npm test` for parser fixtures, source totals, UI controllers, graph evidence and geometry extraction. Optional `STATEMENT_FILE` enables the original Numbers-file check. Local Chrome QA covers synthetic multi-page text PDF, scanned PDF and photo extraction, raw-table correction, review acknowledgement, duplicate retention, graph export, workspace isolation/reload and responsive layouts. Synthetic fixtures validate supported table shapes, not every bank's statement format.

The existing card planner is an editable scenario. Bank descriptions do not establish issuer category codes, card acceptance or reward eligibility.

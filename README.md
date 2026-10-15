# Spend Insights

A static, owner-private spending dashboard with local Numbers, Excel, CSV and TSV imports. Initial data contains 1,589 transactions from the supplied statement; account identifiers and UPI addresses are removed from narrations. Financial amounts and merchant labels remain personal data. Preserve owner-private access.

The source statement is not included. `dist/seed.json` is the initial normalized dataset. Later imports, edits and merchant rules remain in browser local storage. JSON backup moves that state between browsers. There is no statement-upload server or external analytics. All app assets, including SheetJS CE 0.20.3, are vendored.

`core.mjs` owns parsing, classification, aggregation, reconciliation and deduplication. Categories are suggested and editable. Cash-flow totals include bank-account transactions; credit-card statements contribute to identified purchase totals but not bank cash flow. Settlements, transfers, property payments, investments and cash withdrawals are not assumed to be consumption. Refunds remain gross credits rather than being matched to purchases automatically.

Bank narratives cannot establish card acceptance, issuer merchant-category codes or fee-waiver eligibility. The planner is an editable scenario, not a guaranteed reward or eligibility calculation. Generic PDF ingestion is outside this version; use exported CSV or Excel instead.

Run `npm test`. Set `STATEMENT_FILE` to the supplied Numbers file for the optional original-file import test. Tests use a DOM harness; visual browser QA was unavailable in the managed environment.

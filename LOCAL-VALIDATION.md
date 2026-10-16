# Local validation — 16 October 2026

These checks validated the local edition before its update to the existing private GitHub repository. The original local private checkout remains separate; publication uses the tested local edition. The repository retains its prior history and must remain private unless that history is separately addressed.

## Passed

- Unit suites: vault crypto/authentication; ordered snapshot saves; conflict detection; simulated quota failure; lock/delete races; synthetic INR header/date/sign formats; PDF column geometry, repeated headers and wrapped narrations; independent statement totals/counts; query arithmetic and graph evidence.
- 20 browser checkpoints in desktop Chrome: empty start without seed data; mandatory review and mismatch blocking; credit query; temporary storage privacy; encrypted backup; temporary-session reload; wrong-password restoration; ciphertext-only financial storage; locking; multiple analyses; locked reload; save failure; complete offline setup; app-only asset cache; offline text PDF, scanned PDF and photo OCR; import cancellation; real IndexedDB stale-write rejection; vault deletion; network payload checks.
- Responsive explorer at 390, 768, 1280 and 1600 pixels. No document horizontal overflow in those checks.
- The browser suite recorded 361 asset GET requests and no canary statement/query payload in request URLs or bodies. It reported no page errors.
- Synthetic OCR fixtures imported three rows with debit total ₹200 and credit total ₹5,000 with the network disabled.
- The original private checkout remains clean.
- The in-app browser preview was prepared for offline access and successfully reloaded after the local server was stopped. Its cached app remains available in that browser; use `npm run dev` to serve it to a different browser or to load code updates.

## Real model check

The real pinned EmbeddingGemma 2 model completed warm-up and semantic retrieval online, then repeated the same retrieval after a page reload with the browser network disabled. Both runs selected Swiggy and Zomato from a five-row synthetic statement, totaling ₹375, and exposed the supporting rows. No canary description or query appeared in outgoing request URLs or bodies; all 288 recorded requests were asset GETs, with no page errors.

The successful run used model weights cached during setup: approximately 2.1 seconds to enable online and 1.0 second to enable offline; the five-row semantic query took about 147 ms and 127 ms respectively. These are observations on this machine, not general device benchmarks or first-download timings. The first model download took several minutes. Memory consumption was not measured.

The ONNX runtime requires its asyncify variant. That exact vendored variant is now included in the offline asset manifest, and the model test confirmed its offline loading.

## Remaining before a public release

- Collect consented/redacted real statement fixtures across Indian banks, account types, export versions, protected PDFs and poor-quality scans. Independently verify expected row counts and amounts. Format tests do not establish universal bank support.
- Test on intended mobile devices, Safari/Firefox, storage-restricted browsers and low-memory hardware. WebGPU capability and model performance vary.
- Review dependency/model licensing, hosting headers and update trust. Arrange an independent security review if promising strong financial-data protection.
- Choose the eventual static host and create a clean public repository if desired. Do not expose the existing private repository history or personal seed.

This report describes functional tests, not a security certification or proof that every network/browser configuration behaves identically.

## Hosting preparation

The 25.6 MiB WASM runtime is delivered as two assets below the host’s 25 MiB per-file limit. The browser reconstructs and verifies the original binary with SHA-256. Unit checks cover corrupt/missing parts and exact reconstruction. The real model browser test passed again online and offline with the split runtime (₹375 from the same two synthetic merchants), with no canary data in network URLs or bodies. Static security headers mirror the local server; hosting control files are excluded from the offline asset list.

# Office Editing Rules

1. Word, PowerPoint, PDF, and scanned documents must go through `vc-office-core`.
2. `office_patch` must use `block_id` from a `DocumentObject`.
3. JSON `DocumentObject` is the patch source of truth.
4. Markdown projection is for reading and recall, not patch targeting.
5. OCR text is not editable source text.
6. Edited Office files must be written to `.pi-vc/output/`.
7. Diffs must be written to `.pi-vc/diff/`.
8. Provider failures should return clear warnings.

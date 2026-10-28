# Space — Chrome Web Store kit

Version **1.21.0** · English/Russian interface · English listing · prepared October 27, 2026.

## Upload files

| Purpose | File inside this kit |
|---|---|
| Extension package | `upload/space-1.21.0.zip` |
| Store icon, 128×128 | `assets/icon-128.png` |
| Small promotional tile, 440×280 | `assets/promo-small-440x280.png` |
| Marquee promotional tile, 1400×560 | `assets/promo-marquee-1400x560.png` |
| Listing name and descriptions | `listing.en.txt` or `listing.json` |
| Purpose, permissions, data handling, review steps | `review-notes.en.md` |
| Privacy page for public hosting | `privacy/index.html` and `privacy/privacy.css` |
| Interface preview PNGs, 1280×800 | `screenshots/global/*.png` |
| Preview provenance and actual capture plan | `screenshots/README.md` |
| Editable artwork | `source/*.svg` |

`screenshots/global/` contains three clearly labeled interface illustrations with example data, also displayed in the repository README. They are not captures of a running Chrome window.

`assets/preview.jpg` is a review sheet, not a store screenshot. The promotional tiles use schematic illustrations of the product, not captured Chrome UI.

Choose **English** as the listing language and **Functionality & UI** as the category. Use your real publisher identity and support details in the dashboard.

## Before submitting

1. Capture at least one actual screenshot of the current installed extension. The screenshot plan describes three useful views. Do not substitute the promotional illustrations for screenshots.
2. Host `privacy/` at a public HTTPS URL and enter that address in the dashboard's Privacy policy field. The packaged in-extension page is available from Panel settings → Privacy, but its extension-local address cannot serve as the public URL.
3. Complete the publisher, data-use, and permission fields using the factual notes in `review-notes.en.md`. The privacy page currently directs support questions to the extension's store support section; replace that with your real support details if appropriate.
4. Upload the **inner extension ZIP**, not the complete artwork kit. Its `manifest.json` is at the archive root. Test files, tools, developer docs, artwork, and old releases are excluded.

Before moving from an unpacked installation to the store version, export a JSON backup from Space, then import it into the new installation.

## Rebuilding from the project

Run `npm run verify` to check source syntax, resource paths, translations, tests, and packaging. Run `npm run package` to rebuild the extension ZIP, this kit, listing metadata, and hashes. Generated files are written to `release/`; earlier releases are kept under `release/archive/`.

Runtime code and the canonical privacy page live in `src/`. The build copies the privacy page into this handoff without keeping a second editable source. Artwork can be regenerated using `scripts/render-store-assets.py` with Pillow and system Arial fonts; SVG sources can also be edited independently.

Publishing and store approval have not been performed. Current-version real screenshots and a public privacy-policy URL are still required. Existing Chrome computer-use access was previously denied; no workaround was used to capture that installation.

## Official references

- [Listing fields and graphics](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Image dimensions and guidance](https://developer.chrome.com/docs/webstore/images)
- [Categories](https://developer.chrome.com/docs/webstore/best-practices)
- [Privacy fields and permission justifications](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/)
- [User-data disclosure, including local processing](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

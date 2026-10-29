# Fonts

Two families ship with the game, self-hosted so no page reaches out to a
font CDN at runtime:

| Family | Files | Licence |
|---|---|---|
| Figtree | `figtree-v9-*.woff2` | SIL Open Font License 1.1 — `OFL-Figtree.txt` |
| Fraunces | `fraunces-v38-*.woff2` | SIL Open Font License 1.1 — `OFL-Fraunces.txt` |

The OFL requires its text to travel with the fonts, so both licence files
are part of the shipped tree (`docs/fonts/`, which the native shell copies
into `shell/www/fonts/`). Do not remove them, and if a family is ever
replaced, replace its licence file in the same commit.

`fonts.css` declares the faces; nothing else should `@import` a font.

// SQL predicate for AdLibraryBrand rows that are scam-shop or app networks, not
// brands: truncated word + junk suffix (Britainuk72, Haustechn.K, Scotlanduk/T,
// Applicabley.AB05), numbered clones (Ns-XK-48, DramaBox-new drama&movies15) and
// Meta's own page. Left in, they fill every "most active" and "new accounts" list.
//
// Sample-checked 2026-10-20: 1,913 of 28,222 brands match, a random 80 were all
// network pages, and ~60 real names pass (IM8, AG1, OKQ8, H&M, Check24,
// ImmoScout24, Harald Nyborg A/S, Lyko.se, Halara_UK). Known miss: "Studio-54"
// style names would be hidden.
// ponytail: name heuristic; it can't see personas or advertorial pages
// ("Grace McNulty Matos"). Upgrade to a hand-curated hidden flag on
// AdLibraryBrand if the lists have to be spotless.
export const JUNK_BRAND_SQL = String.raw`(
  "pageName" ~ '[A-Za-z][%=+#][A-Za-z0-9]'
  OR "pageName" ~ '[A-Za-z]{4,}/'
  OR "pageName" ~ '&[0-9]'
  OR ("pageName" ~ '^[A-Z]?[a-z]{4,}[0-9]+[a-z]{0,2}$' AND "pageName" !~ '24$')
  OR "pageName" ~ '^[A-Za-z]+\.([A-Z]{1,2}[0-9]*|[a-z]|[0-9]{1,2})$'
  OR "pageName" ~ '^[A-Za-z]+[-_][a-z0-9]{1,2}$'
  OR "pageName" ~ '^[A-Za-z]+_[A-Z]$'
  OR "pageName" ~ '^[A-Za-z]+ [a-z]{1,2}$'
  OR "pageName" ~ '^[A-Za-z]{9,} [A-Z]$'
  OR "pageName" ~ '-[A-Z]?[0-9]{2,3}$'
  OR "pageName" ~* '^(britainuk|scotlanduk|londonuk|haustechn|fotostudi|energieef|fahrplanx|dussedorf|kaioticket|applicabley)'
  OR "pageName" ~* 'mindsparkl|dramabox'
  OR "pageName" ~* '^meta for business$'
)`;

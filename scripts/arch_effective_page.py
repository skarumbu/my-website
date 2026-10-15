"""Python reimplementation of the architecture wiki's template merge.

Mirrors ``resolvePage()`` in ``src/architecture/PageDetail.tsx`` exactly: it
merges a per-page AI overlay (``src/architecture-pages.json``) with the static
package template and repo URL exported to
``src/architecture/arch-templates.generated.json`` by
``scripts/export-arch-templates.mjs``, and resolves reverse ``relatedPages``
links across the whole page set.

``scripts/backfill_arch_history.py`` imports this module so the effective-page
JSON stored in history-api is byte-identical to what the TS produced;
``.github/scripts/wiki_update_pr.py`` (the pipeline) will import it too once
step 4 of the migration lands. The cross-language contract is pinned by
``scripts/tests/test_arch_effective_page.py`` against fixtures generated from
the TS side by ``scripts/gen-arch-fixtures.mjs``.

Field-merge rules reproduced from resolvePage(). TS ``??`` is nullish
coalescing (falls through on a key that is absent *or* explicitly ``null``).
The overlay-only passthrough fields use plain assignment (``gen?.x``), which
``JSON.stringify`` drops only when ``undefined`` (key absent) and keeps when
``null`` -- so those use a presence check, not a null check.

  key            always ``<page-key>``
  title          overlay.title ?? template.title ?? page-key      (always present)
  role           overlay.role ?? template.role                    (omitted if nullish)
  summary        overlay.summary        present-in-overlay -> value (kept even if null)
  description    overlay.description ?? template.description ?? "" (always present)
  features       overlay.features ?? template.features            (omitted if nullish)
  architecture   overlay.architecture non-null -> {**template.architecture, **overlay.architecture};
                 else template.architecture                       (omitted if nullish)
  sections       overlay.sections       present-in-overlay -> value (kept even if null)
  relatedPages   unique(forward ++ reverse) minus self            (always present, may be [])
  updatedAt / updatedBySha / updatedByPackage
                 overlay.<field>        present-in-overlay -> value (kept even if null)

  # only when a template exists for the key (i.e. it is a PackagePage):
  runsOn         template.runsOn
  repoUrl        repoUrlByPackage[key] ?? ""
  techStack      template.techStack
  pipeline       template.pipeline
  dataFlow       "dataFlow" present in overlay -> overlay.dataFlow ?? template.dataFlow
                 else template.dataFlow                           (omitted if nullish)

Keys resolved via ``??`` are omitted when their value is nullish; the
passthrough fields above are omitted only when absent from the overlay
(an explicit ``null`` is preserved), matching ``JSON.stringify``.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

_DEFAULT_TEMPLATES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src",
    "architecture",
    "arch-templates.generated.json",
)


def load_templates(path: Optional[str] = None) -> dict:
    """Load the machine-readable template export.

    Returns ``{"packageTemplates": {...}, "repoUrlByPackage": {...}}`` — the
    shape written by ``scripts/export-arch-templates.mjs``.
    """
    with open(path or _DEFAULT_TEMPLATES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    if "packageTemplates" not in data or "repoUrlByPackage" not in data:
        raise ValueError(
            "arch-templates.generated.json missing packageTemplates / repoUrlByPackage"
        )
    return data


def _nn(value: Any, fallback: Any) -> Any:
    """TS ``??`` — return ``value`` unless it is nullish (``None``)."""
    return value if value is not None else fallback


def build_reverse_related(all_overlays: dict) -> dict:
    """Reverse ``relatedPages`` map: if overlay A lists B, then B -> [.., A].

    Insertion order follows ``all_overlays`` iteration order (the JSON file's
    key order), matching ``Object.entries(generated)`` in the TS. Values are
    de-duplicated, first occurrence wins.
    """
    reverse: dict[str, list[str]] = {}
    for key, overlay in all_overlays.items():
        for other in (overlay or {}).get("relatedPages") or []:
            bucket = reverse.setdefault(other, [])
            if key not in bucket:
                bucket.append(key)
    return reverse


def _resolve_related(key: str, forward: list, reverse: list) -> list:
    seen: set = set()
    out: list = []
    for k in list(forward) + list(reverse):
        if k == key or k in seen:
            continue
        seen.add(k)
        out.append(k)
    return out


def build_effective_page(
    key: str,
    overlay: Optional[dict],
    all_overlays: dict,
    templates: dict,
) -> Optional[dict]:
    """Reproduce ``resolvePage(key)``.

    ``overlay`` is ``all_overlays.get(key)`` (may be ``None``). Returns ``None``
    only when neither a template nor an overlay exists for ``key`` -- mirroring
    TS ``if (!template && !gen)``, where an empty-object overlay (``{}``) is
    truthy and therefore still yields a page. Every key fed from
    ``architecture-pages.json`` has an overlay.
    """
    package_templates = templates["packageTemplates"]
    repo_urls = templates["repoUrlByPackage"]

    template = package_templates.get(key)
    gen = overlay or {}
    if template is None and overlay is None:
        return None

    reverse = build_reverse_related(all_overlays)
    related_pages = _resolve_related(
        key,
        _nn(gen.get("relatedPages"), []),
        reverse.get(key, []),
    )

    tmpl = template or {}
    page: dict[str, Any] = {"key": key}

    page["title"] = _nn(gen.get("title"), _nn(tmpl.get("title"), key))

    role = _nn(gen.get("role"), tmpl.get("role"))
    if role is not None:
        page["role"] = role

    if "summary" in gen:
        page["summary"] = gen["summary"]

    page["description"] = _nn(gen.get("description"), _nn(tmpl.get("description"), ""))

    features = _nn(gen.get("features"), tmpl.get("features"))
    if features is not None:
        page["features"] = features

    gen_arch = gen.get("architecture")
    if gen_arch is not None:
        merged = dict(tmpl.get("architecture") or {})
        merged.update(gen_arch)
        page["architecture"] = merged
    elif tmpl.get("architecture") is not None:
        page["architecture"] = tmpl["architecture"]

    if "sections" in gen:
        page["sections"] = gen["sections"]

    page["relatedPages"] = related_pages

    for field in ("updatedAt", "updatedBySha", "updatedByPackage"):
        if field in gen:
            page[field] = gen[field]

    if template is None:
        return page

    page["runsOn"] = tmpl["runsOn"]
    page["repoUrl"] = _nn(repo_urls.get(key), "")
    page["techStack"] = tmpl["techStack"]
    page["pipeline"] = tmpl["pipeline"]

    if "dataFlow" in gen:
        data_flow = _nn(gen["dataFlow"], tmpl.get("dataFlow"))
    else:
        data_flow = tmpl.get("dataFlow")
    if data_flow is not None:
        page["dataFlow"] = data_flow

    return page


def effective_page_for_key(key: str, all_overlays: dict, templates: dict) -> Optional[dict]:
    """Convenience wrapper: ``build_effective_page`` with the overlay looked up."""
    return build_effective_page(key, all_overlays.get(key), all_overlays, templates)


def to_canonical_json(page: dict) -> str:
    """Canonical serialization, byte-identical to scripts/lib/canonical-json.mjs:
    sorted keys, 2-space indent, non-ASCII raw, one trailing newline.
    """
    return json.dumps(page, indent=2, sort_keys=True, ensure_ascii=False) + "\n"

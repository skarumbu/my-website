"""Unit tests for the template-merge logic (build_effective_page /
build_reverse_related). All fixtures here are synthetic — there is no
git-tracked overlay file to pin against anymore (see the architecture-wiki ->
history-api migration's "step 7": the overlay and legacy-history files were
removed once every page had a real history-api version; the wiki_update_pr.py
pipeline now patches content fetched live from history-api instead). This
module still matters because a brand-new page (no history-api entry yet)
still goes through this exact template merge, using the AI-generated patch as
its initial overlay.
"""

import pytest

from arch_effective_page import (
    build_effective_page,
    build_reverse_related,
    load_templates,
    to_canonical_json,
)


@pytest.fixture(scope="module")
def templates():
    return load_templates()


def test_missing_key_returns_none(templates):
    assert build_effective_page("no-such-page", None, {}, templates) is None


def test_empty_overlay_still_yields_a_page(templates):
    # TS: `if (!template && !gen) return null` — {} is truthy in JS, so an
    # empty-object overlay with no template still resolves to a page, with no
    # package-only fields present.
    overlays = {"bare": {}}
    page = build_effective_page("bare", {}, overlays, templates)
    assert page is not None
    assert page["key"] == "bare"
    assert page["title"] == "bare"          # falls back to the key
    assert page["description"] == ""        # falls back to ""
    assert page["relatedPages"] == []
    for pkg_field in ("runsOn", "repoUrl", "techStack", "pipeline", "dataFlow"):
        assert pkg_field not in page


def test_explicit_null_passthrough_field_is_kept():
    # Passthrough fields (summary/sections/updatedAt/updatedBySha/updatedByPackage)
    # use gen?.x in the TS: JSON.stringify keeps an explicit null, drops only
    # undefined. So an overlay "summary": null must survive as "summary": null.
    templates = {"packageTemplates": {}, "repoUrlByPackage": {}}
    overlays = {
        "p": {
            "summary": None,
            "sections": None,
            "updatedAt": None,
            "updatedBySha": None,
            "updatedByPackage": None,
            "description": "d",
        }
    }
    page = build_effective_page("p", overlays["p"], overlays, templates)
    for field in ("summary", "sections", "updatedAt", "updatedBySha", "updatedByPackage"):
        assert field in page and page[field] is None
    assert '"summary": null' in to_canonical_json(page)


def test_absent_passthrough_field_is_omitted():
    templates = {"packageTemplates": {}, "repoUrlByPackage": {}}
    overlays = {"p": {"description": "d"}}
    page = build_effective_page("p", overlays["p"], overlays, templates)
    for field in ("summary", "sections", "updatedAt", "updatedBySha", "updatedByPackage"):
        assert field not in page


def test_null_role_and_features_fall_through_to_template():
    # role / features use ?? in the TS (not passthrough): explicit null -> template.
    templates = {
        "packageTemplates": {
            "svc": {
                "title": "t",
                "role": "template-role",
                "runsOn": "Azure Functions",
                "description": "td",
                "features": ["tf"],
                "techStack": ["Python"],
                "pipeline": [{"label": "x"}],
            }
        },
        "repoUrlByPackage": {},
    }
    overlays = {"svc": {"role": None, "features": None}}
    page = build_effective_page("svc", overlays["svc"], overlays, templates)
    assert page["role"] == "template-role"
    assert page["features"] == ["tf"]


def test_dataflow_null_in_overlay_with_no_template_dataflow_drops_key():
    # dataFlow's presence check differs from ??: "dataFlow" in gen -> use
    # gen.dataFlow ?? template.dataFlow; if that's also nullish, drop the key
    # entirely (mirrors JSON.stringify dropping undefined, not emitting null).
    templates = {
        "packageTemplates": {"svc": {
            "title": "t", "runsOn": "x", "description": "d",
            "techStack": [], "pipeline": [],
        }},
        "repoUrlByPackage": {},
    }
    overlays = {"svc": {"dataFlow": None}}
    page = build_effective_page("svc", overlays["svc"], overlays, templates)
    assert "dataFlow" not in page


def test_synthetic_merge_precedence():
    templates = {
        "packageTemplates": {
            "svc": {
                "title": "svc-template-title",
                "role": "template-role",
                "runsOn": "Azure Functions",
                "description": "template description",
                "features": ["template-feature"],
                "architecture": {"overview": "t-overview", "keyPoints": ["t-kp"]},
                "techStack": ["Python"],
                "pipeline": [{"label": "deploy"}],
                "dataFlow": [{"label": "t-flow"}],
            }
        },
        "repoUrlByPackage": {"svc": "https://example.com/svc"},
    }
    overlays = {
        "svc": {
            "summary": "overlay summary",
            "description": "overlay description",
            "architecture": {"overview": "o-overview"},
            "relatedPages": ["topic"],
        },
        "topic": {"title": "Topic", "description": "a topic"},
    }

    svc = build_effective_page("svc", overlays["svc"], overlays, templates)
    # overlay wins where present, template fills the rest
    assert svc["description"] == "overlay description"
    assert svc["summary"] == "overlay summary"
    assert svc["title"] == "svc-template-title"  # no overlay title -> template
    assert svc["role"] == "template-role"
    assert svc["features"] == ["template-feature"]
    # architecture: shallow merge, overlay keys override
    assert svc["architecture"] == {"overview": "o-overview", "keyPoints": ["t-kp"]}
    # dataFlow: overlay has no dataFlow key -> template value
    assert svc["dataFlow"] == [{"label": "t-flow"}]
    assert svc["repoUrl"] == "https://example.com/svc"
    # package-only fields present on a page with a template
    assert svc["runsOn"] == "Azure Functions"
    assert isinstance(svc["techStack"], list) and svc["techStack"]
    assert isinstance(svc["pipeline"], list) and svc["pipeline"]

    # reverse link resolved, symmetric in both directions
    topic = build_effective_page("topic", overlays["topic"], overlays, templates)
    assert topic["relatedPages"] == ["svc"]
    assert svc["relatedPages"] == ["topic"]
    # a cross-cutting page (no template) carries no package-only fields
    for pkg_field in ("runsOn", "repoUrl", "techStack", "pipeline", "dataFlow"):
        assert pkg_field not in topic

    # canonical serialization must not raise for either shape
    to_canonical_json(svc)
    to_canonical_json(topic)


def test_reverse_related_dedups_and_preserves_order():
    overlays = {
        "a": {"relatedPages": ["c"]},
        "b": {"relatedPages": ["c", "c"]},
        "c": {},
    }
    reverse = build_reverse_related(overlays)
    assert reverse["c"] == ["a", "b"]

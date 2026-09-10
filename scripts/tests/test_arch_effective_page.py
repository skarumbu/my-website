"""Cross-language contract: build_effective_page() must reproduce the TS
resolvePage() byte-for-byte.

The fixtures in scripts/fixtures/*.effective.json are generated from the TS
side by `node scripts/gen-arch-fixtures.mjs`. If resolvePage(), the templates,
or the pinned overlays change, regenerate them and eyeball the diff.
"""

import json
import os

import pytest

from arch_effective_page import (
    build_effective_page,
    build_reverse_related,
    effective_page_for_key,
    load_templates,
    to_canonical_json,
)

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_OVERLAYS_PATH = os.path.join(_REPO_ROOT, "src", "architecture-pages.json")
_FIXTURE_DIR = os.path.join(_REPO_ROOT, "scripts", "fixtures")

# Keep in sync with PINNED_KEYS in scripts/gen-arch-fixtures.mjs:
#   posts-api      service page with reverse relatedPages links
#   authentication cross-cutting page, no template
#   my-website     overlay sets "dataFlow": null and template has none -> key omitted
PINNED_KEYS = ["posts-api", "authentication", "my-website"]


@pytest.fixture(scope="module")
def overlays():
    with open(_OVERLAYS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def templates():
    return load_templates()


@pytest.mark.parametrize("key", PINNED_KEYS)
def test_effective_page_matches_ts_fixture(key, overlays, templates):
    fixture_path = os.path.join(_FIXTURE_DIR, f"{key}.effective.json")
    with open(fixture_path, "r", encoding="utf-8") as f:
        expected = f.read()

    page = effective_page_for_key(key, overlays, templates)
    actual = to_canonical_json(page)

    assert actual == expected, (
        f"{key}: Python effective page diverged from the TS-derived fixture. "
        f"If resolvePage/templates/overlays changed, run "
        f"`node scripts/gen-arch-fixtures.mjs` and review the diff."
    )


def test_all_current_pages_build_without_error(overlays, templates):
    for key in overlays:
        page = effective_page_for_key(key, overlays, templates)
        assert page is not None
        assert page["key"] == key
        assert "relatedPages" in page  # always present, even when empty
        # canonical serialization must not raise
        to_canonical_json(page)


def test_reverse_related_links_are_symmetric(overlays, templates):
    # authentication lists posts-api; posts-api's effective page must link back.
    auth = effective_page_for_key("authentication", overlays, templates)
    assert "posts-api" in auth["relatedPages"]
    posts = effective_page_for_key("posts-api", overlays, templates)
    assert "authentication" in posts["relatedPages"]


def test_service_page_gets_template_fields(overlays, templates):
    page = effective_page_for_key("digits", overlays, templates)
    assert page["runsOn"] == "Azure Functions"
    assert page["repoUrl"] == "https://github.com/skarumbu/digits"
    assert isinstance(page["techStack"], list) and page["techStack"]
    assert isinstance(page["pipeline"], list) and page["pipeline"]


def test_cross_cutting_page_has_no_package_fields(overlays, templates):
    page = effective_page_for_key("authentication", overlays, templates)
    for pkg_field in ("runsOn", "repoUrl", "techStack", "pipeline", "dataFlow"):
        assert pkg_field not in page


def test_null_overlay_datastream_drops_key(overlays, templates):
    # my-website overlay: "dataFlow": null, and the my-website template has no
    # dataFlow -> the key must be absent (mirrors JSON.stringify dropping undefined).
    page = effective_page_for_key("my-website", overlays, templates)
    assert "dataFlow" not in page


def test_missing_key_returns_none(overlays, templates):
    assert build_effective_page("no-such-page", None, overlays, templates) is None


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

    # reverse link resolved
    topic = build_effective_page("topic", overlays["topic"], overlays, templates)
    assert topic["relatedPages"] == ["svc"]
    assert svc["relatedPages"] == ["topic"]


def test_reverse_related_dedups_and_preserves_order():
    overlays = {
        "a": {"relatedPages": ["c"]},
        "b": {"relatedPages": ["c", "c"]},
        "c": {},
    }
    reverse = build_reverse_related(overlays)
    assert reverse["c"] == ["a", "b"]

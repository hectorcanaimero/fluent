import json
from pathlib import Path

import pytest

from app.prepare.language import looks_english

VECTORS = json.loads(
    (Path(__file__).resolve().parents[3] / "testdata" / "english-vectors.json").read_text()
)


@pytest.mark.parametrize("text", VECTORS["english"])
def test_english_is_accepted(text: str) -> None:
    assert looks_english(text)


@pytest.mark.parametrize("text", VECTORS["not_english"])
def test_portuguese_and_spanish_are_rejected(text: str) -> None:
    assert not looks_english(text)

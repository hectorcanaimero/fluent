"""Fábrica del modelo Agno contra 9router (I4)."""

import os

from agno.models.openai import OpenAILike

DEFAULT_INTERVIEW_MODEL = "fluent-pro"


def build_model() -> OpenAILike:
    base_url = os.environ["NINEROUTER_URL"]
    api_key = os.environ["NINEROUTER_API_KEY"]
    model_id = os.environ.get("INTERVIEW_MODEL", DEFAULT_INTERVIEW_MODEL)
    return OpenAILike(id=model_id, api_key=api_key, base_url=base_url)

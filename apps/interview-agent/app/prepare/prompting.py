"""Delimitación de datos no confiables en los prompts."""

import re

# Cualquier apertura/cierre que imite nuestras etiquetas, sin importar mayúsculas ni espacios
# (p. ej. "</UNTRUSTED_OFFER >", "< / untrusted_offer>", "</previous_questions>").
_FAKE_TAG = re.compile(r"<(\s*/?\s*(?:untrusted_|previous_questions))", re.IGNORECASE)


def untrusted(name: str, text: str) -> str:
    """Envuelve `text` en <untrusted_NAME>; neutraliza etiquetas falsas dentro del texto."""
    tag = f"untrusted_{name}"
    safe = _FAKE_TAG.sub(r"&lt;\1", text)
    return f"<{tag}>\n{safe}\n</{tag}>"

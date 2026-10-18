"""Delimitación de datos no confiables en los prompts."""


def untrusted(name: str, text: str) -> str:
    """Envuelve `text` en <untrusted_NAME>; neutraliza cierres falsos dentro del texto."""
    tag = f"untrusted_{name}"
    safe = text.replace("<untrusted_", "&lt;untrusted_").replace("</untrusted_", "&lt;/untrusted_")
    return f"<{tag}>\n{safe}\n</{tag}>"

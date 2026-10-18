"""Guardia de idioma: Fluent es para practicar inglés, así que lo que el modelo dice o
pregunta tiene que estar en inglés aunque la oferta venga en portugués o español.

Heurística sin dependencias, la misma que `apps/api/src/llm/english.ts`; las dos se
prueban contra `testdata/english-vectors.json` en la raíz del repo. Pensada para
frases cortas habladas: cuenta palabras gramaticales de portugués/español (y letras
que el inglés no usa) contra las del inglés. Un nombre propio con tilde («São Paulo»,
«Bogotá») no basta para rechazar una frase en inglés.
"""

import re

_WORD = re.compile(r"[a-zà-ÿ']+")
_FOREIGN_LETTERS = re.compile(r"[ãõçñáéíóúâêôà]")

# Palabras gramaticales de pt/es que no son palabras del inglés.
_PT_ES = frozenset(
    """
    o os e em de da das dos na nas ao aos um uma uns umas que se
    para com por pelo pela pelas pelos sobre como qual quais quando onde porque
    você vocês seu sua seus suas meu minha nosso nossa sou é está esta este isso
    isto ser será foi tem ter pode podemos vamos fale conte conta conforme também
    mais muito obrigado obrigada olá bem vindo vinda empresa vaga entrevista
    pergunta resposta experiência projeto trabalho trabalhou
    el la los las una unos unas y es soy tu tú su sus mi usted ustedes
    con del al cómo qué cuál cuáles cuándo dónde por qué hola gracias cuéntame
    puedes puede trabajaste manejaste experiencia proyecto empresa entrevistador
    entrevistadora
    """.split()
)

_EN = frozenset(
    """
    the a an and or of to in on at for with about from by as is are was were be been
    you your yours i me my we our us they their it its this that these those
    what how why when where which who whom do does did have has had can could would
    should will tell walk describe give thank thanks please okay great
    """.split()
)


def looks_english(text: str) -> bool:
    """False cuando la frase está, con claridad, en portugués o español."""
    if "¿" in text or "¡" in text:
        return False
    words = _WORD.findall(text.lower())
    if len(words) < 3:
        return True
    foreign = sum(1 for w in words if w in _PT_ES or _FOREIGN_LETTERS.search(w))
    english = sum(1 for w in words if w in _EN)
    return not (foreign >= 2 and foreign > english)

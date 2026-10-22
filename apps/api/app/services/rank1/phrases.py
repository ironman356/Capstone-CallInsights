import re


STOP_WORDS = set("i me my we our you your it its is am are was were be been a an the and or but to of for in on at by with that this these those have has had do does did can could would will should please thank thanks okay hello hi today very so just understand know let help".split())


def common_phrases(calls: list[dict], limit: int = 8) -> list[dict]:
    """Find exact, case-insensitive phrases shared by at least two calls."""
    candidates: dict[tuple, dict] = {}
    for call in calls:
        for turn in call.get("turns", []):
            speaker = turn["speaker"].strip().lower()
            # Keep phrases inside sentences and speaker turns; preserve original text.
            for sentence in re.split(r"[.!?;\n]+", turn["text"]):
                words = list(re.finditer(r"[A-Za-z]+(?:['’][A-Za-z]+)?", sentence))
                for size in range(3, 7):
                    for start in range(len(words) - size + 1):
                        span = words[start:start + size]
                        tokens = tuple(word.group().lower().replace("’", "'") for word in span)
                        if sum(token not in STOP_WORDS for token in tokens) < 2:
                            continue
                        key = (speaker, tokens)
                        phrase = candidates.setdefault(key, {
                            "text": sentence[span[0].start():span[-1].end()],
                            "speaker": speaker.title(),
                            "call_ids": set(),
                        })
                        phrase["call_ids"].add(call["call_id"])

    ranked = sorted(
        ((key, phrase) for key, phrase in candidates.items() if len(phrase["call_ids"]) >= 2),
        key=lambda item: (-len(item[1]["call_ids"]), -len(item[0][1]), item[0]),
    )
    selected = []
    for (speaker, tokens), phrase in ranked:
        # Avoid filling the list with shorter versions of the same shared wording.
        if any(
            speaker == previous_speaker and phrase["call_ids"] == previous["call_ids"]
            and any(previous_tokens[index:index + len(tokens)] == tokens
                    for index in range(len(previous_tokens) - len(tokens) + 1))
            for (previous_speaker, previous_tokens), previous in selected
        ):
            continue
        selected.append(((speaker, tokens), phrase))
        if len(selected) >= limit:
            break
    return [{**phrase, "call_ids": sorted(phrase["call_ids"])} for _, phrase in selected]

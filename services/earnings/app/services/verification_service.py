VALID_TRANSITIONS: dict[str, list[str]] = {
    "pending":      ["verified", "disputed", "unverifiable"],
    "disputed":     ["pending"],
    "verified":     [],
    "unverifiable": [],
}


def can_transition(current: str, target: str) -> bool:
    return target in VALID_TRANSITIONS.get(current, [])

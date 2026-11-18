#!/usr/bin/env python3
"""Keeps invisible and unusual characters out of the JavaScript source.

Rewrites non-ASCII characters in code as \\uXXXX escapes, so that zero-width
characters, direction marks and the like are readable in the source and
cannot be damaged by an editor. Comment lines and the user-facing texts
(lines starting with `desc:` or marked `// text`) keep their characters.

Run from the repo root:  python3 tools/escape-nonascii.py js/engine.js [...]
With --check it only reports and exits with 1 if something would change.
"""
import re
import sys

KEEP = re.compile(r"^\s*(//|\*|/\*|desc:)|// text\s*$")


def esc(ch):
    cp = ord(ch)
    return "\\u%04X" % cp if cp <= 0xFFFF else "\\u{%X}" % cp


def convert(text):
    out = []
    for line in text.split("\n"):
        if not KEEP.search(line):
            line = re.sub(r"[^\x00-\x7E]", lambda m: esc(m.group(0)), line)
        out.append(line)
    return "\n".join(out)


def main():
    check = "--check" in sys.argv
    changed = False
    for path in [a for a in sys.argv[1:] if not a.startswith("--")]:
        with open(path, encoding="utf-8") as f:
            src = f.read()
        new = convert(src)
        if new != src:
            changed = True
            print(("would change " if check else "escaped ") + path)
            if not check:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new)
    sys.exit(1 if check and changed else 0)


main()

"""Offline comparison; print changed structural sections, never definitions/data."""
import argparse
import json
from pathlib import Path
from generate_rollbacks import canonical


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before', type=Path)
    parser.add_argument('after', type=Path)
    args = parser.parse_args()
    before = canonical(json.loads(args.before.read_text()))
    after = canonical(json.loads(args.after.read_text()))
    changed = sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))
    print('STRUCTURE_IDENTICAL' if not changed else 'STRUCTURE_MISMATCH:' + ','.join(changed))
    raise SystemExit(bool(changed))


if __name__ == '__main__':
    main()

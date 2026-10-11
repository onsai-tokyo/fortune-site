"""Compare original vs updated fixtures: everything except prose must be identical.
Usage: python3 -I compare_fixtures.py <orig_dir> <new_dir>"""
import json, sys, os, re
A, B = sys.argv[1], sys.argv[2]
problems, stats = [], {'files': 0, 'cards': 0, 'proseChangedCards': 0}
def strip(x, path=''):
    """Replace prose strings by a marker, keep structure + non-prose values."""
    if isinstance(x, dict):
        return {k: strip(v, path + '/' + k) for k, v in x.items()}
    if isinstance(x, list):
        return [strip(v, path + '/' + str(i)) for i, v in enumerate(x)]
    if isinstance(x, str):
        key = path.split('/')[-1]
        # prose fields: section bodies, summaries, titles, readings, evidenceText
        if key in ('body', 'summary', 'title', 'text', 'evidenceText', 'reading', 'simple'):
            return '<prose>'
        if re.search(r'/sections/\d+/body$', path) or re.search(r'/pages/\d+/text$', path):
            return '<prose>'
    return x
for f in sorted(os.listdir(A)):
    a = json.load(open(os.path.join(A, f), encoding='utf-8')); b = json.load(open(os.path.join(B, f), encoding='utf-8'))
    stats['files'] += 1
    sa, sb = strip(a), strip(b)
    if sa != sb:
        # locate first difference
        def diff(x, y, p=''):
            if type(x) != type(y): return p
            if isinstance(x, dict):
                for k in sorted(set(x) | set(y)):
                    if k not in x or k not in y: return p + '/' + k
                    r = diff(x[k], y[k], p + '/' + k)
                    if r: return r
            elif isinstance(x, list):
                if len(x) != len(y): return p + f' len {len(x)}!={len(y)}'
                for i, (u, v) in enumerate(zip(x, y)):
                    r = diff(u, v, p + f'/{i}')
                    if r: return r
            elif x != y: return p + f' : {str(x)[:80]} -> {str(y)[:80]}'
            return None
        problems.append((f, diff(sa, sb)))
    # sentence count per section (structure of composition)
    def cards(x):
        if isinstance(x, dict):
            if 'sections' in x and isinstance(x['sections'], list): yield x
            for v in x.values(): yield from cards(v)
        elif isinstance(x, list):
            for v in x: yield from cards(v)
    for ca, cb in zip(cards(a), cards(b)):
        stats['cards'] += 1
        if json.dumps(ca, ensure_ascii=False) != json.dumps(cb, ensure_ascii=False): stats['proseChangedCards'] += 1
        for sa_, sb_ in zip(ca['sections'], cb['sections']):
            if sa_.get('heading') != sb_.get('heading'): problems.append((f, f'heading {sa_.get("heading")} -> {sb_.get("heading")}'))
            na = len([s for s in re.split(r'(?<=。)', sa_.get('body', '')) if s.strip()]); nb = len([s for s in re.split(r'(?<=。)', sb_.get('body', '')) if s.strip()])
            if na != nb: problems.append((f, f'{ca.get("id")} {sa_.get("heading")} sentences {na}->{nb}'))
    # simple summaries: sentence counts
    def simples(x):
        if isinstance(x, dict):
            if 'summary' in x and 'id' in x and 'sections' not in x: yield x
            for v in x.values(): yield from simples(v)
        elif isinstance(x, list):
            for v in x: yield from simples(v)
    for ca, cb in zip(simples(a), simples(b)):
        na = len([s for s in re.split(r'(?<=。)', ca['summary']) if s.strip()]); nb = len([s for s in re.split(r'(?<=。)', cb['summary']) if s.strip()])
        if na != nb: problems.append((f, f'{ca["id"]} simple sentences {na}->{nb}'))
print(stats)
print(len(problems), 'problems')
for p in problems[:60]: print(p)

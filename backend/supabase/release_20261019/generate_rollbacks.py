"""Offline rollback generator. Input/output MUST remain inside encryption.

No DB connections. A baseline is a preflight.sql JSON result, not an estimate.
Refuses existing target tables: their preservation needs an individual plan.
"""
import argparse
import hashlib
import json
from pathlib import Path

FUNCTIONS = {
    'web': [
        'public.ai_book_grant_web(uuid,text,integer)',
        'public.ai_book_order_web(uuid,uuid,uuid,text,text,text,jsonb)',
    ],
    'questions': [
        'public.ai_book_question_begin(uuid,uuid,uuid,text,integer,integer)',
        'public.ai_book_question_complete(uuid,uuid,text)',
        'public.ai_book_question_fail(uuid,uuid)',
    ],
    'saves': ['public.delete_partner_reading_saves()'],
}
OLD_BEGIN = 'public.ai_book_question_begin(uuid,uuid,uuid,text)'
CONSTRAINTS = {'ai_book_grants_environment_check', 'ai_book_grants_source_check'}
TRIGGER = 'partner_profiles_delete_reading_saves'


def identifier(value):
    return '"' + value.replace('"', '""') + '"'


def literal(value):
    return 'NULL' if value is None else "'" + value.replace("'", "''") + "'"


def principal(value):
    return 'PUBLIC' if value == 'PUBLIC' else identifier(value)


def canonical(snapshot):
    """Compare structural state, excluding capture time and executing session."""
    return {key: value for key, value in snapshot.items()
            if key not in {'captured_at', 'executor', 'database'}}


def validate(snapshot):
    if snapshot.get('format_version') != 1:
        raise ValueError('SNAPSHOT_FORMAT_UNSUPPORTED')
    if not isinstance(snapshot.get('server_version_num'), int):
        raise ValueError('SERVER_VERSION_UNKNOWN')
    tables = {t['name']: t for t in snapshot['tables']}
    for name in ['ai_book_grants', 'ai_book_credits', 'ai_books', 'partner_profiles']:
        if not tables.get(name, {}).get('exists'):
            raise ValueError('REQUIRED_BASE_TABLE_MISSING: ' + name)
    for name in ['reading_saves', 'ai_book_questions']:
        if name not in tables or tables[name]['exists']:
            raise ValueError('TARGET_TABLE_NOT_CONFIRMED_NEW: ' + name)
    columns = {c['name']: c['type'] for c in tables['partner_profiles']['columns']}
    if columns.get('id') != 'uuid' or columns.get('user_id') != 'uuid':
        raise ValueError('PARTNER_COLUMN_CONTRACT_MISMATCH')
    constraints = {c['name']: c for c in snapshot['constraints']}
    if set(constraints) != CONSTRAINTS:
        raise ValueError('CONSTRAINT_BASELINE_INCOMPLETE')
    for con in constraints.values():
        if not con['definition'].startswith('CHECK ('):
            raise ValueError('UNEXPECTED_CONSTRAINT_KIND')
    funcs = {f['signature']: f for f in snapshot['functions']}
    wanted = {s for group in FUNCTIONS.values() for s in group} | {OLD_BEGIN}
    if set(funcs) != wanted:
        raise ValueError('FUNCTION_BASELINE_INCOMPLETE')
    for f in funcs.values():
        if f['exists'] and (not f.get('definition') or not f.get('owner') or 'acl' not in f):
            raise ValueError('FUNCTION_METADATA_INCOMPLETE')
        if f['exists'] and any(a['privilege'] != 'EXECUTE' for a in f['acl']):
            raise ValueError('UNEXPECTED_FUNCTION_PRIVILEGE')
    if funcs[OLD_BEGIN]['exists'] and funcs[OLD_BEGIN].get('incoming_dependencies'):
        raise ValueError('LEGACY_FUNCTION_HAS_DEPENDENCIES_REQUIRES_REVIEW')
    for trigger in tables['partner_profiles']['triggers']:
        if trigger['name'] == TRIGGER and trigger['internal']:
            raise ValueError('EXPECTED_USER_TRIGGER_IS_INTERNAL')
    return tables, funcs, constraints


def restore_function(f):
    signature = f['signature']  # validated against the fixed allow-list
    if not f['exists']:
        # RESTRICT is intentional: never erase unrelated dependent objects.
        return f'DROP FUNCTION IF EXISTS {signature} RESTRICT;\n'
    result = [f['definition'].rstrip(';\n') + ';',
              f'ALTER FUNCTION {signature} OWNER TO {identifier(f["owner"])};']
    # Remove the migration ACL and any default grants for a recreated function.
    # The generator does not write pg_proc directly or relax role permissions.
    result.append("DO $acl$ DECLARE r record; BEGIN\n"
                  " FOR r IN SELECT DISTINCT a.grantee FROM pg_proc p,\n"
                  " LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a\n"
                  f" WHERE p.oid=to_regprocedure({literal(signature)}) LOOP\n"
                  " EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',\n"
                  f" {literal(signature)},CASE WHEN r.grantee=0 THEN 'PUBLIC'\n"
                  " ELSE quote_ident(pg_get_userbyid(r.grantee)) END);\n"
                  " END LOOP; END $acl$;")
    for acl in f['acl']:
        result += [f'SET LOCAL ROLE {identifier(acl["grantor"])};',
                   f'GRANT EXECUTE ON FUNCTION {signature} TO {principal(acl["grantee"])}'
                   + (' WITH GRANT OPTION;' if acl['grantable'] else ';'),
                   'RESET ROLE;']
    result.append(f'COMMENT ON FUNCTION {signature} IS {literal(f.get("comment"))};')
    return '\n'.join(result) + '\n'


def empty_table_guard(name):
    return (f'LOCK TABLE public.{name} IN ACCESS EXCLUSIVE MODE;\n'
            f'DO $guard$ BEGIN IF EXISTS (SELECT 1 FROM public.{name} LIMIT 1) THEN\n'
            f" RAISE EXCEPTION 'ROLLBACK_REFUSED_NONEMPTY_{name}';\n"
            ' END IF; END $guard$;\n')


def render(snapshot, template_dir=None):
    tables, funcs, constraints = validate(snapshot)
    digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
    guard = ("\\if :{?FATELAB_ROLLBACK_APPROVED}\n"
             "\\if :FATELAB_ROLLBACK_APPROVED\n"
             "\\else\n\\echo 'ROLLBACK_NOT_APPROVED'\n\\quit 3\n\\endif\n"
             "\\else\n\\echo 'ROLLBACK_NOT_APPROVED'\n\\quit 3\n\\endif\n")
    common = (f'-- Baseline SHA256: {digest}\n'
              '-- DO NOT execute without individual production approval.\n'
              '-- Run reverse order: 03, 02, 01. Stop Web writers before rollback.\n'
              '-- ON_ERROR_STOP is mandatory; no CASCADE and no row deletion.\n'
              '\\set ON_ERROR_STOP on\n' + guard + 'begin;\n'
              "set local lock_timeout='5s';\nset local statement_timeout='60s';\n")
    web = 'LOCK TABLE public.ai_book_grants IN ACCESS EXCLUSIVE MODE;\n'
    web += ("DO $guard$ BEGIN IF EXISTS (SELECT 1 FROM public.ai_book_grants\n"
            " WHERE environment='Web' OR source='web') THEN\n"
            " RAISE EXCEPTION 'ROLLBACK_REFUSED_WEB_GRANTS_EXIST'; END IF; END $guard$;\n")
    for signature in reversed(FUNCTIONS['web']):
        web += restore_function(funcs[signature])
    for name in sorted(CONSTRAINTS):
        con = constraints[name]
        web += f'ALTER TABLE public.ai_book_grants DROP CONSTRAINT {identifier(name)};\n'
        web += f'ALTER TABLE public.ai_book_grants ADD CONSTRAINT {identifier(name)} {con["definition"]};\n'
        web += f'COMMENT ON CONSTRAINT {identifier(name)} ON public.ai_book_grants IS {literal(con.get("comment"))};\n'

    questions = empty_table_guard('ai_book_questions')
    for signature in reversed(FUNCTIONS['questions']):
        questions += restore_function(funcs[signature])
    questions += 'DROP TABLE public.ai_book_questions RESTRICT;\n'
    questions += restore_function(funcs[OLD_BEGIN])

    saves = 'LOCK TABLE public.partner_profiles IN ACCESS EXCLUSIVE MODE;\n'
    saves += empty_table_guard('reading_saves')
    saves += f'DROP TRIGGER IF EXISTS {identifier(TRIGGER)} ON public.partner_profiles;\n'
    # Remove trigger before restoring/dropping its function, then restore baseline.
    saves += restore_function(funcs[FUNCTIONS['saves'][0]])
    for trigger in tables['partner_profiles']['triggers']:
        if trigger['name'] != TRIGGER:
            continue
        saves += trigger['definition'].rstrip(';') + ';\n'
        mode = {'O': 'ENABLE', 'D': 'DISABLE', 'R': 'ENABLE REPLICA', 'A': 'ENABLE ALWAYS'}[trigger['enabled']]
        saves += f'ALTER TABLE public.partner_profiles {mode} TRIGGER {identifier(TRIGGER)};\n'
        saves += f'COMMENT ON TRIGGER {identifier(TRIGGER)} ON public.partner_profiles IS {literal(trigger.get("comment"))};\n'
    saves += 'DROP TABLE public.reading_saves RESTRICT;\n'
    bodies = {'01_web_book_credits.rollback.sql': web,
              '02_ai_book_questions.rollback.sql': questions,
              '03_reading_saves.rollback.sql': saves}
    outputs = {}
    for name, body in bodies.items():
        if template_dir:
            template = (Path(template_dir) / (name + '.in')).read_text()
            outputs[name] = template.replace('@HEADER_AND_BEGIN@', common).replace('@RESTORE_BODY@', body)
        else:
            outputs[name] = common + body + 'commit;\n'
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('output_dir', type=Path)
    parser.add_argument('--confirmed-encrypted-output', action='store_true')
    args = parser.parse_args()
    if not args.confirmed_encrypted_output:
        parser.error('Confirm encrypted output location; never use a shared/normal folder for a real snapshot')
    snapshot = json.loads(args.snapshot.read_text())
    outputs = render(snapshot, Path(__file__).parent)
    args.output_dir.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name, content in outputs.items():
        path = args.output_dir / name
        path.write_text(content)
        path.chmod(0o600)
    print('ROLLBACK_FILES_GENERATED_REHEARSAL_REQUIRED')


if __name__ == '__main__':
    main()

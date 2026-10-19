import copy
import unittest
from pathlib import Path

from generate_rollbacks import (CONSTRAINTS, FUNCTIONS, OLD_BEGIN, TRIGGER,
                                canonical, identifier, literal, render, validate)


def baseline():
    signatures = [s for group in FUNCTIONS.values() for s in group] + [OLD_BEGIN]
    return {
        'format_version': 1, 'server_version_num': 170006,
        'server_version': '17.6', 'database': 'synthetic_only',
        'executor': 'fixture_owner', 'captured_at': 'fixture-time',
        'constraints': [
            {'name': 'ai_book_grants_environment_check',
             'definition': "CHECK ((environment = ANY (ARRAY['Production'::text, 'Sandbox'::text])))",
             'validated': True, 'comment': None},
            {'name': 'ai_book_grants_source_check',
             'definition': "CHECK (((source = 'review'::text) AND (environment = 'Review'::text) AND (signed_ms = 0) AND (transaction_id ~~ 'review:%'::text)) OR ((source = 'trial'::text) AND (quantity = 1) AND (environment = 'Trial'::text)))",
             'validated': True, 'comment': "fixture's predicate"},
        ],
        'functions': [{'signature': s, 'exists': False} for s in signatures],
        'tables': [
            {'name': n, 'exists': True,
             'columns': ([{'name': 'id', 'type': 'uuid'}, {'name': 'user_id', 'type': 'uuid'}]
                         if n == 'partner_profiles' else []), 'triggers': []}
            for n in ['ai_book_grants', 'ai_book_credits', 'ai_books', 'partner_profiles']
        ] + [{'name': n, 'exists': False} for n in ['ai_book_questions', 'reading_saves']],
        'extensions': [],
    }


def original_function(signature):
    return {
        'signature': signature, 'exists': True,
        'definition': 'CREATE OR REPLACE FUNCTION public.ai_book_question_begin(uuid,uuid,uuid,text) RETURNS jsonb LANGUAGE sql AS $body$ SELECT \'{}\'::jsonb $body$\n',
        'owner': 'fixture_owner', 'comment': "owner's original function",
        'acl_is_null': False,
        'acl': [{'grantor': 'fixture_owner', 'grantee': 'service_role',
                 'privilege': 'EXECUTE', 'grantable': False}],
        'incoming_dependencies': [],
    }


class RollbackTests(unittest.TestCase):
    def test_three_transaction_scoped_templates(self):
        files = render(baseline(), Path(__file__).parent)
        self.assertEqual(len(files), 3)
        for text in files.values():
            self.assertIn('\nbegin;\n', text)
            self.assertTrue(text.endswith('commit;\n'))
            self.assertNotIn('@RESTORE_BODY@', text)

    def test_requires_explicit_approval(self):
        for text in render(baseline()).values():
            self.assertIn('FATELAB_ROLLBACK_APPROVED', text)
            self.assertIn('\\quit 3', text)
            self.assertLess(text.index('\\quit 3'), text.index('\nbegin;'))

    def test_original_review_trial_predicate_verbatim(self):
        source = baseline()
        text = render(source)['01_web_book_credits.rollback.sql']
        for c in source['constraints']:
            self.assertIn(c['definition'] + ';', text)
        self.assertIn("IS 'fixture''s predicate';", text)
        self.assertIn('ROLLBACK_REFUSED_WEB_GRANTS_EXIST', text)

    def test_new_tables_must_not_preexist(self):
        for name in ['reading_saves', 'ai_book_questions']:
            source = baseline()
            next(t for t in source['tables'] if t['name'] == name)['exists'] = True
            with self.assertRaisesRegex(ValueError, 'TARGET_TABLE_NOT_CONFIRMED_NEW'):
                render(source)

    def test_absent_target_metadata_is_not_assumed_new(self):
        source = baseline()
        source['tables'] = [t for t in source['tables'] if t['name'] != 'reading_saves']
        with self.assertRaisesRegex(ValueError, 'TARGET_TABLE_NOT_CONFIRMED_NEW'):
            render(source)

    def test_nonempty_new_table_is_guarded(self):
        for name, file in [('reading_saves', '03_reading_saves.rollback.sql'),
                           ('ai_book_questions', '02_ai_book_questions.rollback.sql')]:
            text = render(baseline())[file]
            self.assertIn('ROLLBACK_REFUSED_NONEMPTY_' + name, text)
            self.assertIn('ACCESS EXCLUSIVE', text)
            self.assertLess(text.index('ROLLBACK_REFUSED_NONEMPTY_'), text.index('DROP TABLE'))

    def test_no_row_deletion_or_cascade(self):
        for text in render(baseline()).values():
            self.assertNotIn(' CASCADE;', text)
            self.assertNotIn('DELETE FROM', text)
            self.assertNotIn('TRUNCATE ', text)

    def test_legacy_four_arg_function_restored(self):
        source = baseline()
        index = next(i for i, f in enumerate(source['functions']) if f['signature'] == OLD_BEGIN)
        source['functions'][index] = original_function(OLD_BEGIN)
        text = render(source)['02_ai_book_questions.rollback.sql']
        self.assertIn(source['functions'][index]['definition'].strip() + ';', text)
        self.assertIn('OWNER TO "fixture_owner";', text)
        self.assertIn('TO "service_role";', text)
        self.assertIn("IS 'owner''s original function';", text)

    def test_legacy_function_not_invented_when_absent(self):
        text = render(baseline())['02_ai_book_questions.rollback.sql']
        self.assertNotIn('CREATE OR REPLACE FUNCTION', text)
        self.assertIn('DROP FUNCTION IF EXISTS ' + OLD_BEGIN + ' RESTRICT;', text)

    def test_legacy_dependencies_require_review(self):
        source = baseline()
        f = original_function(OLD_BEGIN)
        f['incoming_dependencies'] = [{'type': 'n', 'object': 'fixture caller'}]
        source['functions'][-1] = f
        with self.assertRaisesRegex(ValueError, 'DEPENDENCIES_REQUIRES_REVIEW'):
            render(source)

    def test_trigger_removed_before_function_and_table(self):
        text = render(baseline())['03_reading_saves.rollback.sql']
        self.assertLess(text.index('DROP TRIGGER'), text.index('DROP FUNCTION'))
        self.assertLess(text.index('DROP FUNCTION'), text.index('DROP TABLE'))

    def test_existing_trigger_definition_and_state_restored(self):
        source = baseline()
        partner = next(t for t in source['tables'] if t['name'] == 'partner_profiles')
        partner['triggers'] = [{'name': TRIGGER, 'internal': False, 'enabled': 'D',
            'definition': 'CREATE TRIGGER ' + TRIGGER + ' AFTER DELETE ON public.partner_profiles FOR EACH ROW EXECUTE FUNCTION public.fixture_trigger()',
            'comment': None}]
        text = render(source)['03_reading_saves.rollback.sql']
        self.assertIn(partner['triggers'][0]['definition'] + ';', text)
        self.assertIn('DISABLE TRIGGER "' + TRIGGER + '";', text)

    def test_constraints_complete(self):
        source = baseline()
        source['constraints'].pop()
        with self.assertRaisesRegex(ValueError, 'CONSTRAINT_BASELINE_INCOMPLETE'):
            render(source)

    def test_partner_contract_checked(self):
        source = baseline()
        partner = next(t for t in source['tables'] if t['name'] == 'partner_profiles')
        partner['columns'][0]['type'] = 'text'
        with self.assertRaisesRegex(ValueError, 'PARTNER_COLUMN_CONTRACT_MISMATCH'):
            render(source)

    def test_unknown_server_version_stops(self):
        source = baseline()
        source['server_version_num'] = None
        with self.assertRaisesRegex(ValueError, 'SERVER_VERSION_UNKNOWN'):
            render(source)

    def test_snapshot_comparison_ignores_only_session_metadata(self):
        a = baseline()
        b = copy.deepcopy(a)
        b.update(captured_at='later', executor='another', database='rehearsal')
        self.assertEqual(canonical(a), canonical(b))
        b['constraints'][0]['definition'] = 'CHECK (true)'
        self.assertNotEqual(canonical(a), canonical(b))

    def test_sql_quoting(self):
        self.assertEqual(identifier('a"b'), '"a""b"')
        self.assertEqual(literal("a'b"), "'a''b'")
        self.assertEqual(literal(None), 'NULL')


if __name__ == '__main__':
    unittest.main()

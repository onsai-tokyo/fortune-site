import unittest
from pathlib import Path
from apply_web_credits import inner_sql, drift, catalog_query, guard_sql, apply_transaction, MIGRATIONS


class ApplyWebCreditsTests(unittest.TestCase):
    def test_no_historical_or_arbitrary_migration_can_run(self):
        self.assertEqual(set(MIGRATIONS), {'web_book_credits_20261017.sql', 'ai_book_questions_20261017.sql',
                                         'reading_saves_20261017.sql'})
        for name in ('../unknown.sql', '__BUILD45_DEPLOYED_AT__.sql', 'review_20261007.sql'):
            with self.subTest(name=name), self.assertRaisesRegex(RuntimeError, 'NOT_APPROVED_STOP'):
                apply_transaction([], {}, None, {}, {}, None, migration_name=name)

    def test_remove_only_expected_outer_envelope(self):
        self.assertEqual(inner_sql('-- note\nbegin read only;\nselect 1;\ncommit;', 'begin read only;'), 'select 1;\n')
        self.assertEqual(inner_sql('begin;\nselect 1;\ncommit;\n', 'begin;'), 'select 1;\n')

    def test_unexpected_envelopes_stop(self):
        for sql in ('select 1;', 'begin;\nselect 1;', 'begin;\nselect 1;\nrollback;'):
            with self.subTest(sql=sql), self.assertRaisesRegex(RuntimeError, 'ENVELOPE_UNEXPECTED'):
                inner_sql(sql, 'begin;')

    def test_exact_version_drift_stops(self):
        before = {'format_version': 1, 'constraints': [], 'functions': [], 'tables': [],
                  'foreign_keys_to_partial_scope': [], 'extensions': [], 'server_version_num': 170006}
        self.assertEqual(drift(before, dict(before)), [])
        self.assertIn('postgres_exact_version', drift(before, dict(before, server_version_num=170011)))

    def test_catalog_query_has_no_transaction_or_session_commands(self):
        query = catalog_query(Path(__file__).with_name('preflight.sql').read_text())
        self.assertTrue(query.startswith('with wanted_functions'))
        self.assertFalse(query.endswith(';'))
        self.assertNotIn('begin read only;', query)
        self.assertNotIn('set local ', query)
        with self.assertRaisesRegex(RuntimeError, 'FORMAT_STOP'):
            catalog_query('begin read only;\nDELETE FROM public.anything;\ncommit;')

    def test_guard_quotes_definition_not_interpolated_as_sql(self):
        sql = guard_sql('select 1', {'text': "O'Reilly\\test"}, 'PRE_APPLY_DRIFT_STOP')
        self.assertIn("O''Reilly", sql)
        self.assertIn('IS DISTINCT FROM', sql)
        self.assertNotIn('COMMIT', sql)
        with self.assertRaisesRegex(RuntimeError, 'GUARD_CODE_INVALID'):
            guard_sql('select 1', {}, "unsafe'code")


if __name__ == '__main__':
    unittest.main()

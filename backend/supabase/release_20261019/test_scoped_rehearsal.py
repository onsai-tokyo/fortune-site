import unittest
import pathlib
import plistlib
import shlex
import subprocess
import sys
from scoped_rehearsal import (NETWORK_PROFILE, Stop, copy_order, copy_output_lines,
                              ordered_copy_sql, parse_copy, row_digest, canonical_copy_rows)

OWNER = '11111111-1111-4111-8111-111111111111'


class LauncherPlistTests(unittest.TestCase):
    def test_actual_launcher_parser_reads_non_seekable_binary_pipe(self):
        template = pathlib.Path(__file__).with_name('scoped_rehearsal.command.in').read_text()
        line = next(line for line in template.splitlines() if line.startswith('scoped_in_use='))
        parser = shlex.split(line.split('python3 -B -c ', 1)[1])[0]
        for fmt in (plistlib.FMT_BINARY, plistlib.FMT_XML):
            for images, expected in (([], 'AVAILABLE'),
                                     ([{'image-path': '/fixture/source.sparseimage'}], 'IN_USE'),
                                     ([{'image-path': '/fixture/unrelated.sparseimage'}], 'AVAILABLE')):
                with self.subTest(fmt=fmt, expected=expected):
                    result = subprocess.run(
                        [sys.executable, '-B', '-c', parser, '/fixture/source.sparseimage', '/fixture/work.sparseimage'],
                        input=plistlib.dumps({'images': images}, fmt=fmt), capture_output=True, check=True)
                    self.assertEqual(result.stdout.decode().strip(), expected)
        with self.assertRaises(subprocess.CalledProcessError):
            subprocess.run([sys.executable, '-B', '-c', parser], input=b'not a plist',
                           capture_output=True, check=True)


def copy_fixture(question='synthetic'):
    result = []
    for table in ['ai_book_grants', 'ai_books', 'ai_book_credits', 'partner_profiles']:
        columns = 'id, user_id, question' if table != 'ai_book_credits' else 'id'
        row = OWNER + '\t' + OWNER + '\t' + question if table != 'ai_book_credits' else OWNER
        result += [f'COPY public.{table} ({columns}) FROM stdin;', row, r'\.']
    return '\n'.join(result) + '\n'


class ScopedCopyTests(unittest.TestCase):
    def test_postgres_variable_fractional_precision_on_python39(self):
        metadata = {'columns': [{'name': 'instant', 'type': 'timestamp with time zone'}]}
        normalize = lambda value: canonical_copy_rows([value], ['instant'], metadata)
        for digits in range(1, 7):
            fraction = '123456'[:digits]
            with self.subTest(digits=digits):
                self.assertEqual(normalize('2026-10-19 11:00:00.' + fraction + '+09'),
                                 normalize('2026-10-19 02:00:00.' + fraction.ljust(6, '0') + '+00:00'))
        self.assertNotEqual(normalize('2026-10-19 02:00:00.12345+00'),
                            normalize('2026-10-19 02:00:00.123456+00'))
        with self.assertRaisesRegex(Stop, '^COPY_TIMESTAMP_CANONICALIZATION_UNSUPPORTED$'):
            normalize('2026-10-19 02:00:00.1234567+00')

    def test_timestamptz_compares_same_instant_across_session_timezones(self):
        metadata = {'columns': [{'name': 'instant', 'type': 'timestamp with time zone'}, {'name': 'text', 'type': 'text'}]}
        normalize = lambda rows: canonical_copy_rows(rows, ['instant', 'text'], metadata)
        self.assertEqual(normalize(['2026-10-19 11:00:00+09\tunchanged']), normalize(['2026-10-19 02:00:00+00\tunchanged']))
        self.assertNotEqual(normalize(['2026-10-19 11:00:01+09\tunchanged']), normalize(['2026-10-19 02:00:00+00\tunchanged']))
        self.assertEqual(normalize([r'\N'+'\ttext', 'infinity\ttext']), [r'\N'+'\ttext', 'infinity\ttext'])

    def test_without_timezone_stays_exact_and_invalid_values_stop_without_echo(self):
        metadata = {'columns': [{'name': 'instant', 'type': 'timestamp without time zone'}]}
        self.assertEqual(canonical_copy_rows(['2026-10-19 11:00:00'], ['instant'], metadata), ['2026-10-19 11:00:00'])
        metadata['columns'][0]['type'] = 'timestamp with time zone'
        with self.assertRaisesRegex(Stop, '^COPY_TIMESTAMP_CANONICALIZATION_UNSUPPORTED$'):
            canonical_copy_rows(['PRIVATE_UNSUPPORTED_VALUE'], ['instant'], metadata)

    def test_four_table_scope_and_only_owner_ids(self):
        tables, owners = parse_copy(copy_fixture())
        self.assertEqual(len(tables), 4)
        self.assertEqual(owners, {OWNER})

    def test_reject_unknown_table(self):
        with self.assertRaisesRegex(Stop, 'SCOPE_UNSUPPORTED'):
            parse_copy(copy_fixture() + 'COPY auth.users (id) FROM stdin;\n')

    def test_reject_insert_format(self):
        with self.assertRaisesRegex(Stop, 'UNSUPPORTED'):
            parse_copy(copy_fixture() + 'INSERT INTO auth.users VALUES (1);\n')

    def test_reject_incomplete_scope(self):
        with self.assertRaisesRegex(Stop, 'SCOPE_INCOMPLETE'):
            parse_copy('')

    def test_reject_bad_uuid_without_echoing_value(self):
        source = copy_fixture().replace(OWNER, 'PRIVATE_VALUE')
        with self.assertRaisesRegex(Stop, '^COPY_OWNER_UUID_INVALID$'):
            parse_copy(source)

    def test_reject_duplicate_blocks(self):
        with self.assertRaisesRegex(Stop, 'DUPLICATE'):
            parse_copy(copy_fixture() + copy_fixture())

    def test_reject_bad_column_count(self):
        with self.assertRaisesRegex(Stop, 'FIELD_COUNT'):
            parse_copy(copy_fixture('extra\tfield'))

    def test_unicode_separator_is_not_record_separator(self):
        text = 'first\u2028second\u0085third'
        tables, _ = parse_copy(copy_fixture(text))
        self.assertEqual(tables['ai_books']['rows'][0].split('\t')[-1], text)
        self.assertEqual(copy_output_lines((text + '\n').encode()), [text])

    def test_multiset_hash_ignores_order_not_duplicates(self):
        self.assertEqual(row_digest(['a', 'b']), row_digest(['b', 'a']))
        self.assertNotEqual(row_digest(['a', 'b']), row_digest(['a', 'b', 'b']))
        self.assertNotEqual(row_digest(['a', 'bc']), row_digest(['ab', 'c']))

    def test_fk_parent_rows_restored_before_children(self):
        order = copy_order([
            {'table': 'public.ai_book_credits', 'parent': 'public.ai_books'},
            {'table': 'public.ai_book_credits', 'parent': 'public.ai_book_grants'},
            {'table': 'public.ai_books', 'parent': 'auth.users'},
        ])
        self.assertLess(order.index('ai_books'), order.index('ai_book_credits'))
        self.assertLess(order.index('ai_book_grants'), order.index('ai_book_credits'))

    def test_cycle_stops_without_disabling_fk(self):
        with self.assertRaisesRegex(Stop, 'CYCLIC'):
            copy_order([{'table': 'public.ai_books', 'parent': 'public.ai_book_credits'},
                        {'table': 'public.ai_book_credits', 'parent': 'public.ai_books'}])

    def test_ordering_preserves_copy_values(self):
        before, _ = parse_copy(copy_fixture('Japanese\\t日本語\u2028text'))
        after, _ = parse_copy(ordered_copy_sql(before, copy_order([])))
        self.assertEqual(before, after)

    def test_ip_network_rules_are_direction_specific(self):
        self.assertIn('(deny network*)', NETWORK_PROFILE)
        self.assertNotIn('(allow network* (local ip', NETWORK_PROFILE)
        self.assertNotIn('(allow network* (remote ip', NETWORK_PROFILE)
        self.assertIn('(allow network-outbound (remote ip "localhost:*"))', NETWORK_PROFILE)


if __name__ == '__main__':
    unittest.main()

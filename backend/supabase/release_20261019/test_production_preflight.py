import copy
import unittest
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
from production_preflight import differences, select_matched_baseline


class MatchedBaselineSelectionTests(unittest.TestCase):
    def make_attempt(self, root, name, **overrides):
        folder = root / name
        folder.mkdir()
        summary = {'status': 'SCOPED_REHEARSAL_OK', 'server_stopped': True,
                   'production_connection': 'NONE', 'rehearsal_server_version': '17.6',
                   'checks': ['recorded_production_structure_identical']}
        summary.update(overrides)
        (folder / 'summary.json').write_text(json.dumps(summary))
        (folder / 'baseline.json').write_text(json.dumps({'server_version_num': 170006}))
        return folder

    @patch('production_preflight.validate')
    def test_select_only_matched_success_not_old_or_failed(self, validate_mock):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_attempt(root, 'attempt-old')
            self.make_attempt(root, 'attempt-matched-failed', status='FAILED')
            self.make_attempt(root, 'attempt-matched-success')
            self.assertEqual(select_matched_baseline(root)['server_version_num'], 170006)
            validate_mock.assert_called_once()

    @patch('production_preflight.validate')
    def test_ambiguous_success_and_unstopped_or_wrong_version_fail_closed(self, _):
        for overrides in ({'server_stopped': False}, {'rehearsal_server_version': '17.11'},
                          {'production_connection': 'UNEXPECTED'}, {'checks': []}):
            with self.subTest(overrides=overrides), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                self.make_attempt(root, 'attempt-matched-invalid', **overrides)
                with self.assertRaisesRegex(RuntimeError, 'NOT_UNIQUE'):
                    select_matched_baseline(root)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_attempt(root, 'attempt-matched-one')
            self.make_attempt(root, 'attempt-matched-two')
            with self.assertRaisesRegex(RuntimeError, 'NOT_UNIQUE'):
                select_matched_baseline(root)

    @patch('production_preflight.validate')
    def test_baseline_version_and_symlink_rejected(self, _):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = self.make_attempt(root, 'attempt-matched-one')
            (folder / 'baseline.json').write_text('{"server_version_num":170011}')
            with self.assertRaisesRegex(RuntimeError, 'VERSION_STOP'):
                select_matched_baseline(root)
            (root / 'attempt-matched-link').symlink_to(folder, target_is_directory=True)
            with self.assertRaisesRegex(RuntimeError, 'SYMLINK_STOP'):
                select_matched_baseline(root)


class PreflightComparisonTests(unittest.TestCase):
    def fixture(self):
        return {'format_version': 1, 'server_version_num': 170011,
                'constraints': [{'name': 'source', 'definition': 'CHECK (true)'}],
                'functions': [], 'tables': [{'name': 'partner_profiles', 'triggers': [
                    {'internal': True, 'name': 'RI_123', 'definition': 'internal'},
                    {'internal': False, 'name': 'business', 'definition': 'original'}]}],
                'foreign_keys_to_partial_scope': [],
                'extensions': [{'name': 'plpgsql', 'version': '1.0', 'schema': 'pg_catalog'}]}

    def test_same_structure_and_different_capture_metadata(self):
        a = self.fixture()
        b = copy.deepcopy(a)
        b.update(captured_at='other', executor='other', server_version_num=170012)
        b['tables'][0]['triggers'][0]['name'] = 'RI_456'
        self.assertEqual(differences(a, b), [])

    def test_constraint_function_business_trigger_and_version_drift_stop(self):
        for key, value in [('constraints', []), ('functions', [{'exists': True}]),
                           ('tables', []), ('server_version_num', 150001), ('extensions', [])]:
            with self.subTest(key=key):
                a = self.fixture()
                b = copy.deepcopy(a)
                b[key] = value
                self.assertTrue(differences(a, b))

    def test_business_trigger_definition_not_ignored(self):
        a = self.fixture()
        b = copy.deepcopy(a)
        b['tables'][0]['triggers'][1]['definition'] = 'changed'
        self.assertIn('tables', differences(a, b))


if __name__ == '__main__':
    unittest.main()

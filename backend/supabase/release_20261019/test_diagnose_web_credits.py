import json
from pathlib import Path
import tempfile
import unittest
from diagnose_web_credits import classify


class OfflineApplyDiagnosisTests(unittest.TestCase):
    def fixture(self, root):
        (root / 'safe-summary.json').write_text('{"status":"CATALOG_QUERY_TIMEOUT","committed":false}')
        (root / 'private-errors.log').write_text('PRIVATE_ID PRIVATE_VALUE')

    def test_only_fixed_codes_no_private_log_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            result = classify(root)
            self.assertEqual(result['phase'], 'WAITING_PRE_APPLY_SNAPSHOT')
            self.assertEqual(result['error_codes'], ['NO_KNOWN_ERROR_MESSAGE'])
            self.assertNotIn('PRIVATE', json.dumps(result))
            (root / 'before.json').write_text('PRIVATE_STRUCTURE')
            self.assertEqual(classify(root)['phase'], 'WAITING_POST_APPLY_SNAPSHOT')
            (root / 'after-before-commit.json').write_text('PRIVATE_STRUCTURE')
            self.assertEqual(classify(root)['phase'], 'POST_SNAPSHOT_PRESENT')

    def test_fixed_error_classification(self):
        for message, code in [('canceling statement due to lock timeout', 'LOCK_TIMEOUT'),
                              ('canceling statement due to statement timeout', 'STATEMENT_TIMEOUT'),
                              ('FATAL: password authentication failed PRIVATE', 'AUTHENTICATION_FAILURE'),
                              ('ERROR: unknown PRIVATE', 'UNCLASSIFIED_ERROR_PRESENT')]:
            with self.subTest(code=code), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                self.fixture(root)
                (root / 'private-errors.log').write_text(message)
                self.assertIn(code, classify(root)['error_codes'])
                self.assertNotIn('PRIVATE', json.dumps(classify(root)))

    def test_unexpected_state_and_symlink_stop(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / 'safe-summary.json').write_text('{"status":"SUCCESS","committed":true}')
            with self.assertRaisesRegex(RuntimeError, 'UNEXPECTED_APPLY_STATUS'):
                classify(root)
            self.fixture(root)
            (root / 'before.json').symlink_to(root / 'private-errors.log')
            with self.assertRaisesRegex(RuntimeError, 'SYMLINK_STOP'):
                classify(root)


if __name__ == '__main__':
    unittest.main()

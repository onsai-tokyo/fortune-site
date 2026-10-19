import copy
import json
import unittest
from diagnose_preflight import diagnose


class SafeDiagnosisTests(unittest.TestCase):
    def fixture(self):
        return {'format_version': 1, 'server_version_num': 170011, 'constraints': [], 'functions': [],
                'extensions': [], 'foreign_keys_to_partial_scope': [],
                'tables': [{'name': 'ai_books', 'exists': True, 'acl': [], 'triggers': [], 'columns': []}]}

    def test_changes_show_field_not_private_definition(self):
        a = self.fixture()
        b = copy.deepcopy(a)
        b['tables'][0]['columns'] = [{'default': 'PRIVATE_SECRET_DO_NOT_OUTPUT'}]
        result = diagnose(a, b)
        self.assertEqual(result['table_differences'], [{'table': 'ai_books', 'changed_fields': ['columns']}])
        self.assertNotIn('PRIVATE_SECRET', json.dumps(result))

    def test_acl_only_emits_known_role_and_privilege_names(self):
        a = self.fixture()
        b = copy.deepcopy(a)
        b['tables'][0]['acl'] = [{'grantor': 'postgres', 'grantee': 'PRIVATE_ROLE', 'privilege': 'SELECT', 'grantable': True}]
        result = diagnose(a, b)
        text = json.dumps(result)
        self.assertIn('OTHER_ROLE', text)
        self.assertNotIn('PRIVATE_ROLE', text)
        self.assertIn('SELECT', text)

    def test_internal_trigger_oid_changes_remain_ignored(self):
        a = self.fixture()
        b = copy.deepcopy(a)
        b['tables'][0]['triggers'] = [{'internal': True, 'name': 'RI_DIFFERENT'}]
        self.assertEqual(diagnose(a, b)['table_differences'], [])


if __name__ == '__main__':
    unittest.main()

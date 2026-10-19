import copy
import unittest
from local_rehearsal_acl import plan_local_acl


class LocalAclTests(unittest.TestCase):
    def fixtures(self):
        production = {'format_version': 1, 'server_version_num': 170006, 'constraints': [],
                      'functions': [], 'foreign_keys_to_partial_scope': [], 'extensions': [],
                      'tables': [{'name': 'ai_books', 'exists': True, 'columns': [], 'triggers': [],
                                  'acl': [{'grantor': 'postgres', 'grantee': 'service_role', 'privilege': 'SELECT', 'grantable': False}]}]}
        local = copy.deepcopy(production)
        local['tables'][0]['acl'] += [{'grantor': 'postgres', 'grantee': role, 'privilege': privilege, 'grantable': False}
                                     for role in ('anon', 'authenticated') for privilege in ('SELECT', 'INSERT')]
        return local, production

    def test_only_excess_observed_roles_are_revoked(self):
        a, b = self.fixtures()
        sql = plan_local_acl(a, b)
        self.assertIn('LOCAL_UNIX_SOCKET_REQUIRED', sql)
        self.assertIn('FROM "anon"', sql)
        self.assertIn('FROM "authenticated"', sql)
        self.assertNotIn('service_role', sql)
        self.assertNotIn('CASCADE', sql)
        self.assertNotIn('GRANT ', sql)

    def test_identical_acl_needs_no_change(self):
        _, b = self.fixtures()
        self.assertNotIn('REVOKE', plan_local_acl(b, b))

    def test_unexpected_fields_roles_grant_options_and_production_grants_stop(self):
        for change in ('columns', 'role', 'grantable', 'production_grant', 'scope'):
            with self.subTest(change=change):
                a, b = self.fixtures()
                if change == 'columns': a['tables'][0]['columns'] = [{'name': 'unexpected'}]
                elif change == 'role': a['tables'][0]['acl'][-1]['grantee'] = 'PUBLIC'
                elif change == 'grantable': a['tables'][0]['acl'][-1]['grantable'] = True
                elif change == 'production_grant': b['tables'][0]['acl'].append(a['tables'][0]['acl'][-1])
                elif change == 'scope':
                    a['tables'][0]['name'] = b['tables'][0]['name'] = 'unrelated_table'
                with self.assertRaises(ValueError): plan_local_acl(a, b)

    def test_missing_production_privilege_or_major_mismatch_stop(self):
        for change in ('missing', 'major'):
            a, b = self.fixtures()
            if change == 'missing': a['tables'][0]['acl'].pop(0)
            else: a['server_version_num'] = 150001
            with self.assertRaises(ValueError): plan_local_acl(a, b)


if __name__ == '__main__':
    unittest.main()

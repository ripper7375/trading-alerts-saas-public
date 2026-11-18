"""
Test Suite - Admin API key check

The admin endpoints read terminal health and restart terminals, so the key
check must reject every wrong, missing or empty key, must not depend on where
a key first differs, and must read the configured key on every request.
"""

import hashlib
import hmac
import sys
import types
from unittest.mock import MagicMock

import pytest
from flask import Flask

from app.routes import admin
from app.routes.admin import admin_bp, admin_key_matches

ADMIN_KEY = 'correct-admin-key-0123456789'

# Every admin route, so none can be left without the check.
ADMIN_ROUTES = [
    ('GET', '/api/admin/terminals/health'),
    ('POST', '/api/admin/terminals/MT5_15/restart'),
    ('POST', '/api/admin/terminals/restart-all'),
    ('GET', '/api/admin/terminals/MT5_15/logs'),
    ('GET', '/api/admin/terminals/stats'),
]

NEAR_MISSES = [
    '',
    ADMIN_KEY[:-1],
    ADMIN_KEY + 'x',
    ADMIN_KEY[1:],
    ADMIN_KEY.upper(),
    ' ' + ADMIN_KEY,
    ADMIN_KEY + ' ',
    'x' * len(ADMIN_KEY),
]


@pytest.fixture
def pool(monkeypatch):
    """A stand-in connection pool; the admin routes import it lazily."""
    fake_pool = MagicMock()
    fake_pool.get_stats.return_value = {'total_terminals': 0}
    module = types.ModuleType('app.services.mt5_connection_pool')
    module.get_connection_pool = lambda: fake_pool
    monkeypatch.setitem(sys.modules, 'app.services.mt5_connection_pool', module)
    return fake_pool


@pytest.fixture
def flask_app(monkeypatch):
    """A minimal app with only the admin blueprint and a configured key."""
    monkeypatch.delenv('MT5_ADMIN_API_KEY', raising=False)
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['MT5_ADMIN_API_KEY'] = ADMIN_KEY
    app.register_blueprint(admin_bp)
    return app


@pytest.fixture
def client(flask_app):
    return flask_app.test_client()


def call(client, method, url, key=None):
    headers = {} if key is None else {'X-Admin-API-Key': key}
    return client.open(url, method=method, headers=headers)


class TestAdminKeyMatches:
    """The comparison helper"""

    def test_identical_keys_match(self):
        assert admin_key_matches(ADMIN_KEY, ADMIN_KEY) is True

    @pytest.mark.parametrize('provided', NEAR_MISSES)
    def test_other_keys_do_not_match(self, provided):
        assert admin_key_matches(provided, ADMIN_KEY) is False

    def test_unset_expected_key_never_matches(self):
        """An unconfigured key must not be satisfied by an empty one."""
        assert admin_key_matches('', '') is False
        assert admin_key_matches('anything', '') is False

    def test_non_ascii_keys_are_compared_exactly(self):
        key = 'clé-админ-密钥'
        assert admin_key_matches(key, key) is True
        assert admin_key_matches('clé-админ-密码', key) is False

    def test_compares_sha256_digests_with_compare_digest(self, monkeypatch):
        """Always two 32-byte digests, whatever the key lengths."""
        calls = []
        real_compare = hmac.compare_digest

        def spy(left, right):
            calls.append((left, right))
            return real_compare(left, right)

        monkeypatch.setattr(admin.hmac, 'compare_digest', spy)

        short_key = 'short'
        long_key = 'a-much-longer-admin-key-' + 'z' * 200
        assert admin_key_matches(short_key, long_key) is False
        assert admin_key_matches(long_key, long_key) is True

        assert calls == [
            (
                hashlib.sha256(short_key.encode()).digest(),
                hashlib.sha256(long_key.encode()).digest(),
            ),
            (
                hashlib.sha256(long_key.encode()).digest(),
                hashlib.sha256(long_key.encode()).digest(),
            ),
        ]
        assert all(len(left) == 32 and len(right) == 32 for left, right in calls)


class TestRequireAdminKey:
    """The decorator on the admin routes"""

    def test_valid_key_is_accepted(self, client, pool):
        response = call(client, 'GET', '/api/admin/terminals/stats', ADMIN_KEY)

        assert response.status_code == 200
        assert response.get_json() == {'total_terminals': 0}

    def test_missing_header_is_rejected(self, client, pool):
        response = call(client, 'GET', '/api/admin/terminals/stats')

        assert response.status_code == 403
        assert response.get_json() == {
            'success': False,
            'error': 'Invalid or missing admin API key',
        }
        pool.get_stats.assert_not_called()

    def test_empty_header_is_rejected(self, client, pool):
        response = call(client, 'GET', '/api/admin/terminals/stats', '')

        assert response.status_code == 403
        pool.get_stats.assert_not_called()

    @pytest.mark.parametrize('key', [k for k in NEAR_MISSES if k])
    def test_invalid_keys_are_rejected(self, client, pool, key):
        response = call(client, 'GET', '/api/admin/terminals/stats', key)

        assert response.status_code == 403
        pool.get_stats.assert_not_called()

    @pytest.mark.parametrize('method,url', ADMIN_ROUTES)
    def test_every_admin_route_rejects_a_wrong_or_missing_key(
        self, client, pool, method, url
    ):
        for key in (None, '', 'wrong-key'):
            response = call(client, method, url, key)
            assert response.status_code == 403

        assert pool.method_calls == []

    def test_unconfigured_key_is_a_server_error_whatever_is_sent(
        self, flask_app, client, pool
    ):
        flask_app.config['MT5_ADMIN_API_KEY'] = ''

        for key in (None, '', 'anything'):
            response = call(client, 'GET', '/api/admin/terminals/stats', key)
            assert response.status_code == 500
            assert response.get_json()['error'] == 'Admin API not configured'

        pool.get_stats.assert_not_called()

    def test_key_is_read_on_every_request(self, flask_app, client, pool):
        url = '/api/admin/terminals/stats'
        assert call(client, 'GET', url, ADMIN_KEY).status_code == 200

        flask_app.config['MT5_ADMIN_API_KEY'] = 'rotated-admin-key'

        assert call(client, 'GET', url, ADMIN_KEY).status_code == 403
        assert call(client, 'GET', url, 'rotated-admin-key').status_code == 200

    def test_environment_key_is_used_when_the_config_has_none(
        self, flask_app, client, pool, monkeypatch
    ):
        flask_app.config['MT5_ADMIN_API_KEY'] = ''
        monkeypatch.setenv('MT5_ADMIN_API_KEY', 'environment-admin-key')
        url = '/api/admin/terminals/stats'

        assert call(client, 'GET', url, 'environment-admin-key').status_code == 200
        assert call(client, 'GET', url, ADMIN_KEY).status_code == 403

    def test_config_key_wins_over_the_environment(
        self, client, pool, monkeypatch
    ):
        monkeypatch.setenv('MT5_ADMIN_API_KEY', 'environment-admin-key')
        url = '/api/admin/terminals/stats'

        assert call(client, 'GET', url, ADMIN_KEY).status_code == 200
        assert call(client, 'GET', url, 'environment-admin-key').status_code == 403

    def test_the_decision_comes_from_the_constant_time_helper(
        self, client, pool, monkeypatch
    ):
        """The routes must not compare keys themselves."""
        seen = []

        def decide(provided, expected):
            seen.append((provided, expected))
            return decide.answer

        monkeypatch.setattr(admin, 'admin_key_matches', decide)
        url = '/api/admin/terminals/stats'

        decide.answer = True
        assert call(client, 'GET', url, 'not-the-key').status_code == 200
        decide.answer = False
        assert call(client, 'GET', url, ADMIN_KEY).status_code == 403

        assert seen == [('not-the-key', ADMIN_KEY), (ADMIN_KEY, ADMIN_KEY)]

    def test_rejection_is_logged_without_the_key_that_was_sent(
        self, client, pool, caplog
    ):
        guess = 'super-secret-guess'

        with caplog.at_level('WARNING', logger='app.routes.admin'):
            call(client, 'GET', '/api/admin/terminals/stats', guess)

        assert 'Invalid admin API key attempt' in caplog.text
        assert guess not in caplog.text
        assert ADMIN_KEY not in caplog.text

##Running Mock MT5 Integration Tests

##Quick Commands

# Navigate to mt5-service

cd mt5-service

# Run all MT5 integration tests

python -m pytest tests/test_mt5_integration.py -v

# Run specific test class

python -m pytest tests/test_mt5_integration.py::TestMT5Connection -v
python -m pytest tests/test_mt5_integration.py::TestErrorScenarios -v

# Run single test

python -m pytest tests/test_mt5_integration.py::TestOHLCData::test_copy_rates_success -v

# Run mock server self-test (standalone)

python tests/mock_mt5_server.py

==================================================

##Using Mock in Your Own Tests

# In any test file

from tests.mock_mt5_server import (
get_mock_mt5,
install_mock_mt5,
uninstall_mock_mt5,
MockMT5ErrorScenarios,
)

# Option 1: Use fixture (recommended)

def test_something(connected_mock_mt5):
rates = connected_mock_mt5.copy_rates_from_pos("XAUUSD", 16385, 0, 100)
assert rates is not None

# Option 2: Manual setup

def test_something_else():
mock = install_mock_mt5()
mock.initialize()
mock.login(12345, "pass", "Server") # ... your test code ...
uninstall_mock_mt5()

# Option 3: Test error scenarios

def test_connection_failure(error_scenarios):
mock = error_scenarios.connection_failure()
assert mock.initialize() is False

==================================================

##Available Fixtures (from conftest.py)

Fixture Description

mock_mt5 Fresh, unconnected mock
connected_mock_mt5 Already initialized and logged in
installed_mock_mt5 Patched into sys.modules
error_scenarios Pre-configured failure scenarios

##Error Scenarios Available

scenarios = MockMT5ErrorScenarios()
scenarios.connection_failure() # initialize() fails
scenarios.auth_failure() # login() fails
scenarios.data_fetch_failure() # copy_rates returns None
scenarios.indicator_failure() # copy_buffer returns None
scenarios.connection_lost() # account_info returns None
scenarios.healthy_connection() # everything works

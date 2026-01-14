"""
Pytest configuration for Flask MT5 Service tests
"""

import sys
from pathlib import Path

import pytest

# Add the parent directory to Python path so tests can import app
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

# Import mock MT5 components
from tests.mock_mt5_server import (
    MockMT5,
    MockMT5ErrorScenarios,
    get_mock_mt5,
    reset_mock_mt5,
    install_mock_mt5,
    uninstall_mock_mt5,
)


@pytest.fixture
def mock_mt5():
    """Provide a fresh MockMT5 instance for each test."""
    mock = get_mock_mt5()
    mock.reset()
    yield mock
    mock.reset()


@pytest.fixture
def connected_mock_mt5():
    """Provide an initialized and logged-in MockMT5."""
    mock = get_mock_mt5()
    mock.reset()
    mock.initialize()
    mock.login(login=12345, password="testpass", server="TestServer")
    yield mock
    mock.reset()


@pytest.fixture
def installed_mock_mt5():
    """Install MockMT5 into sys.modules for imports."""
    mock = install_mock_mt5()
    yield mock
    mock.reset()
    uninstall_mock_mt5()


@pytest.fixture
def error_scenarios():
    """Provide pre-configured error scenarios."""
    return MockMT5ErrorScenarios()

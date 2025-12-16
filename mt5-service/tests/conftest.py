"""
Pytest configuration for Flask MT5 Service tests
"""

import sys
from pathlib import Path

# Add the parent directory to Python path so tests can import app
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

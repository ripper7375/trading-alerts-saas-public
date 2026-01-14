"""
Routes Package - Blueprint Registration
"""

# Import the indicators blueprint (which has routes attached)
from app.routes.indicators import indicators_bp

# Import the admin blueprint for terminal management
from app.routes.admin import admin_bp

__all__ = ['indicators_bp', 'admin_bp']

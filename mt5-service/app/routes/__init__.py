"""
Routes Package - Blueprint Registration
"""

# Import the indicators blueprint (which has routes attached)
from app.routes.indicators import indicators_bp

__all__ = ['indicators_bp']

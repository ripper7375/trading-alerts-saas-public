
from datetime import datetime
from flask import Flask, jsonify, request, redirect
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column 


# Create the Flask application
app = Flask(__name__)

# Configure the SQLite database
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///data.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False


# Define the base class for declarative models
class Base(DeclarativeBase):
    pass


# Create the SQLAlchemy object
db = SQLAlchemy(model_class=Base)

# Initialize the app with the extension
db.init_app(app)


class Trade(db.Model):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    symbol: Mapped[str] = mapped_column(String(20), nullable=False)

    order_ticket: Mapped[int] = mapped_column(Integer, nullable=True)
    deal_ticket: Mapped[int] = mapped_column(Integer, nullable=True)
    position_ticket: Mapped[int] = mapped_column(Integer, nullable=True)

    position_type: Mapped[str] = mapped_column(String(10), nullable=False)
    position_reason: Mapped[str] = mapped_column(String(50), nullable=True)

    lot_size: Mapped[float] = mapped_column(Float, nullable=False)
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)

    stop_loss: Mapped[float] = mapped_column(Float, nullable=True)
    take_profit: Mapped[float] = mapped_column(Float, nullable=True)

    profit: Mapped[float] = mapped_column(Float, nullable=False)

    open_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    close_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    magic_number: Mapped[int] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<Trade id={self.id} symbol={self.symbol} "
            f"position_type={self.position_type} profit={self.profit}>"
        )


with app.app_context():
    db.create_all()


@app.route("/")
def index():
    return redirect("/api/v1")  


# =========================
# API ROUTES
# =========================

# 1. API Root
@app.route("/api/v1")
def api_root():
    return "<p>MT5 Trade Analytics API v1 is running.</p>"


# 2. Health Check
@app.route("/api/v1/health")
def health_check():
    return jsonify({"status": "running"})


# 3. Create Trade (Core Endpoint)
@app.route("/api/v1/trades", methods=["POST"])
def create_trade():
    return jsonify({
        "message": "Trade endpoint ready. Logic will be implemented later."
    })


# 4. Get All Trades
@app.route("/api/v1/trades", methods=["GET"])
def get_trades():
    return jsonify({
        "message": "Retrieve all trades - not implemented yet."
    })


# 5. Get Single Trade
@app.route("/api/v1/trades/<int:trade_id>", methods=["GET"])
def get_trade(trade_id):
    return jsonify({
        "message": f"Retrieve trade {trade_id} - not implemented yet."
    })


# 6. Analytics Summary
@app.route("/api/v1/analytics/summary", methods=["GET"])
def analytics_summary():
    return jsonify({
        "message": "Analytics summary - not implemented yet."
    })

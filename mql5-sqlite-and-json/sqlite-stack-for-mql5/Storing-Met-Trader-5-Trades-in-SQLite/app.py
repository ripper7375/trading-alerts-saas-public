
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
    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    required_fields = [
        "symbol",
        "order_ticket",
        "deal_ticket",
        "position_ticket",
        "position_type",
        "lot_size",
        "entry_price",
        "profit",
        "open_time",
        "close_time"
    ]

    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        return jsonify({
            "error": "Missing required fields",
            "fields": missing_fields
        }), 400

    try:
        open_time = datetime.strptime(data["open_time"], "%Y.%m.%d %H:%M:%S")
        close_time = datetime.strptime(data["close_time"], "%Y.%m.%d %H:%M:%S")

        trade = Trade(
            symbol=data["symbol"],
            order_ticket=data.get("order_ticket"),
            deal_ticket=data.get("deal_ticket"),
            position_ticket=data.get("position_ticket"),
            position_type=data["position_type"],
            position_reason=data.get("position_reason"),
            lot_size=float(data["lot_size"]),
            entry_price=float(data["entry_price"]),
            stop_loss=float(data.get("stop_loss", 0.0)),
            take_profit=float(data.get("take_profit", 0.0)),
            profit=float(data["profit"]),
            open_time=open_time,
            close_time=close_time,
            magic_number=data.get("magic_number")
        )

        db.session.add(trade)
        db.session.commit()

        return jsonify({
            "message": "Trade stored successfully",
            "trade_id": trade.id
        }), 201

    except ValueError as error:
        return jsonify({
            "error": "Invalid numeric or time value",
            "details": str(error)
        }), 400

    except Exception as error:
        db.session.rollback()
        return jsonify({
            "error": "Failed to store trade record",
            "details": str(error)
        }), 500


# 4. Get All Trades
@app.route("/api/v1/trades", methods=["GET"])
def get_trades():
    trades = Trade.query.all()

    results = []
    for trade in trades:
        results.append({
            "id": trade.id,
            "symbol": trade.symbol,
            "position_type": trade.position_type,
            "lot_size": trade.lot_size,
            "profit": trade.profit,
            "open_time": trade.open_time.strftime("%Y.%m.%d %H:%M:%S"),
            "close_time": trade.close_time.strftime("%Y.%m.%d %H:%M:%S")
        })

    return jsonify(results), 200


# 5. Get Single Trade
@app.route("/api/v1/trades/<int:trade_id>", methods=["GET"])
def get_trade(trade_id):
    trade = Trade.query.get(trade_id)

    if not trade:
        return jsonify({"error": "Trade not found"}), 404

    result = {
        "id": trade.id,
        "symbol": trade.symbol,
        "order_ticket": trade.order_ticket,
        "deal_ticket": trade.deal_ticket,
        "position_ticket": trade.position_ticket,
        "position_type": trade.position_type,
        "position_reason": trade.position_reason,
        "lot_size": trade.lot_size,
        "entry_price": trade.entry_price,
        "stop_loss": trade.stop_loss,
        "take_profit": trade.take_profit,
        "profit": trade.profit,
        "open_time": trade.open_time.strftime("%Y.%m.%d %H:%M:%S"),
        "close_time": trade.close_time.strftime("%Y.%m.%d %H:%M:%S"),
        "magic_number": trade.magic_number
    }

    return jsonify(result), 200


# 6. Analytics Summary
@app.route("/api/v1/analytics/summary", methods=["GET"])
def analytics_summary():
    trades = Trade.query.all()

    total_trades = len(trades)
    total_profit = sum(trade.profit for trade in trades)

    summary = {
        "total_trades": total_trades,
        "total_profit": total_profit
    }

    return jsonify(summary), 200

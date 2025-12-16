# Rise Payment Integration Stack - Implementation Plan

**Project**: Trading Alerts SaaS V7
**Component**: Automated Affiliate Commission Payment System
**Integration**: Rise.works Payment API
**Version**: 1.0.0
**Date**: November 2025
**Document Type**: Implementation Plan (How To Build)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [File Structure](#file-structure)
4. [Implementation Phases](#implementation-phases)
5. [Phase 1: Database Schema](#phase-1-database-schema)
6. [Phase 2: Core Models](#phase-2-core-models)
7. [Phase 3: Provider Abstraction Layer](#phase-3-provider-abstraction-layer)
8. [Phase 4: Mock Payment Provider](#phase-4-mock-payment-provider)
9. [Phase 5: Rise Payment Client](#phase-5-rise-payment-client)
10. [Phase 6: Commission Service](#phase-6-commission-service)
11. [Phase 7: Payment Orchestrator](#phase-7-payment-orchestrator)
12. [Phase 8: Webhook Service](#phase-8-webhook-service)
13. [Phase 9: Configuration Management](#phase-9-configuration-management)
14. [Phase 10: Testing Suite](#phase-10-testing-suite)
15. [Phase 11: API Endpoints](#phase-11-api-endpoints)
16. [Phase 12: Integration & Deployment](#phase-12-integration--deployment)

---

## Overview

### Purpose

This implementation plan provides step-by-step instructions for building the Rise payment integration stack. It follows the architecture defined in `riseworks-disbursement-architecture-design.md` and is optimized for Aider code generation.

### Implementation Strategy

- **Build Order**: Bottom-up (database → models → services → API)
- **Testing**: Test each component before moving to next
- **Configuration**: Mock provider by default, Rise provider configurable
- **Deployment**: Phased rollout with feature flags

### Key Principles

1. **Type Safety**: All Python code uses type hints
2. **Error Handling**: Comprehensive try-catch with specific exceptions
3. **Logging**: Structured logging for all operations
4. **Testing**: Minimum 90% test coverage
5. **Documentation**: Docstrings for all public functions

---

## Prerequisites

### Environment Setup

```bash
# Navigate to project directory
cd /home/user/trading-alerts-saas-v7

# Ensure Flask backend is working
cd backend
python -m venv venv
source venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```

### Required Dependencies

Add to `backend/requirements.txt`:

```
# Existing dependencies...

# Payment Integration
web3==6.11.0              # Ethereum wallet operations
eth-account==0.10.0       # Wallet signing
requests==2.31.0          # HTTP client
python-dotenv==1.0.0      # Environment variables
pydantic==2.5.0           # Data validation
cryptography==41.0.7      # Encryption utilities

# Background Tasks (Future)
# apscheduler==3.10.4     # Task scheduling
# celery==5.3.4           # Async tasks

# Testing
pytest-asyncio==0.21.1    # Async test support
responses==0.24.1         # Mock HTTP responses
faker==20.1.0             # Test data generation
```

### Database Setup

Ensure PostgreSQL is running and accessible:

```bash
# Test database connection
psql -h localhost -U postgres -d trading_alerts_v7 -c "SELECT 1"
```

---

## File Structure

### Complete Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py                    # Existing
│   │   ├── subscription.py            # Existing
│   │   ├── affiliate.py               # NEW
│   │   ├── affiliate_rise_account.py  # NEW
│   │   ├── commission.py              # NEW
│   │   ├── payment_batch.py           # NEW
│   │   ├── payment_transaction.py     # NEW
│   │   ├── webhook_event.py           # NEW
│   │   └── audit_log.py               # NEW
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── payment/
│   │   │   ├── __init__.py
│   │   │   ├── base_provider.py       # Abstract interface
│   │   │   ├── mock_provider.py       # Mock implementation
│   │   │   ├── rise_provider.py       # Rise implementation
│   │   │   ├── provider_factory.py    # Provider selection
│   │   │   ├── orchestrator.py        # Payment orchestration
│   │   │   ├── batch_manager.py       # Batch processing
│   │   │   └── transaction_logger.py  # Audit logging
│   │   │
│   │   ├── commission/
│   │   │   ├── __init__.py
│   │   │   ├── calculator.py          # Commission calculation
│   │   │   ├── aggregator.py          # Commission aggregation
│   │   │   └── validator.py           # Commission validation
│   │   │
│   │   └── webhook/
│   │       ├── __init__.py
│   │       ├── receiver.py            # Webhook receiver
│   │       ├── validator.py           # Signature validation
│   │       └── processor.py           # Event processing
│   │
│   ├── config/
│   │   ├── __init__.py
│   │   ├── payment_config.py          # Payment configuration
│   │   └── rise_config.py             # Rise-specific config
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── crypto.py                  # Cryptographic utilities
│   │   └── eth_wallet.py              # Ethereum wallet utilities
│   │
│   └── api/
│       ├── __init__.py
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── affiliate_routes.py    # Affiliate management
│       │   ├── commission_routes.py   # Commission endpoints
│       │   ├── payment_routes.py      # Payment operations
│       │   └── webhook_routes.py      # Webhook receiver
│       │
│       └── schemas/
│           ├── __init__.py
│           ├── affiliate_schemas.py
│           ├── commission_schemas.py
│           └── payment_schemas.py
│
├── migrations/
│   ├── versions/
│   │   └── XXXX_add_payment_tables.py  # Database migration
│   └── alembic.ini
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                     # Test fixtures
│   ├── unit/
│   │   ├── test_commission_calculator.py
│   │   ├── test_mock_provider.py
│   │   ├── test_rise_provider.py
│   │   └── test_payment_orchestrator.py
│   │
│   ├── integration/
│   │   ├── test_payment_flow.py
│   │   ├── test_webhook_processing.py
│   │   └── test_batch_payments.py
│   │
│   └── e2e/
│       └── test_complete_flow.py
│
├── .env.example                        # Environment template
└── requirements.txt                    # Python dependencies
```

---

## Implementation Phases

### Phase Overview

| Phase | Component            | Files       | Dependencies | Est. Time |
| ----- | -------------------- | ----------- | ------------ | --------- |
| 1     | Database Schema      | 1 migration | None         | 30 min    |
| 2     | Core Models          | 7 models    | Phase 1      | 1 hour    |
| 3     | Provider Abstraction | 2 files     | Phase 2      | 30 min    |
| 4     | Mock Provider        | 1 file      | Phase 3      | 45 min    |
| 5     | Rise Client          | 3 files     | Phase 3      | 2 hours   |
| 6     | Commission Service   | 3 files     | Phase 2      | 1.5 hours |
| 7     | Payment Orchestrator | 3 files     | Phase 3-6    | 2 hours   |
| 8     | Webhook Service      | 3 files     | Phase 2      | 1 hour    |
| 9     | Configuration        | 2 files     | Phase 3-5    | 30 min    |
| 10    | Testing Suite        | 10 files    | All phases   | 3 hours   |
| 11    | API Endpoints        | 4 files     | All phases   | 2 hours   |
| 12    | Integration          | N/A         | All phases   | 1 hour    |

**Total Estimated Time**: 15-16 hours

---

## Phase 1: Database Schema

### 1.1 Migration File

**File**: `backend/migrations/versions/XXXX_add_payment_tables.py`

**Purpose**: Create all payment-related database tables

**Implementation**:

```python
"""Add payment integration tables

Revision ID: XXXX
Revises: YYYY
Create Date: 2025-11-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET

# Revision identifiers
revision = 'XXXX'
down_revision = 'YYYY'  # Update with latest revision
branch_labels = None
depends_on = None


def upgrade():
    # Create affiliates table
    op.create_table(
        'affiliates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('affiliate_code', sa.String(50), unique=True, nullable=False),
        sa.Column('commission_rate', sa.Numeric(5, 2), nullable=False, server_default='10.00'),
        sa.Column('tier', sa.String(50), server_default='standard'),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('minimum_payout', sa.Numeric(10, 2), server_default='50.00'),
        sa.Column('payment_schedule', sa.String(50), server_default='monthly'),
        sa.Column('joined_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('commission_rate >= 0 AND commission_rate <= 100', name='valid_commission_rate'),
        sa.CheckConstraint("status IN ('active', 'suspended', 'inactive')", name='valid_status')
    )

    # Create indexes for affiliates
    op.create_index('idx_affiliates_user_id', 'affiliates', ['user_id'])
    op.create_index('idx_affiliates_code', 'affiliates', ['affiliate_code'])
    op.create_index('idx_affiliates_status', 'affiliates', ['status'])

    # Create affiliate_rise_accounts table
    op.create_table(
        'affiliate_rise_accounts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('affiliate_id', UUID(as_uuid=True), sa.ForeignKey('affiliates.id'), nullable=False),
        sa.Column('rise_id', sa.String(255), unique=True, nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('kyc_status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('kyc_completed_at', sa.TIMESTAMP),
        sa.Column('invitation_sent_at', sa.TIMESTAMP),
        sa.Column('invitation_accepted_at', sa.TIMESTAMP),
        sa.Column('last_sync_at', sa.TIMESTAMP),
        sa.Column('metadata', JSONB),
        sa.Column('created_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "kyc_status IN ('pending', 'submitted', 'approved', 'rejected', 'expired')",
            name='valid_kyc_status'
        )
    )

    # Create indexes for affiliate_rise_accounts
    op.create_index('idx_rise_accounts_affiliate', 'affiliate_rise_accounts', ['affiliate_id'])
    op.create_index('idx_rise_accounts_rise_id', 'affiliate_rise_accounts', ['rise_id'])
    op.create_index('idx_rise_accounts_kyc_status', 'affiliate_rise_accounts', ['kyc_status'])

    # Create payment_batches table (must be created before commissions)
    op.create_table(
        'payment_batches',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('batch_number', sa.String(50), unique=True, nullable=False),
        sa.Column('payment_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False, server_default='0.00'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('scheduled_at', sa.TIMESTAMP, nullable=False),
        sa.Column('executed_at', sa.TIMESTAMP),
        sa.Column('completed_at', sa.TIMESTAMP),
        sa.Column('failed_at', sa.TIMESTAMP),
        sa.Column('error_message', sa.Text),
        sa.Column('metadata', JSONB),
        sa.Column('created_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('payment_count >= 0', name='valid_payment_count'),
        sa.CheckConstraint('total_amount >= 0', name='valid_total_amount'),
        sa.CheckConstraint("provider IN ('rise', 'mock')", name='valid_provider'),
        sa.CheckConstraint(
            "status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')",
            name='valid_batch_status'
        )
    )

    # Create indexes for payment_batches
    op.create_index('idx_batches_status', 'payment_batches', ['status'])
    op.create_index('idx_batches_scheduled', 'payment_batches', ['scheduled_at'])
    op.create_index('idx_batches_provider', 'payment_batches', ['provider'])
    op.create_index('idx_batches_number', 'payment_batches', ['batch_number'])

    # Create commissions table
    op.create_table(
        'commissions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('affiliate_id', UUID(as_uuid=True), sa.ForeignKey('affiliates.id'), nullable=False),
        sa.Column('subscription_id', UUID(as_uuid=True), sa.ForeignKey('subscriptions.id'), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('commission_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('payment_batch_id', UUID(as_uuid=True), sa.ForeignKey('payment_batches.id')),
        sa.Column('calculated_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column('approved_at', sa.TIMESTAMP),
        sa.Column('paid_at', sa.TIMESTAMP),
        sa.Column('metadata', JSONB),
        sa.CheckConstraint('amount >= 0', name='valid_amount'),
        sa.CheckConstraint(
            "commission_type IN ('new_subscription', 'renewal', 'upgrade', 'one_time')",
            name='valid_commission_type'
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'queued', 'paid', 'cancelled', 'failed')",
            name='valid_commission_status'
        )
    )

    # Create indexes for commissions
    op.create_index('idx_commissions_affiliate', 'commissions', ['affiliate_id'])
    op.create_index('idx_commissions_subscription', 'commissions', ['subscription_id'])
    op.create_index('idx_commissions_status', 'commissions', ['status'])
    op.create_index('idx_commissions_batch', 'commissions', ['payment_batch_id'])
    op.create_index('idx_commissions_calculated_at', 'commissions', ['calculated_at'])

    # Create payment_transactions table
    op.create_table(
        'payment_transactions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('batch_id', UUID(as_uuid=True), sa.ForeignKey('payment_batches.id'), nullable=False),
        sa.Column('commission_id', UUID(as_uuid=True), sa.ForeignKey('commissions.id'), nullable=False),
        sa.Column('transaction_id', sa.String(100), unique=True, nullable=False),
        sa.Column('provider_tx_id', sa.String(255)),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('payee_rise_id', sa.String(255)),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('retry_count', sa.Integer, server_default='0'),
        sa.Column('last_retry_at', sa.TIMESTAMP),
        sa.Column('error_message', sa.Text),
        sa.Column('metadata', JSONB),
        sa.Column('created_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.TIMESTAMP),
        sa.Column('failed_at', sa.TIMESTAMP),
        sa.CheckConstraint('amount > 0', name='valid_tx_amount'),
        sa.CheckConstraint("provider IN ('rise', 'mock')", name='valid_tx_provider'),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')",
            name='valid_tx_status'
        )
    )

    # Create indexes for payment_transactions
    op.create_index('idx_transactions_batch', 'payment_transactions', ['batch_id'])
    op.create_index('idx_transactions_commission', 'payment_transactions', ['commission_id'])
    op.create_index('idx_transactions_status', 'payment_transactions', ['status'])
    op.create_index('idx_transactions_provider_tx', 'payment_transactions', ['provider_tx_id'])
    op.create_index('idx_transactions_created_at', 'payment_transactions', ['created_at'])

    # Create webhook_events table
    op.create_table(
        'webhook_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('transaction_id', UUID(as_uuid=True), sa.ForeignKey('payment_transactions.id')),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('payload', JSONB, nullable=False),
        sa.Column('signature', sa.String(500)),
        sa.Column('hash', sa.String(500)),
        sa.Column('verified', sa.Boolean, server_default='false'),
        sa.Column('processed', sa.Boolean, server_default='false'),
        sa.Column('received_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column('processed_at', sa.TIMESTAMP),
        sa.Column('error_message', sa.Text),
        sa.CheckConstraint("provider IN ('rise', 'mock')", name='valid_webhook_provider')
    )

    # Create indexes for webhook_events
    op.create_index('idx_webhooks_transaction', 'webhook_events', ['transaction_id'])
    op.create_index('idx_webhooks_type', 'webhook_events', ['event_type'])
    op.create_index('idx_webhooks_processed', 'webhook_events', ['processed'])
    op.create_index('idx_webhooks_received', 'webhook_events', ['received_at'])

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('transaction_id', UUID(as_uuid=True), sa.ForeignKey('payment_transactions.id')),
        sa.Column('batch_id', UUID(as_uuid=True), sa.ForeignKey('payment_batches.id')),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('actor', sa.String(100)),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('details', JSONB),
        sa.Column('ip_address', INET),
        sa.Column('user_agent', sa.Text),
        sa.Column('created_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('success', 'failure', 'warning', 'info')", name='valid_audit_status')
    )

    # Create indexes for audit_logs
    op.create_index('idx_audit_transaction', 'audit_logs', ['transaction_id'])
    op.create_index('idx_audit_batch', 'audit_logs', ['batch_id'])
    op.create_index('idx_audit_action', 'audit_logs', ['action'])
    op.create_index('idx_audit_created', 'audit_logs', ['created_at'])


def downgrade():
    # Drop tables in reverse order
    op.drop_table('audit_logs')
    op.drop_table('webhook_events')
    op.drop_table('payment_transactions')
    op.drop_table('commissions')
    op.drop_table('payment_batches')
    op.drop_table('affiliate_rise_accounts')
    op.drop_table('affiliates')
```

### 1.2 Apply Migration

**Commands**:

```bash
# Navigate to backend
cd backend

# Generate migration (if using alembic auto-generate)
alembic revision --autogenerate -m "Add payment integration tables"

# Or manually create the file above

# Apply migration
alembic upgrade head

# Verify tables created
psql -h localhost -U postgres -d trading_alerts_v7 -c "\dt"
```

### 1.3 Verification Checklist

- [ ] All 7 tables created successfully
- [ ] All foreign key constraints working
- [ ] All check constraints functioning
- [ ] All indexes created
- [ ] Migration can be rolled back (test `alembic downgrade -1`)

---

## Phase 2: Core Models

### 2.1 Affiliate Model

**File**: `backend/app/models/affiliate.py`

```python
"""
Affiliate model for commission tracking
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, TIMESTAMP, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from app.database import Base


class Affiliate(Base):
    """
    Affiliate user who earns commissions from referrals
    """
    __tablename__ = 'affiliates'

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    affiliate_code = Column(String(50), unique=True, nullable=False, index=True)
    commission_rate = Column(Numeric(5, 2), nullable=False, default=Decimal('10.00'))
    tier = Column(String(50), default='standard')
    status = Column(String(50), nullable=False, default='active', index=True)
    minimum_payout = Column(Numeric(10, 2), default=Decimal('50.00'))
    payment_schedule = Column(String(50), default='monthly')
    joined_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="affiliate")
    rise_account = relationship("AffiliateRiseAccount", back_populates="affiliate", uselist=False)
    commissions = relationship("Commission", back_populates="affiliate")

    # Constraints
    __table_args__ = (
        CheckConstraint('commission_rate >= 0 AND commission_rate <= 100', name='valid_commission_rate'),
        CheckConstraint("status IN ('active', 'suspended', 'inactive')", name='valid_status'),
    )

    def __repr__(self) -> str:
        return f"<Affiliate {self.affiliate_code} - {self.status}>"

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'affiliate_code': self.affiliate_code,
            'commission_rate': float(self.commission_rate),
            'tier': self.tier,
            'status': self.status,
            'minimum_payout': float(self.minimum_payout),
            'payment_schedule': self.payment_schedule,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def is_active(self) -> bool:
        """Check if affiliate is active"""
        return self.status == 'active'

    def can_receive_payment(self, amount: Decimal) -> bool:
        """Check if affiliate can receive payment for given amount"""
        return self.is_active() and amount >= self.minimum_payout
```

### 2.2 AffiliateRiseAccount Model

**File**: `backend/app/models/affiliate_rise_account.py`

```python
"""
Affiliate Rise account model for payment integration
"""
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from sqlalchemy import Column, String, TIMESTAMP, Boolean, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class AffiliateRiseAccount(Base):
    """
    Rise.works account information for affiliate payouts
    """
    __tablename__ = 'affiliate_rise_accounts'

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    affiliate_id = Column(PGUUID(as_uuid=True), ForeignKey('affiliates.id'), nullable=False, index=True)
    rise_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=False)
    kyc_status = Column(String(50), nullable=False, default='pending', index=True)
    kyc_completed_at = Column(TIMESTAMP)
    invitation_sent_at = Column(TIMESTAMP)
    invitation_accepted_at = Column(TIMESTAMP)
    last_sync_at = Column(TIMESTAMP)
    metadata = Column(JSONB)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    affiliate = relationship("Affiliate", back_populates="rise_account")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "kyc_status IN ('pending', 'submitted', 'approved', 'rejected', 'expired')",
            name='valid_kyc_status'
        ),
    )

    def __repr__(self) -> str:
        return f"<AffiliateRiseAccount {self.rise_id} - {self.kyc_status}>"

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            'id': str(self.id),
            'affiliate_id': str(self.affiliate_id),
            'rise_id': self.rise_id,
            'email': self.email,
            'kyc_status': self.kyc_status,
            'kyc_completed_at': self.kyc_completed_at.isoformat() if self.kyc_completed_at else None,
            'invitation_sent_at': self.invitation_sent_at.isoformat() if self.invitation_sent_at else None,
            'invitation_accepted_at': self.invitation_accepted_at.isoformat() if self.invitation_accepted_at else None,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def is_kyc_approved(self) -> bool:
        """Check if KYC is approved"""
        return self.kyc_status == 'approved'

    def can_receive_payments(self) -> bool:
        """Check if account can receive payments"""
        return self.is_kyc_approved() and self.rise_id is not None
```

### 2.3 Commission Model

**File**: `backend/app/models/commission.py`

```python
"""
Commission model for affiliate earnings tracking
"""
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, TIMESTAMP, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class Commission(Base):
    """
    Commission earned by affiliate from subscription referrals
    """
    __tablename__ = 'commissions'

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    affiliate_id = Column(PGUUID(as_uuid=True), ForeignKey('affiliates.id'), nullable=False, index=True)
    subscription_id = Column(PGUUID(as_uuid=True), ForeignKey('subscriptions.id'), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default='USD')
    commission_type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default='pending', index=True)
    payment_batch_id = Column(PGUUID(as_uuid=True), ForeignKey('payment_batches.id'), index=True)
    calculated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, index=True)
    approved_at = Column(TIMESTAMP)
    paid_at = Column(TIMESTAMP)
    metadata = Column(JSONB)

    # Relationships
    affiliate = relationship("Affiliate", back_populates="commissions")
    subscription = relationship("Subscription", back_populates="commissions")
    payment_batch = relationship("PaymentBatch", back_populates="commissions")
    transactions = relationship("PaymentTransaction", back_populates="commission")

    # Constraints
    __table_args__ = (
        CheckConstraint('amount >= 0', name='valid_amount'),
        CheckConstraint(
            "commission_type IN ('new_subscription', 'renewal', 'upgrade', 'one_time')",
            name='valid_commission_type'
        ),
        CheckConstraint(
            "status IN ('pending', 'approved', 'queued', 'paid', 'cancelled', 'failed')",
            name='valid_commission_status'
        ),
    )

    def __repr__(self) -> str:
        return f"<Commission {self.id} - {self.amount} {self.currency} - {self.status}>"

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            'id': str(self.id),
            'affiliate_id': str(self.affiliate_id),
            'subscription_id': str(self.subscription_id),
            'amount': float(self.amount),
            'currency': self.currency,
            'commission_type': self.commission_type,
            'status': self.status,
            'payment_batch_id': str(self.payment_batch_id) if self.payment_batch_id else None,
            'calculated_at': self.calculated_at.isoformat() if self.calculated_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'metadata': self.metadata,
        }

    def is_pending(self) -> bool:
        """Check if commission is pending approval"""
        return self.status == 'pending'

    def is_payable(self) -> bool:
        """Check if commission can be paid"""
        return self.status in ['approved', 'queued']

    def approve(self) -> None:
        """Approve commission for payment"""
        if self.is_pending():
            self.status = 'approved'
            self.approved_at = datetime.utcnow()

    def mark_paid(self) -> None:
        """Mark commission as paid"""
        if self.is_payable():
            self.status = 'paid'
            self.paid_at = datetime.utcnow()

    def mark_failed(self) -> None:
        """Mark commission payment as failed"""
        if self.status == 'queued':
            self.status = 'failed'
```

### 2.4 PaymentBatch Model

**File**: `backend/app/models/payment_batch.py`

```python
"""
Payment batch model for grouping commission payments
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4
from decimal import Decimal
from sqlalchemy import Column, String, Integer, Numeric, TIMESTAMP, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class PaymentBatch(Base):
    """
    Batch of commission payments executed together
    """
    __tablename__ = 'payment_batches'

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    batch_number = Column(String(50), unique=True, nullable=False, index=True)
    payment_count = Column(Integer, nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=Decimal('0.00'))
    currency = Column(String(3), nullable=False, default='USD')
    provider = Column(String(50), nullable=False, index=True)
    status = Column(String(50), nullable=False, default='pending', index=True)
    scheduled_at = Column(TIMESTAMP, nullable=False, index=True)
    executed_at = Column(TIMESTAMP)
    completed_at = Column(TIMESTAMP)
    failed_at = Column(TIMESTAMP)
    error_message = Column(Text)
    metadata = Column(JSONB)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    commissions = relationship("Commission", back_populates="payment_batch")
    transactions = relationship("PaymentTransaction", back_populates="batch")
    audit_logs = relationship("AuditLog", back_populates="batch")

    # Constraints
    __table_args__ = (
        CheckConstraint('payment_count >= 0', name='valid_payment_count'),
        CheckConstraint('total_amount >= 0', name='valid_total_amount'),
        CheckConstraint("provider IN ('rise', 'mock')", name='valid_provider'),
        CheckConstraint(
            "status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')",
            name='valid_batch_status'
        ),
    )

    def __repr__(self) -> str:
        return f"<PaymentBatch {self.batch_number} - {self.status}>"

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            'id': str(self.id),
            'batch_number': self.batch_number,
            'payment_count': self.payment_count,
            'total_amount': float(self.total_amount),
            'currency': self.currency,
            'provider': self.provider,
            'status': self.status,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'executed_at': self.executed_at.isoformat() if self.executed_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'failed_at': self.failed_at.isoformat() if self.failed_at else None,
            'error_message': self.error_message,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def is_pending(self) -> bool:
        """Check if batch is pending execution"""
        return self.status == 'pending'

    def is_processing(self) -> bool:
        """Check if batch is currently processing"""
        return self.status == 'processing'

    def is_completed(self) -> bool:
        """Check if batch completed successfully"""
        return self.status == 'completed'

    def can_execute(self) -> bool:
        """Check if batch can be executed"""
        return self.status in ['pending', 'queued'] and self.payment_count > 0

    def start_processing(self) -> None:
        """Mark batch as processing"""
        if self.can_execute():
            self.status = 'processing'
            self.executed_at = datetime.utcnow()

    def mark_completed(self) -> None:
        """Mark batch as completed"""
        if self.is_processing():
            self.status = 'completed'
            self.completed_at = datetime.utcnow()

    def mark_failed(self, error_message: str) -> None:
        """Mark batch as failed"""
        if self.is_processing():
            self.status = 'failed'
            self.failed_at = datetime.utcnow()
            self.error_message = error_message

    @staticmethod
    def generate_batch_number() -> str:
        """Generate unique batch number"""
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        return f"BATCH-{timestamp}"
```

### 2.5 PaymentTransaction Model

**File**: `backend/app/models/payment_transaction.py`

```python
"""
Payment transaction model for individual payment tracking
"""
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from decimal import Decimal
from sqlalchemy import Column, String, Integer, Numeric, TIMESTAMP, Text, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class PaymentTransaction(Base):
    """
    Individual payment transaction record
    """
    __tablename__ = 'payment_transactions'

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    batch_id = Column(PGUUID(as_uuid=True), ForeignKey('payment_batches.id'), nullable=False, index=True)
    commission_id = Column(PGUUID(as_uuid=True), ForeignKey('commissions.id'), nullable=False, index=True)
    transaction_id = Column(String(100), unique=True, nullable=False)
    provider_tx_id = Column(String(255), index=True)
    provider = Column(String(50), nullable=False)
    payee_rise_id = Column(String(255))
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default='USD')
    status = Column(String(50), nullable=False, default='pending', index=True)
    retry_count = Column(Integer, default=0)
    last_retry_at = Column(TIMESTAMP)
    error_message = Column(Text)
    metadata = Column(JSONB)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, index=True)
    completed_at = Column(TIMESTAMP)
    failed_at = Column(TIMESTAMP)

    # Relationships
    batch = relationship("PaymentBatch", back_populates="transactions")
    commission = relationship("Commission", back_populates="transactions")
    webhook_events = relationship("WebhookEvent", back_populates="transaction")
    audit_logs = relationship("AuditLog", back_populates="transaction")

    # Constraints
    __table_args__ = (
        CheckConstraint('amount > 0', name='valid_tx_amount'),
        CheckConstraint("provider IN ('rise', 'mock')", name='valid_tx_provider'),
        CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')",
            name='valid_tx_status'
        ),
    )

    def __repr__(self) -> str:
        return f"<PaymentTransaction {self.transaction_id} - {self.amount} {self.currency} - {self.status}>"

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            'id': str(self.id),
            'batch_id': str(self.batch_id),
            'commission_id': str(self.commission_id),
            'transaction_id': self.transaction_id,
            'provider_tx_id': self.provider_tx_id,
            'provider': self.provider,
            'payee_rise_id': self.payee_rise_id,
            'amount': float(self.amount),
            'currency': self.currency,
            'status': self.status,
            'retry_count': self.retry_count,
            'last_retry_at': self.last_retry_at.isoformat() if self.last_retry_at else None,
            'error_message': self.error_message,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'failed_at': self.failed_at.isoformat() if self.failed_at else None,
        }

    def is_pending(self) -> bool:
        """Check if transaction is pending"""
        return self.status == 'pending'

    def is_processing(self) -> bool:
        """Check if transaction is processing"""
        return self.status == 'processing'

    def is_completed(self) -> bool:
        """Check if transaction completed successfully"""
        return self.status == 'completed'

    def is_failed(self) -> bool:
        """Check if transaction failed"""
        return self.status == 'failed'

    def can_retry(self, max_retries: int = 3) -> bool:
        """Check if transaction can be retried"""
        return self.is_failed() and self.retry_count < max_retries

    def start_processing(self) -> None:
        """Mark transaction as processing"""
        if self.is_pending():
            self.status = 'processing'

    def mark_completed(self, provider_tx_id: str) -> None:
        """Mark transaction as completed"""
        if self.is_processing():
            self.status = 'completed'
            self.provider_tx_id = provider_tx_id
            self.completed_at = datetime.utcnow()

    def mark_failed(self, error_message: str) -> None:
        """Mark transaction as failed"""
        if self.is_processing():
            self.status = 'failed'
            self.error_message = error_message
            self.failed_at = datetime.utcnow()

    def increment_retry(self) -> None:
        """Increment retry counter"""
        self.retry_count += 1
        self.last_retry_at = datetime.utcnow()
        self.status = 'pending'  # Reset to pending for retry

    @staticmethod
    def generate_transaction_id() -> str:
        """Generate unique transaction ID"""
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        return f"TX-{timestamp}-{uuid4().hex[:8].upper()}"
```

### 2.6 WebhookEvent Model

**File**: `backend/app/models/webhook_event.py`

```python
"""
Webhook event model for tracking external payment notifications
"""
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Boolean, TIMESTAMP, Text, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class WebhookEvent(Base):
    """
    Webhook event received from payment provider
    """
    __tablename__ = 'webhook_events'

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    transaction_id = Column(PGUUID(as_uuid=True), ForeignKey('payment_transactions.id'), index=True)
    event_type = Column(String(100), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    payload = Column(JSONB, nullable=False)
    signature = Column(String(500))
    hash = Column(String(500))
    verified = Column(Boolean, default=False, index=True)
    processed = Column(Boolean, default=False, index=True)
    received_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, index=True)
    processed_at = Column(TIMESTAMP)
    error_message = Column(Text)

    # Relationships
    transaction = relationship("PaymentTransaction", back_populates="webhook_events")

    # Constraints
    __table_args__ = (
        CheckConstraint("provider IN ('rise', 'mock')", name='valid_webhook_provider'),
    )

    def __repr__(self) -> str:
        return f"<WebhookEvent {self.event_type} - {self.verified}/{self.processed}>"

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            'id': str(self.id),
            'transaction_id': str(self.transaction_id) if self.transaction_id else None,
            'event_type': self.event_type,
            'provider': self.provider,
            'payload': self.payload,
            'signature': self.signature,
            'hash': self.hash,
            'verified': self.verified,
            'processed': self.processed,
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'error_message': self.error_message,
        }

    def is_verified(self) -> bool:
        """Check if webhook signature is verified"""
        return self.verified

    def is_processed(self) -> bool:
        """Check if webhook has been processed"""
        return self.processed

    def can_process(self) -> bool:
        """Check if webhook can be processed"""
        return self.is_verified() and not self.is_processed()

    def mark_verified(self) -> None:
        """Mark webhook as verified"""
        self.verified = True

    def mark_processed(self) -> None:
        """Mark webhook as processed"""
        if self.can_process():
            self.processed = True
            self.processed_at = datetime.utcnow()

    def mark_failed(self, error_message: str) -> None:
        """Mark webhook processing as failed"""
        self.error_message = error_message
        self.processed_at = datetime.utcnow()
```

### 2.7 AuditLog Model

**File**: `backend/app/models/audit_log.py`

```python
"""
Audit log model for compliance and debugging
"""
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from sqlalchemy import Column, String, TIMESTAMP, Text, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB, INET
from sqlalchemy.orm import relationship
from app.database import Base


class AuditLog(Base):
    """
    Audit trail for payment operations
    """
    __tablename__ = 'audit_logs'

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    transaction_id = Column(PGUUID(as_uuid=True), ForeignKey('payment_transactions.id'), index=True)
    batch_id = Column(PGUUID(as_uuid=True), ForeignKey('payment_batches.id'), index=True)
    action = Column(String(100), nullable=False, index=True)
    actor = Column(String(100))
    status = Column(String(50), nullable=False)
    details = Column(JSONB)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    transaction = relationship("PaymentTransaction", back_populates="audit_logs")
    batch = relationship("PaymentBatch", back_populates="audit_logs")

    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('success', 'failure', 'warning', 'info')", name='valid_audit_status'),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} - {self.status}>"

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            'id': str(self.id),
            'transaction_id': str(self.transaction_id) if self.transaction_id else None,
            'batch_id': str(self.batch_id) if self.batch_id else None,
            'action': self.action,
            'actor': self.actor,
            'status': self.status,
            'details': self.details,
            'ip_address': str(self.ip_address) if self.ip_address else None,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @staticmethod
    def log_action(
        action: str,
        status: str,
        actor: Optional[str] = None,
        transaction_id: Optional[UUID] = None,
        batch_id: Optional[UUID] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> 'AuditLog':
        """
        Helper method to create audit log entry
        """
        return AuditLog(
            action=action,
            status=status,
            actor=actor,
            transaction_id=transaction_id,
            batch_id=batch_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
```

### 2.8 Update Model Imports

**File**: `backend/app/models/__init__.py`

```python
"""
Database models for Trading Alerts SaaS V7
"""
# Existing models
from app.models.user import User
from app.models.subscription import Subscription

# Payment integration models
from app.models.affiliate import Affiliate
from app.models.affiliate_rise_account import AffiliateRiseAccount
from app.models.commission import Commission
from app.models.payment_batch import PaymentBatch
from app.models.payment_transaction import PaymentTransaction
from app.models.webhook_event import WebhookEvent
from app.models.audit_log import AuditLog

__all__ = [
    'User',
    'Subscription',
    'Affiliate',
    'AffiliateRiseAccount',
    'Commission',
    'PaymentBatch',
    'PaymentTransaction',
    'WebhookEvent',
    'AuditLog',
]
```

### 2.9 Verification Checklist

- [ ] All 7 models created
- [ ] All relationships configured
- [ ] All methods implemented
- [ ] Type hints added throughout
- [ ] Docstrings for all classes and methods
- [ ] Models can be imported successfully
- [ ] No circular import issues

---

## Phase 3: Provider Abstraction Layer

### 3.1 Base Payment Provider Interface

**File**: `backend/app/services/payment/base_provider.py`

```python
"""
Abstract base class for payment providers
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from decimal import Decimal
from dataclasses import dataclass
from datetime import datetime


@dataclass
class PaymentIntent:
    """Payment intent data structure"""
    payee_id: str
    amount: Decimal
    currency: str
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class PaymentResult:
    """Payment execution result"""
    success: bool
    transaction_id: str
    provider_tx_id: Optional[str] = None
    status: str = 'completed'
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class BatchPaymentResult:
    """Batch payment execution result"""
    success: bool
    batch_id: str
    total_count: int
    success_count: int
    failure_count: int
    results: List[PaymentResult]
    error_message: Optional[str] = None


@dataclass
class PaymentStatus:
    """Payment status information"""
    transaction_id: str
    status: str  # pending, processing, completed, failed
    amount: Decimal
    currency: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


@dataclass
class PayeeInfo:
    """Payee account information"""
    payee_id: str
    email: str
    kyc_status: str
    can_receive_payments: bool
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class WebhookEvent:
    """Webhook event data structure"""
    event_type: str
    payload: Dict[str, Any]
    signature: Optional[str] = None
    hash: Optional[str] = None


@dataclass
class WebhookResponse:
    """Webhook processing response"""
    acknowledged: bool
    processed: bool
    error_message: Optional[str] = None


class PaymentProvider(ABC):
    """
    Abstract base class defining payment provider interface

    All payment providers must implement these methods to ensure
    consistent behavior across different payment backends.
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize payment provider with configuration

        Args:
            config: Provider-specific configuration dictionary
        """
        self.config = config
        self._authenticated = False

    @abstractmethod
    async def authenticate(self) -> bool:
        """
        Authenticate with payment provider

        Returns:
            bool: True if authentication successful

        Raises:
            AuthenticationError: If authentication fails
        """
        pass

    @abstractmethod
    async def send_payment(
        self,
        payee_id: str,
        amount: Decimal,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> PaymentResult:
        """
        Send single payment to payee

        Args:
            payee_id: Identifier for payment recipient
            amount: Payment amount
            currency: Currency code (e.g., 'USD')
            metadata: Optional metadata for payment

        Returns:
            PaymentResult: Result of payment execution

        Raises:
            PaymentError: If payment fails
            InsufficientFundsError: If balance too low
            InvalidPayeeError: If payee not found
        """
        pass

    @abstractmethod
    async def send_batch_payment(
        self,
        payments: List[PaymentIntent]
    ) -> BatchPaymentResult:
        """
        Send batch of payments

        Args:
            payments: List of payment intents to execute

        Returns:
            BatchPaymentResult: Results of batch execution

        Raises:
            PaymentError: If batch execution fails
        """
        pass

    @abstractmethod
    async def get_payment_status(
        self,
        transaction_id: str
    ) -> PaymentStatus:
        """
        Get status of payment transaction

        Args:
            transaction_id: Internal transaction identifier

        Returns:
            PaymentStatus: Current payment status

        Raises:
            TransactionNotFoundError: If transaction doesn't exist
        """
        pass

    @abstractmethod
    async def get_payee_info(
        self,
        payee_id: str
    ) -> PayeeInfo:
        """
        Get information about payee account

        Args:
            payee_id: Payee identifier

        Returns:
            PayeeInfo: Payee account information

        Raises:
            PayeeNotFoundError: If payee doesn't exist
        """
        pass

    @abstractmethod
    async def handle_webhook(
        self,
        event: WebhookEvent
    ) -> WebhookResponse:
        """
        Process webhook event from provider

        Args:
            event: Webhook event data

        Returns:
            WebhookResponse: Processing result

        Raises:
            WebhookValidationError: If webhook invalid
        """
        pass

    def is_authenticated(self) -> bool:
        """Check if provider is authenticated"""
        return self._authenticated

    @property
    def provider_name(self) -> str:
        """Get provider name"""
        return self.__class__.__name__


# Custom exceptions
class PaymentError(Exception):
    """Base payment error"""
    pass


class AuthenticationError(PaymentError):
    """Authentication failed"""
    pass


class InsufficientFundsError(PaymentError):
    """Insufficient balance"""
    pass


class InvalidPayeeError(PaymentError):
    """Payee not found or invalid"""
    pass


class TransactionNotFoundError(PaymentError):
    """Transaction not found"""
    pass


class PayeeNotFoundError(PaymentError):
    """Payee not found"""
    pass


class WebhookValidationError(PaymentError):
    """Webhook validation failed"""
    pass
```

### 3.2 Provider Factory

**File**: `backend/app/services/payment/provider_factory.py`

```python
"""
Factory for creating payment provider instances
"""
from typing import Dict, Any, Type, Optional
import os
from app.services.payment.base_provider import PaymentProvider


class PaymentProviderFactory:
    """
    Factory for creating and managing payment provider instances
    """
    _providers: Dict[str, Type[PaymentProvider]] = {}
    _instances: Dict[str, PaymentProvider] = {}

    @classmethod
    def register_provider(cls, name: str, provider_class: Type[PaymentProvider]) -> None:
        """
        Register a payment provider class

        Args:
            name: Provider identifier (e.g., 'mock', 'rise')
            provider_class: Provider class to register
        """
        cls._providers[name.lower()] = provider_class

    @classmethod
    def create_provider(
        cls,
        provider_name: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> PaymentProvider:
        """
        Create payment provider instance

        Args:
            provider_name: Name of provider to create (defaults to env var)
            config: Provider configuration (defaults to env-based config)

        Returns:
            PaymentProvider: Configured provider instance

        Raises:
            ValueError: If provider not registered
        """
        # Determine provider from environment if not specified
        if provider_name is None:
            provider_name = os.getenv('PAYMENT_PROVIDER', 'mock').lower()
        else:
            provider_name = provider_name.lower()

        # Check if provider is registered
        if provider_name not in cls._providers:
            raise ValueError(
                f"Payment provider '{provider_name}' not registered. "
                f"Available providers: {list(cls._providers.keys())}"
            )

        # Return cached instance if exists
        if provider_name in cls._instances:
            return cls._instances[provider_name]

        # Create configuration if not provided
        if config is None:
            config = cls._get_provider_config(provider_name)

        # Create new instance
        provider_class = cls._providers[provider_name]
        instance = provider_class(config)

        # Cache instance
        cls._instances[provider_name] = instance

        return instance

    @classmethod
    def get_provider(cls, provider_name: Optional[str] = None) -> PaymentProvider:
        """
        Get existing provider instance or create new one

        Args:
            provider_name: Name of provider (defaults to env var)

        Returns:
            PaymentProvider: Provider instance
        """
        return cls.create_provider(provider_name)

    @classmethod
    def clear_instances(cls) -> None:
        """Clear all cached provider instances"""
        cls._instances.clear()

    @staticmethod
    def _get_provider_config(provider_name: str) -> Dict[str, Any]:
        """
        Get provider configuration from environment variables

        Args:
            provider_name: Name of provider

        Returns:
            dict: Provider configuration
        """
        if provider_name == 'mock':
            return {
                'enabled': True,
                'simulated_delay': float(os.getenv('MOCK_PAYMENT_DELAY', '2')),
                'failure_rate': float(os.getenv('MOCK_FAILURE_RATE', '0.0')),
            }

        elif provider_name == 'rise':
            return {
                'enabled': os.getenv('RISE_ENABLED', 'false').lower() == 'true',
                'environment': os.getenv('RISE_ENVIRONMENT', 'staging'),
                'base_url': os.getenv('RISE_API_BASE_URL', 'https://b2b-api.staging-riseworks.io/v1'),
                'wallet_address': os.getenv('RISE_WALLET_ADDRESS', ''),
                'wallet_private_key': os.getenv('RISE_WALLET_PRIVATE_KEY', ''),
                'company_rise_id': os.getenv('RISE_COMPANY_ID', ''),
                'manager_email': os.getenv('RISE_MANAGER_EMAIL', ''),
                'signer_address': os.getenv('RISE_SIGNER_ADDRESS', ''),
                'timeout': int(os.getenv('RISE_API_TIMEOUT', '30')),
                'retry_attempts': int(os.getenv('RISE_RETRY_ATTEMPTS', '3')),
                'max_batch_size': int(os.getenv('RISE_MAX_BATCH_SIZE', '100')),
            }

        else:
            raise ValueError(f"Unknown provider: {provider_name}")


# Convenience function
def get_payment_provider(provider_name: Optional[str] = None) -> PaymentProvider:
    """
    Get payment provider instance

    Args:
        provider_name: Optional provider name (defaults to env var)

    Returns:
        PaymentProvider: Configured provider instance
    """
    return PaymentProviderFactory.get_provider(provider_name)
```

### 3.3 Verification Checklist

- [ ] Base provider interface created with all abstract methods
- [ ] Data classes defined for all operations
- [ ] Custom exceptions defined
- [ ] Provider factory implemented
- [ ] Factory can read environment variables
- [ ] Type hints complete
- [ ] Docstrings complete

---

## Phase 4: Mock Payment Provider

### 4.1 Mock Provider Implementation

**File**: `backend/app/services/payment/mock_provider.py`

```python
"""
Mock payment provider for testing and development
"""
import asyncio
import random
import logging
from typing import List, Dict, Optional, Any
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import uuid4

from app.services.payment.base_provider import (
    PaymentProvider,
    PaymentIntent,
    PaymentResult,
    BatchPaymentResult,
    PaymentStatus,
    PayeeInfo,
    WebhookEvent,
    WebhookResponse,
    PaymentError,
    InvalidPayeeError,
    InsufficientFundsError,
    TransactionNotFoundError,
)

logger = logging.getLogger(__name__)


class MockPaymentProvider(PaymentProvider):
    """
    Mock payment provider for testing without external dependencies

    Features:
    - Simulates successful payments
    - Configurable failure scenarios
    - Realistic delays
    - Transaction tracking
    - Webhook simulation
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize mock provider

        Args:
            config: Configuration dictionary with optional:
                - simulated_delay: Delay in seconds (default: 2)
                - failure_rate: Probability of failure 0-1 (default: 0.0)
                - simulate_webhooks: Whether to trigger webhooks (default: True)
        """
        super().__init__(config)
        self.simulated_delay = config.get('simulated_delay', 2)
        self.failure_rate = config.get('failure_rate', 0.0)
        self.simulate_webhooks = config.get('simulate_webhooks', True)

        # In-memory storage for testing
        self._transactions: Dict[str, Dict[str, Any]] = {}
        self._payees: Dict[str, Dict[str, Any]] = {}

        logger.info(
            f"Mock payment provider initialized "
            f"(delay={self.simulated_delay}s, failure_rate={self.failure_rate})"
        )

    async def authenticate(self) -> bool:
        """
        Simulate authentication (always succeeds)

        Returns:
            bool: True (mock always authenticates)
        """
        logger.info("Mock provider: Simulating authentication")
        await asyncio.sleep(0.5)  # Small delay
        self._authenticated = True
        logger.info("Mock provider: Authentication successful")
        return True

    async def send_payment(
        self,
        payee_id: str,
        amount: Decimal,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> PaymentResult:
        """
        Simulate sending single payment

        Args:
            payee_id: Payee identifier
            amount: Payment amount
            currency: Currency code
            metadata: Optional metadata

        Returns:
            PaymentResult: Simulated payment result
        """
        logger.info(f"Mock provider: Processing payment to {payee_id} for {amount} {currency}")

        # Simulate processing delay
        await asyncio.sleep(self.simulated_delay)

        # Generate transaction IDs
        transaction_id = f"MOCK-TX-{uuid4().hex[:12].upper()}"
        provider_tx_id = f"MOCK-PROVIDER-{uuid4().hex[:16].upper()}"

        # Simulate random failure based on failure_rate
        if random.random() < self.failure_rate:
            logger.warning(f"Mock provider: Simulated failure for {transaction_id}")

            error_messages = [
                "Simulated network timeout",
                "Simulated insufficient funds",
                "Simulated invalid payee",
                "Simulated rate limit exceeded",
            ]
            error_message = random.choice(error_messages)

            # Store failed transaction
            self._transactions[transaction_id] = {
                'transaction_id': transaction_id,
                'payee_id': payee_id,
                'amount': float(amount),
                'currency': currency,
                'status': 'failed',
                'created_at': datetime.utcnow(),
                'error_message': error_message,
                'metadata': metadata,
            }

            return PaymentResult(
                success=False,
                transaction_id=transaction_id,
                provider_tx_id=provider_tx_id,
                status='failed',
                error_message=error_message,
                metadata=metadata,
            )

        # Success case
        logger.info(f"Mock provider: Payment successful - {transaction_id}")

        # Store successful transaction
        self._transactions[transaction_id] = {
            'transaction_id': transaction_id,
            'provider_tx_id': provider_tx_id,
            'payee_id': payee_id,
            'amount': float(amount),
            'currency': currency,
            'status': 'completed',
            'created_at': datetime.utcnow(),
            'completed_at': datetime.utcnow(),
            'metadata': metadata,
        }

        # Simulate webhook if enabled
        if self.simulate_webhooks:
            asyncio.create_task(self._simulate_webhook(transaction_id, 'payment.completed'))

        return PaymentResult(
            success=True,
            transaction_id=transaction_id,
            provider_tx_id=provider_tx_id,
            status='completed',
            metadata=metadata,
        )

    async def send_batch_payment(
        self,
        payments: List[PaymentIntent]
    ) -> BatchPaymentResult:
        """
        Simulate sending batch payment

        Args:
            payments: List of payment intents

        Returns:
            BatchPaymentResult: Simulated batch result
        """
        logger.info(f"Mock provider: Processing batch payment with {len(payments)} payments")

        batch_id = f"MOCK-BATCH-{uuid4().hex[:12].upper()}"
        results: List[PaymentResult] = []
        success_count = 0
        failure_count = 0

        # Process each payment
        for payment in payments:
            result = await self.send_payment(
                payee_id=payment.payee_id,
                amount=payment.amount,
                currency=payment.currency,
                metadata=payment.metadata,
            )
            results.append(result)

            if result.success:
                success_count += 1
            else:
                failure_count += 1

        success = failure_count == 0

        logger.info(
            f"Mock provider: Batch {batch_id} completed - "
            f"{success_count} success, {failure_count} failed"
        )

        return BatchPaymentResult(
            success=success,
            batch_id=batch_id,
            total_count=len(payments),
            success_count=success_count,
            failure_count=failure_count,
            results=results,
        )

    async def get_payment_status(
        self,
        transaction_id: str
    ) -> PaymentStatus:
        """
        Get simulated payment status

        Args:
            transaction_id: Transaction identifier

        Returns:
            PaymentStatus: Transaction status

        Raises:
            TransactionNotFoundError: If transaction not found
        """
        logger.info(f"Mock provider: Fetching status for {transaction_id}")

        if transaction_id not in self._transactions:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")

        tx = self._transactions[transaction_id]

        return PaymentStatus(
            transaction_id=tx['transaction_id'],
            status=tx['status'],
            amount=Decimal(str(tx['amount'])),
            currency=tx['currency'],
            created_at=tx['created_at'],
            completed_at=tx.get('completed_at'),
            error_message=tx.get('error_message'),
        )

    async def get_payee_info(
        self,
        payee_id: str
    ) -> PayeeInfo:
        """
        Get simulated payee information

        Args:
            payee_id: Payee identifier

        Returns:
            PayeeInfo: Payee information
        """
        logger.info(f"Mock provider: Fetching payee info for {payee_id}")

        # Check if payee exists in cache
        if payee_id in self._payees:
            payee = self._payees[payee_id]
        else:
            # Create mock payee
            payee = {
                'payee_id': payee_id,
                'email': f'mock-{payee_id}@example.com',
                'kyc_status': 'approved',
                'can_receive_payments': True,
            }
            self._payees[payee_id] = payee

        return PayeeInfo(
            payee_id=payee['payee_id'],
            email=payee['email'],
            kyc_status=payee['kyc_status'],
            can_receive_payments=payee['can_receive_payments'],
        )

    async def handle_webhook(
        self,
        event: WebhookEvent
    ) -> WebhookResponse:
        """
        Handle simulated webhook event

        Args:
            event: Webhook event

        Returns:
            WebhookResponse: Processing response
        """
        logger.info(f"Mock provider: Handling webhook event {event.event_type}")

        # Mock webhooks are always valid
        return WebhookResponse(
            acknowledged=True,
            processed=True,
        )

    async def _simulate_webhook(self, transaction_id: str, event_type: str) -> None:
        """
        Simulate webhook delivery (for testing)

        Args:
            transaction_id: Transaction ID
            event_type: Event type
        """
        # This would trigger a webhook to our system
        # In real implementation, this would POST to /webhooks/rise
        logger.info(f"Mock provider: Simulating webhook {event_type} for {transaction_id}")

        # Small delay before webhook
        await asyncio.sleep(1)

        # Webhook payload
        payload = {
            'event_type': event_type,
            'transaction_id': transaction_id,
            'timestamp': datetime.utcnow().isoformat(),
            'provider': 'mock',
        }

        logger.info(f"Mock provider: Webhook payload: {payload}")

    def configure_scenario(self, scenario: str) -> None:
        """
        Configure testing scenario

        Args:
            scenario: Scenario name ('success', 'partial_failure', 'timeout', etc.)
        """
        scenarios = {
            'success': {'failure_rate': 0.0, 'simulated_delay': 1},
            'partial_failure': {'failure_rate': 0.2, 'simulated_delay': 2},
            'high_failure': {'failure_rate': 0.8, 'simulated_delay': 2},
            'timeout': {'failure_rate': 0.0, 'simulated_delay': 10},
            'fast': {'failure_rate': 0.0, 'simulated_delay': 0.1},
        }

        if scenario in scenarios:
            config = scenarios[scenario]
            self.failure_rate = config['failure_rate']
            self.simulated_delay = config['simulated_delay']
            logger.info(f"Mock provider: Configured for scenario '{scenario}'")
        else:
            logger.warning(f"Mock provider: Unknown scenario '{scenario}'")

    def reset(self) -> None:
        """Reset mock provider state (useful for testing)"""
        self._transactions.clear()
        self._payees.clear()
        logger.info("Mock provider: State reset")


# Register mock provider with factory
from app.services.payment.provider_factory import PaymentProviderFactory
PaymentProviderFactory.register_provider('mock', MockPaymentProvider)
```

### 4.2 Verification Checklist

- [ ] Mock provider implements all abstract methods
- [ ] Simulates realistic delays
- [ ] Supports configurable failure scenarios
- [ ] Tracks transactions in memory
- [ ] Generates realistic IDs
- [ ] Registers with factory
- [ ] Comprehensive logging
- [ ] Type hints complete

---

---

## Phase 5: Rise Payment Client

### 5.1 Ethereum Wallet Utilities

**File**: `backend/app/utils/eth_wallet.py`

```python
"""
Ethereum wallet utilities for Rise API authentication
"""
import os
import logging
from typing import Dict, Any, Optional
from eth_account import Account
from eth_account.messages import encode_defunct, encode_structured_data
from web3 import Web3

logger = logging.getLogger(__name__)


class EthWallet:
    """
    Ethereum wallet for signing messages and transactions
    """

    def __init__(self, private_key: str):
        """
        Initialize wallet with private key

        Args:
            private_key: Ethereum private key (with or without 0x prefix)
        """
        # Ensure private key has 0x prefix
        if not private_key.startswith('0x'):
            private_key = f'0x{private_key}'

        self.private_key = private_key
        self.account = Account.from_key(private_key)
        self.address = self.account.address

        logger.info(f"Ethereum wallet initialized: {self.address}")

    def sign_message(self, message: str) -> str:
        """
        Sign a plain text message (for SIWE authentication)

        Args:
            message: Message to sign

        Returns:
            str: Hex-encoded signature
        """
        message_encoded = encode_defunct(text=message)
        signed_message = self.account.sign_message(message_encoded)
        signature = signed_message.signature.hex()

        logger.debug(f"Message signed: {message[:50]}...")
        return signature

    def sign_typed_data(self, typed_data: Dict[str, Any]) -> str:
        """
        Sign EIP-712 typed data (for Rise payments)

        Args:
            typed_data: Structured data following EIP-712 format

        Returns:
            str: Hex-encoded signature
        """
        # Encode according to EIP-712
        signable_message = encode_structured_data(typed_data)

        # Sign the message
        signed_message = self.account.sign_message(signable_message)
        signature = signed_message.signature.hex()

        logger.debug(f"Typed data signed for domain: {typed_data.get('domain', {}).get('name')}")
        return signature

    def verify_signature(self, message: str, signature: str) -> bool:
        """
        Verify a signature against this wallet

        Args:
            message: Original message
            signature: Signature to verify

        Returns:
            bool: True if signature is valid
        """
        try:
            message_encoded = encode_defunct(text=message)
            recovered_address = Account.recover_message(message_encoded, signature=signature)
            is_valid = recovered_address.lower() == self.address.lower()

            logger.debug(f"Signature verification: {is_valid}")
            return is_valid

        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            return False

    @staticmethod
    def recover_address_from_signature(message: str, signature: str) -> str:
        """
        Recover Ethereum address from signature

        Args:
            message: Original message
            signature: Signature

        Returns:
            str: Recovered Ethereum address
        """
        message_encoded = encode_defunct(text=message)
        recovered_address = Account.recover_message(message_encoded, signature=signature)
        return recovered_address

    @staticmethod
    def is_valid_address(address: str) -> bool:
        """
        Check if string is valid Ethereum address

        Args:
            address: Address to validate

        Returns:
            bool: True if valid Ethereum address
        """
        return Web3.is_address(address)

    @staticmethod
    def checksum_address(address: str) -> str:
        """
        Convert address to checksummed format

        Args:
            address: Ethereum address

        Returns:
            str: Checksummed address
        """
        return Web3.to_checksum_address(address)
```

### 5.2 Cryptographic Utilities

**File**: `backend/app/utils/crypto.py`

```python
"""
Cryptographic utilities for payment system
"""
import hashlib
import hmac
import secrets
from typing import Any, Dict
import json
from Crypto.Hash import keccak


def keccak256(data: bytes) -> str:
    """
    Calculate Keccak-256 hash (used by Ethereum)

    Args:
        data: Data to hash

    Returns:
        str: Hex-encoded hash with 0x prefix
    """
    k = keccak.new(digest_bits=256)
    k.update(data)
    return '0x' + k.hexdigest()


def keccak256_string(text: str) -> str:
    """
    Calculate Keccak-256 hash of string

    Args:
        text: String to hash

    Returns:
        str: Hex-encoded hash with 0x prefix
    """
    return keccak256(text.encode('utf-8'))


def keccak256_dict(data: Dict[str, Any]) -> str:
    """
    Calculate Keccak-256 hash of dictionary (JSON)

    Args:
        data: Dictionary to hash

    Returns:
        str: Hex-encoded hash with 0x prefix
    """
    json_str = json.dumps(data, sort_keys=True, separators=(',', ':'))
    return keccak256_string(json_str)


def generate_salt() -> str:
    """
    Generate random salt for transactions

    Returns:
        str: Random hex string
    """
    return secrets.token_hex(32)


def hmac_sha256(key: str, message: str) -> str:
    """
    Calculate HMAC-SHA256

    Args:
        key: Secret key
        message: Message to sign

    Returns:
        str: Hex-encoded HMAC
    """
    return hmac.new(
        key.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()


def verify_hmac(key: str, message: str, signature: str) -> bool:
    """
    Verify HMAC signature

    Args:
        key: Secret key
        message: Original message
        signature: HMAC signature to verify

    Returns:
        bool: True if valid
    """
    expected = hmac_sha256(key, message)
    return hmac.compare_digest(expected, signature)
```

### 5.3 Rise Payment Client

**File**: `backend/app/services/payment/rise_provider.py`

```python
"""
Rise.works payment provider implementation
"""
import asyncio
import aiohttp
import logging
from typing import List, Dict, Optional, Any
from decimal import Decimal
from datetime import datetime
import time

from app.services.payment.base_provider import (
    PaymentProvider,
    PaymentIntent,
    PaymentResult,
    BatchPaymentResult,
    PaymentStatus,
    PayeeInfo,
    WebhookEvent,
    WebhookResponse,
    AuthenticationError,
    PaymentError,
    InvalidPayeeError,
    TransactionNotFoundError,
    WebhookValidationError,
)
from app.utils.eth_wallet import EthWallet
from app.utils.crypto import keccak256_dict, generate_salt

logger = logging.getLogger(__name__)


class RisePaymentProvider(PaymentProvider):
    """
    Rise.works payment provider implementation

    Integrates with Rise B2B API for global payments using:
    - SIWE (Sign-In with Ethereum) authentication
    - EIP-712 typed data signing for payments
    - Webhook verification for async notifications
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize Rise provider

        Args:
            config: Configuration with required keys:
                - base_url: Rise API base URL
                - wallet_address: Ethereum wallet address
                - wallet_private_key: Private key for signing
                - company_rise_id: Company RiseID
                - timeout: API timeout in seconds
                - retry_attempts: Number of retry attempts
                - max_batch_size: Maximum batch size
        """
        super().__init__(config)

        # Configuration
        self.base_url = config['base_url'].rstrip('/')
        self.wallet_address = config['wallet_address']
        self.wallet_private_key = config['wallet_private_key']
        self.company_rise_id = config['company_rise_id']
        self.timeout = config.get('timeout', 30)
        self.retry_attempts = config.get('retry_attempts', 3)
        self.max_batch_size = config.get('max_batch_size', 100)
        self.signer_address = config.get('signer_address', '')

        # Initialize Ethereum wallet
        self.wallet = EthWallet(self.wallet_private_key)

        # Authentication state
        self._auth_token: Optional[str] = None
        self._auth_expiry: Optional[float] = None

        # HTTP session
        self._session: Optional[aiohttp.ClientSession] = None

        logger.info(f"Rise provider initialized for wallet: {self.wallet.address}")

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def _close_session(self) -> None:
        """Close HTTP session"""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def authenticate(self) -> bool:
        """
        Authenticate with Rise API using SIWE (Sign-In with Ethereum)

        Process:
        1. GET /auth/api/siwe?wallet={address} - Get message to sign
        2. Sign message with wallet
        3. POST /auth/api/siwe - Submit signature, receive JWT

        Returns:
            bool: True if authentication successful

        Raises:
            AuthenticationError: If authentication fails
        """
        try:
            logger.info("Rise provider: Starting SIWE authentication")
            session = await self._get_session()

            # Step 1: Get message to sign
            siwe_url = f"{self.base_url}/auth/api/siwe"
            params = {'wallet': self.wallet.address}

            async with session.get(siwe_url, params=params) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise AuthenticationError(f"Failed to get SIWE message: {error_text}")

                data = await response.json()
                message = data.get('message')

                if not message:
                    raise AuthenticationError("No message returned from SIWE endpoint")

            logger.debug(f"Rise provider: Received SIWE message: {message[:100]}...")

            # Step 2: Sign message
            signature = self.wallet.sign_message(message)

            # Step 3: Submit signature
            auth_payload = {
                'signature': signature,
                'message': message,
            }

            async with session.post(siwe_url, json=auth_payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise AuthenticationError(f"SIWE authentication failed: {error_text}")

                auth_data = await response.json()
                self._auth_token = auth_data.get('token')

                if not self._auth_token:
                    raise AuthenticationError("No auth token returned")

            # Set expiry (24 hours from now)
            self._auth_expiry = time.time() + (24 * 60 * 60)
            self._authenticated = True

            logger.info("Rise provider: Authentication successful")
            return True

        except aiohttp.ClientError as e:
            logger.error(f"Rise provider: Network error during authentication: {e}")
            raise AuthenticationError(f"Network error: {e}")

        except Exception as e:
            logger.error(f"Rise provider: Authentication error: {e}")
            raise AuthenticationError(str(e))

    async def _ensure_authenticated(self) -> None:
        """Ensure valid authentication, re-authenticate if needed"""
        if not self._authenticated or self._is_token_expired():
            await self.authenticate()

    def _is_token_expired(self) -> bool:
        """Check if auth token is expired"""
        if self._auth_expiry is None:
            return True
        return time.time() >= self._auth_expiry

    def _get_auth_headers(self) -> Dict[str, str]:
        """Get headers with authentication token"""
        if not self._auth_token:
            raise AuthenticationError("Not authenticated")

        return {
            'Authorization': f'Bearer {self._auth_token}',
            'Content-Type': 'application/json',
        }

    async def send_payment(
        self,
        payee_id: str,
        amount: Decimal,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> PaymentResult:
        """
        Send payment via Rise API

        Process:
        1. PUT /payments/pay - Request payment intent, receive TypedData
        2. Sign TypedData with wallet
        3. POST /payments/pay - Execute payment with signature

        Args:
            payee_id: Payee's RiseID
            amount: Payment amount
            currency: Currency code
            metadata: Optional metadata

        Returns:
            PaymentResult: Payment execution result

        Raises:
            PaymentError: If payment fails
        """
        await self._ensure_authenticated()

        try:
            logger.info(f"Rise provider: Initiating payment to {payee_id} for {amount} {currency}")
            session = await self._get_session()
            headers = self._get_auth_headers()

            # Generate unique salt
            salt = generate_salt()

            # Step 1: Request payment intent
            payment_intent = {
                'payeeRiseId': payee_id,
                'amount': str(amount),
                'currency': currency,
                'salt': salt,
                'metadata': metadata or {},
            }

            payment_url = f"{self.base_url}/payments/pay"

            async with session.put(payment_url, json=payment_intent, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise PaymentError(f"Failed to create payment intent: {error_text}")

                intent_data = await response.json()
                typed_data = intent_data.get('typedData')

                if not typed_data:
                    raise PaymentError("No typedData returned from payment intent")

            logger.debug("Rise provider: Payment intent created, signing TypedData")

            # Step 2: Sign TypedData
            signature = self.wallet.sign_typed_data(typed_data)

            # Step 3: Execute payment
            execution_payload = {
                'signature': signature,
                'typedData': typed_data,
                'intent': payment_intent,
            }

            async with session.post(payment_url, json=execution_payload, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise PaymentError(f"Payment execution failed: {error_text}")

                result_data = await response.json()

                # Extract transaction details
                provider_tx_id = result_data.get('transactionId') or result_data.get('txHash')
                transaction_id = result_data.get('paymentId', f"RISE-{provider_tx_id}")

            logger.info(f"Rise provider: Payment successful - {transaction_id}")

            return PaymentResult(
                success=True,
                transaction_id=transaction_id,
                provider_tx_id=provider_tx_id,
                status='completed',
                metadata=result_data,
            )

        except aiohttp.ClientError as e:
            logger.error(f"Rise provider: Network error during payment: {e}")
            raise PaymentError(f"Network error: {e}")

        except Exception as e:
            logger.error(f"Rise provider: Payment error: {e}")
            raise PaymentError(str(e))

    async def send_batch_payment(
        self,
        payments: List[PaymentIntent]
    ) -> BatchPaymentResult:
        """
        Send batch payment via Rise API

        Process similar to single payment but uses /payments/batch-pay endpoint

        Args:
            payments: List of payment intents

        Returns:
            BatchPaymentResult: Batch execution result

        Raises:
            PaymentError: If batch payment fails
        """
        await self._ensure_authenticated()

        # Validate batch size
        if len(payments) > self.max_batch_size:
            raise PaymentError(
                f"Batch size {len(payments)} exceeds maximum {self.max_batch_size}"
            )

        try:
            logger.info(f"Rise provider: Initiating batch payment with {len(payments)} payments")
            session = await self._get_session()
            headers = self._get_auth_headers()

            # Prepare batch payment intents
            batch_intents = []
            for payment in payments:
                batch_intents.append({
                    'payeeRiseId': payment.payee_id,
                    'amount': str(payment.amount),
                    'currency': payment.currency,
                    'salt': generate_salt(),
                    'metadata': payment.metadata or {},
                })

            # Step 1: Request batch payment intent
            batch_url = f"{self.base_url}/payments/batch-pay"

            async with session.put(batch_url, json={'payments': batch_intents}, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise PaymentError(f"Failed to create batch intent: {error_text}")

                intent_data = await response.json()
                typed_data = intent_data.get('typedData')

            # Step 2: Sign TypedData
            signature = self.wallet.sign_typed_data(typed_data)

            # Step 3: Execute batch payment
            execution_payload = {
                'signature': signature,
                'typedData': typed_data,
                'intents': batch_intents,
            }

            async with session.post(batch_url, json=execution_payload, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise PaymentError(f"Batch execution failed: {error_text}")

                result_data = await response.json()

            # Parse results
            batch_id = result_data.get('batchId', f"RISE-BATCH-{int(time.time())}")
            payment_results = result_data.get('results', [])

            results = []
            success_count = 0
            failure_count = 0

            for idx, pr in enumerate(payment_results):
                success = pr.get('success', False)
                if success:
                    success_count += 1
                else:
                    failure_count += 1

                results.append(PaymentResult(
                    success=success,
                    transaction_id=pr.get('paymentId', f"RISE-{idx}"),
                    provider_tx_id=pr.get('transactionId'),
                    status='completed' if success else 'failed',
                    error_message=pr.get('error'),
                ))

            logger.info(
                f"Rise provider: Batch payment completed - "
                f"{success_count} success, {failure_count} failed"
            )

            return BatchPaymentResult(
                success=failure_count == 0,
                batch_id=batch_id,
                total_count=len(payments),
                success_count=success_count,
                failure_count=failure_count,
                results=results,
            )

        except aiohttp.ClientError as e:
            logger.error(f"Rise provider: Network error during batch payment: {e}")
            raise PaymentError(f"Network error: {e}")

        except Exception as e:
            logger.error(f"Rise provider: Batch payment error: {e}")
            raise PaymentError(str(e))

    async def get_payment_status(
        self,
        transaction_id: str
    ) -> PaymentStatus:
        """
        Get payment status from Rise API

        Args:
            transaction_id: Transaction ID

        Returns:
            PaymentStatus: Current payment status

        Raises:
            TransactionNotFoundError: If transaction not found
        """
        await self._ensure_authenticated()

        try:
            session = await self._get_session()
            headers = self._get_auth_headers()

            status_url = f"{self.base_url}/payments/{transaction_id}"

            async with session.get(status_url, headers=headers) as response:
                if response.status == 404:
                    raise TransactionNotFoundError(f"Transaction {transaction_id} not found")

                if response.status != 200:
                    error_text = await response.text()
                    raise PaymentError(f"Failed to get payment status: {error_text}")

                data = await response.json()

            return PaymentStatus(
                transaction_id=transaction_id,
                status=data.get('status', 'unknown'),
                amount=Decimal(str(data.get('amount', 0))),
                currency=data.get('currency', 'USD'),
                created_at=datetime.fromisoformat(data.get('createdAt', datetime.utcnow().isoformat())),
                completed_at=datetime.fromisoformat(data['completedAt']) if data.get('completedAt') else None,
                error_message=data.get('error'),
            )

        except Exception as e:
            logger.error(f"Rise provider: Error getting payment status: {e}")
            raise

    async def get_payee_info(
        self,
        payee_id: str
    ) -> PayeeInfo:
        """
        Get payee information from Rise API

        Args:
            payee_id: Payee RiseID

        Returns:
            PayeeInfo: Payee account information
        """
        await self._ensure_authenticated()

        try:
            session = await self._get_session()
            headers = self._get_auth_headers()

            payee_url = f"{self.base_url}/riseid/{payee_id}"

            async with session.get(payee_url, headers=headers) as response:
                if response.status == 404:
                    raise InvalidPayeeError(f"Payee {payee_id} not found")

                if response.status != 200:
                    error_text = await response.text()
                    raise PaymentError(f"Failed to get payee info: {error_text}")

                data = await response.json()

            return PayeeInfo(
                payee_id=payee_id,
                email=data.get('email', ''),
                kyc_status=data.get('kycStatus', 'unknown'),
                can_receive_payments=data.get('kycStatus') == 'approved',
                metadata=data,
            )

        except Exception as e:
            logger.error(f"Rise provider: Error getting payee info: {e}")
            raise

    async def handle_webhook(
        self,
        event: WebhookEvent
    ) -> WebhookResponse:
        """
        Verify and process Rise webhook event

        Verification:
        1. Verify payload hash matches x-rise-hash header
        2. Verify signature matches x-rise-signature header
        3. Recover signer address and validate

        Args:
            event: Webhook event

        Returns:
            WebhookResponse: Processing response

        Raises:
            WebhookValidationError: If webhook invalid
        """
        try:
            logger.info(f"Rise provider: Processing webhook event {event.event_type}")

            # Step 1: Verify hash
            payload_hash = keccak256_dict(event.payload)

            if event.hash and payload_hash != event.hash:
                raise WebhookValidationError("Payload hash mismatch")

            # Step 2: Verify signature
            if event.signature and self.signer_address:
                recovered_address = EthWallet.recover_address_from_signature(
                    payload_hash,
                    event.signature
                )

                if recovered_address.lower() != self.signer_address.lower():
                    raise WebhookValidationError(
                        f"Invalid signature - expected {self.signer_address}, "
                        f"got {recovered_address}"
                    )

            logger.info("Rise provider: Webhook verification successful")

            return WebhookResponse(
                acknowledged=True,
                processed=True,
            )

        except Exception as e:
            logger.error(f"Rise provider: Webhook processing error: {e}")
            raise

    async def close(self) -> None:
        """Close provider and cleanup resources"""
        await self._close_session()
        logger.info("Rise provider: Closed")


# Register Rise provider with factory
from app.services.payment.provider_factory import PaymentProviderFactory
PaymentProviderFactory.register_provider('rise', RisePaymentProvider)
```

### 5.4 Verification Checklist

- [ ] Ethereum wallet utilities implemented
- [ ] Cryptographic utilities (Keccak-256) implemented
- [ ] Rise provider implements all abstract methods
- [ ] SIWE authentication working
- [ ] EIP-712 signing implemented
- [ ] Webhook verification functional
- [ ] Registered with factory
- [ ] Comprehensive logging
- [ ] Type hints complete

---

## Phase 6: Commission Service

### 6.1 Commission Calculator

**File**: `backend/app/services/commission/calculator.py`

```python
"""
Commission calculation service
"""
import logging
from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from uuid import UUID

from app.models.commission import Commission
from app.models.affiliate import Affiliate
from app.models.subscription import Subscription
from app.database import get_db

logger = logging.getLogger(__name__)


class CommissionCalculator:
    """
    Calculate affiliate commissions from subscription events
    """

    # Commission types
    TYPE_NEW_SUBSCRIPTION = 'new_subscription'
    TYPE_RENEWAL = 'renewal'
    TYPE_UPGRADE = 'upgrade'
    TYPE_ONE_TIME = 'one_time'

    def __init__(self):
        """Initialize calculator"""
        self.db = get_db()

    def calculate_commission(
        self,
        affiliate: Affiliate,
        subscription: Subscription,
        commission_type: str
    ) -> Decimal:
        """
        Calculate commission amount

        Args:
            affiliate: Affiliate earning commission
            subscription: Subscription generating commission
            commission_type: Type of commission

        Returns:
            Decimal: Commission amount
        """
        # Get subscription amount
        subscription_amount = subscription.amount

        # Apply commission rate
        commission_rate = affiliate.commission_rate / Decimal('100')
        commission_amount = subscription_amount * commission_rate

        # Round to 2 decimal places
        commission_amount = commission_amount.quantize(Decimal('0.01'))

        logger.info(
            f"Calculated commission: {commission_amount} "
            f"({affiliate.commission_rate}% of {subscription_amount})"
        )

        return commission_amount

    def create_commission(
        self,
        affiliate_id: UUID,
        subscription_id: UUID,
        commission_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Commission:
        """
        Create commission record

        Args:
            affiliate_id: Affiliate ID
            subscription_id: Subscription ID
            commission_type: Commission type
            metadata: Optional metadata

        Returns:
            Commission: Created commission record

        Raises:
            ValueError: If affiliate or subscription not found
        """
        # Get affiliate
        affiliate = self.db.query(Affiliate).filter(
            Affiliate.id == affiliate_id
        ).first()

        if not affiliate:
            raise ValueError(f"Affiliate {affiliate_id} not found")

        if not affiliate.is_active():
            raise ValueError(f"Affiliate {affiliate_id} is not active")

        # Get subscription
        subscription = self.db.query(Subscription).filter(
            Subscription.id == subscription_id
        ).first()

        if not subscription:
            raise ValueError(f"Subscription {subscription_id} not found")

        # Calculate amount
        amount = self.calculate_commission(affiliate, subscription, commission_type)

        # Create commission
        commission = Commission(
            affiliate_id=affiliate_id,
            subscription_id=subscription_id,
            amount=amount,
            currency='USD',  # TODO: Support multiple currencies
            commission_type=commission_type,
            status='pending',
            calculated_at=datetime.utcnow(),
            metadata=metadata,
        )

        self.db.add(commission)
        self.db.commit()
        self.db.refresh(commission)

        logger.info(f"Commission created: {commission.id} - {amount} USD")

        return commission

    def handle_new_subscription(
        self,
        subscription: Subscription
    ) -> Optional[Commission]:
        """
        Handle new subscription event

        Args:
            subscription: New subscription

        Returns:
            Commission: Created commission or None if no referral
        """
        # Check if subscription was referred
        if not subscription.referred_by:
            logger.debug(f"Subscription {subscription.id} has no referral")
            return None

        # Get referring affiliate
        affiliate = self.db.query(Affiliate).filter(
            Affiliate.user_id == subscription.referred_by
        ).first()

        if not affiliate:
            logger.warning(
                f"No affiliate found for referrer {subscription.referred_by}"
            )
            return None

        # Create commission
        return self.create_commission(
            affiliate_id=affiliate.id,
            subscription_id=subscription.id,
            commission_type=self.TYPE_NEW_SUBSCRIPTION,
            metadata={
                'subscription_tier': subscription.tier,
                'event': 'new_subscription',
            }
        )

    def handle_renewal(
        self,
        subscription: Subscription
    ) -> Optional[Commission]:
        """
        Handle subscription renewal

        Args:
            subscription: Renewed subscription

        Returns:
            Commission: Created commission or None
        """
        if not subscription.referred_by:
            return None

        affiliate = self.db.query(Affiliate).filter(
            Affiliate.user_id == subscription.referred_by
        ).first()

        if not affiliate:
            return None

        return self.create_commission(
            affiliate_id=affiliate.id,
            subscription_id=subscription.id,
            commission_type=self.TYPE_RENEWAL,
            metadata={
                'subscription_tier': subscription.tier,
                'event': 'renewal',
            }
        )

    def handle_upgrade(
        self,
        subscription: Subscription,
        old_tier: str,
        new_tier: str
    ) -> Optional[Commission]:
        """
        Handle subscription upgrade

        Args:
            subscription: Upgraded subscription
            old_tier: Previous tier
            new_tier: New tier

        Returns:
            Commission: Created commission or None
        """
        if not subscription.referred_by:
            return None

        affiliate = self.db.query(Affiliate).filter(
            Affiliate.user_id == subscription.referred_by
        ).first()

        if not affiliate:
            return None

        return self.create_commission(
            affiliate_id=affiliate.id,
            subscription_id=subscription.id,
            commission_type=self.TYPE_UPGRADE,
            metadata={
                'old_tier': old_tier,
                'new_tier': new_tier,
                'event': 'upgrade',
            }
        )
```

### 6.2 Commission Aggregator

**File**: `backend/app/services/commission/aggregator.py`

```python
"""
Commission aggregation service
"""
import logging
from typing import List, Dict, Any
from decimal import Decimal
from datetime import datetime
from uuid import UUID
from sqlalchemy import func

from app.models.commission import Commission
from app.models.affiliate import Affiliate
from app.database import get_db

logger = logging.getLogger(__name__)


class CommissionAggregator:
    """
    Aggregate commissions for payment processing
    """

    def __init__(self):
        """Initialize aggregator"""
        self.db = get_db()

    def get_pending_commissions(
        self,
        affiliate_id: Optional[UUID] = None,
        minimum_amount: Optional[Decimal] = None
    ) -> List[Commission]:
        """
        Get all pending commissions ready for payment

        Args:
            affiliate_id: Optional filter by affiliate
            minimum_amount: Optional minimum commission amount

        Returns:
            List[Commission]: Pending commissions
        """
        query = self.db.query(Commission).filter(
            Commission.status == 'approved'
        )

        if affiliate_id:
            query = query.filter(Commission.affiliate_id == affiliate_id)

        if minimum_amount:
            query = query.filter(Commission.amount >= minimum_amount)

        commissions = query.order_by(Commission.calculated_at.asc()).all()

        logger.info(f"Found {len(commissions)} pending commissions")
        return commissions

    def get_affiliate_pending_total(
        self,
        affiliate_id: UUID
    ) -> Decimal:
        """
        Get total pending commission amount for affiliate

        Args:
            affiliate_id: Affiliate ID

        Returns:
            Decimal: Total pending amount
        """
        result = self.db.query(
            func.sum(Commission.amount)
        ).filter(
            Commission.affiliate_id == affiliate_id,
            Commission.status.in_(['pending', 'approved'])
        ).scalar()

        return Decimal(str(result)) if result else Decimal('0')

    def get_affiliates_ready_for_payment(
        self,
        minimum_payout: Decimal = Decimal('50.00')
    ) -> List[Dict[str, Any]]:
        """
        Get affiliates with commissions ready for payment

        Args:
            minimum_payout: Minimum payout threshold

        Returns:
            List[dict]: Affiliate payment summary
        """
        # Query affiliates with aggregated pending commissions
        results = self.db.query(
            Affiliate.id,
            Affiliate.affiliate_code,
            Affiliate.minimum_payout,
            func.count(Commission.id).label('commission_count'),
            func.sum(Commission.amount).label('total_amount')
        ).join(
            Commission, Commission.affiliate_id == Affiliate.id
        ).filter(
            Affiliate.status == 'active',
            Commission.status == 'approved'
        ).group_by(
            Affiliate.id
        ).having(
            func.sum(Commission.amount) >= minimum_payout
        ).all()

        payment_ready = []
        for result in results:
            payment_ready.append({
                'affiliate_id': result.id,
                'affiliate_code': result.affiliate_code,
                'commission_count': result.commission_count,
                'total_amount': Decimal(str(result.total_amount)),
                'minimum_payout': result.minimum_payout,
            })

        logger.info(f"Found {len(payment_ready)} affiliates ready for payment")
        return payment_ready

    def group_commissions_by_currency(
        self,
        commissions: List[Commission]
    ) -> Dict[str, List[Commission]]:
        """
        Group commissions by currency

        Args:
            commissions: List of commissions

        Returns:
            dict: Commissions grouped by currency
        """
        grouped = {}
        for commission in commissions:
            currency = commission.currency
            if currency not in grouped:
                grouped[currency] = []
            grouped[currency].append(commission)

        return grouped

    def approve_commissions(
        self,
        commission_ids: List[UUID]
    ) -> int:
        """
        Approve multiple commissions for payment

        Args:
            commission_ids: List of commission IDs to approve

        Returns:
            int: Number of commissions approved
        """
        approved = self.db.query(Commission).filter(
            Commission.id.in_(commission_ids),
            Commission.status == 'pending'
        ).update(
            {
                'status': 'approved',
                'approved_at': datetime.utcnow()
            },
            synchronize_session=False
        )

        self.db.commit()

        logger.info(f"Approved {approved} commissions")
        return approved
```

### 6.3 Commission Validator

**File**: `backend/app/services/commission/validator.py`

```python
"""
Commission validation service
"""
import logging
from typing import Optional
from decimal import Decimal
from uuid import UUID

from app.models.commission import Commission
from app.models.affiliate import Affiliate
from app.models.affiliate_rise_account import AffiliateRiseAccount
from app.database import get_db

logger = logging.getLogger(__name__)


class CommissionValidator:
    """
    Validate commissions before payment
    """

    def __init__(self):
        """Initialize validator"""
        self.db = get_db()

    def validate_commission(
        self,
        commission: Commission
    ) -> tuple[bool, Optional[str]]:
        """
        Validate commission is ready for payment

        Args:
            commission: Commission to validate

        Returns:
            tuple: (is_valid, error_message)
        """
        # Check commission status
        if not commission.is_payable():
            return False, f"Commission status is {commission.status}, not payable"

        # Check commission amount
        if commission.amount <= 0:
            return False, "Commission amount must be positive"

        # Get affiliate
        affiliate = self.db.query(Affiliate).filter(
            Affiliate.id == commission.affiliate_id
        ).first()

        if not affiliate:
            return False, f"Affiliate {commission.affiliate_id} not found"

        # Validate affiliate
        is_valid, error = self.validate_affiliate(affiliate)
        if not is_valid:
            return False, error

        # Check minimum payout
        if commission.amount < affiliate.minimum_payout:
            return False, f"Amount {commission.amount} below minimum {affiliate.minimum_payout}"

        logger.debug(f"Commission {commission.id} validation passed")
        return True, None

    def validate_affiliate(
        self,
        affiliate: Affiliate
    ) -> tuple[bool, Optional[str]]:
        """
        Validate affiliate can receive payment

        Args:
            affiliate: Affiliate to validate

        Returns:
            tuple: (is_valid, error_message)
        """
        # Check affiliate is active
        if not affiliate.is_active():
            return False, f"Affiliate {affiliate.id} is not active"

        # Check Rise account exists
        rise_account = self.db.query(AffiliateRiseAccount).filter(
            AffiliateRiseAccount.affiliate_id == affiliate.id
        ).first()

        if not rise_account:
            return False, f"No Rise account for affiliate {affiliate.id}"

        # Check KYC status
        if not rise_account.is_kyc_approved():
            return False, f"KYC not approved for affiliate {affiliate.id}"

        # Check can receive payments
        if not rise_account.can_receive_payments():
            return False, f"Affiliate {affiliate.id} cannot receive payments"

        logger.debug(f"Affiliate {affiliate.id} validation passed")
        return True, None

    def validate_batch(
        self,
        commissions: list[Commission]
    ) -> tuple[list[Commission], list[tuple[Commission, str]]]:
        """
        Validate batch of commissions

        Args:
            commissions: List of commissions to validate

        Returns:
            tuple: (valid_commissions, invalid_commissions_with_reasons)
        """
        valid = []
        invalid = []

        for commission in commissions:
            is_valid, error = self.validate_commission(commission)
            if is_valid:
                valid.append(commission)
            else:
                invalid.append((commission, error))

        logger.info(
            f"Batch validation: {len(valid)} valid, {len(invalid)} invalid"
        )

        return valid, invalid
```

### 6.4 Verification Checklist

- [ ] Commission calculator implemented
- [ ] Handles all commission types
- [ ] Commission aggregator implemented
- [ ] Groups by currency and affiliate
- [ ] Commission validator implemented
- [ ] Validates affiliate and Rise account
- [ ] Type hints complete
- [ ] Comprehensive logging

---

_Continuing with Phase 7 (Payment Orchestrator), Phase 8 (Webhook Service), and remaining phases..._

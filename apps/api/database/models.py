from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

# Always resolve local credentials from the repository root, regardless of whether
# the API is launched from apps/api or from the project root.
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./causal_recover.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── CUSTOMERS ───
class Customer(Base):
    __tablename__ = "customers"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    historical_success_rate = Column(Float, default=0.5)
    historical_upi_success_rate = Column(Float, default=0.5)
    historical_card_success_rate = Column(Float, default=0.5)
    preferred_method = Column(String, default="card")
    contact_consent = Column(Boolean, default=True)
    previous_failures = Column(Integer, default=0)
    previous_recovery_contacts = Column(Integer, default=0)
    customer_tenure_days = Column(Integer, default=30)
    is_repeat_customer = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# ─── PAYMENTS ───
class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True, index=True)
    provider_payment_id = Column(String, nullable=True)
    order_id = Column(String, nullable=True)
    customer_id = Column(String, ForeignKey("customers.id"))
    amount = Column(Float)
    currency = Column(String, default="INR")
    method = Column(String, default="card")
    status = Column(String, default="failed")  # failed, recovered, closed
    failure_code = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)
    failure_source = Column(String, nullable=True)
    failure_step = Column(String, nullable=True)
    failure_category = Column(String)  # ISSUER_UNAVAILABLE, INSUFFICIENT_FUNDS, etc.
    natural_recovery_prob = Column(Float, default=0.0)
    best_action = Column(String, nullable=True)
    best_action_uplift = Column(Float, default=0.0)
    best_action_net_value = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    customer = relationship("Customer", backref="payments")

# ─── RECOVERY JOURNEYS ───
class RecoveryJourney(Base):
    __tablename__ = "recovery_journeys"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    payment_id = Column(String, ForeignKey("payments.id"))
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True)
    amount_at_risk = Column(Float, default=0.0)
    status = Column(String, default="EVALUATING")  # EVALUATING, ACTION_PENDING, ACTION_EXECUTED, WAITING, RECOVERED, STOPPED, ESCALATED
    attempt_count = Column(Integer, default=0)
    recovered_amount = Column(Float, default=0.0)
    resolution = Column(String, nullable=True)  # AI_RECOVERED, NATURAL_RECOVERY, POLICY_BLOCKED, STOPPED, ESCALATED
    started_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    payment = relationship("Payment", backref="journeys")

# ─── ACTION CANDIDATES ───
class ActionCandidate(Base):
    __tablename__ = "action_candidates"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    journey_id = Column(Integer, ForeignKey("recovery_journeys.id"))
    action_type = Column(String)
    probability = Column(Float)
    uplift = Column(Float)
    action_cost = Column(Float)
    expected_incremental_revenue = Column(Float, default=0.0)
    net_incremental_value = Column(Float, default=0.0)
    policy_status = Column(String, default="ALLOW")  # ALLOW, BLOCK, REQUIRE_APPROVAL
    policy_reason = Column(String, nullable=True)
    is_selected = Column(Boolean, default=False)
    rank = Column(Integer, default=0)
    journey = relationship("RecoveryJourney", backref="candidates")

# ─── RECOVERY ACTIONS ───
class RecoveryAction(Base):
    __tablename__ = "recovery_actions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    journey_id = Column(Integer, ForeignKey("recovery_journeys.id"))
    action_type = Column(String)
    status = Column(String, default="PENDING")  # PENDING, APPROVED, SCHEDULED, EXECUTING, COMPLETED, FAILED, BLOCKED, CANCELLED
    estimated_value = Column(Float, default=0.0)
    scheduled_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)
    provider_reference = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    journey = relationship("RecoveryJourney", backref="actions")

# ─── AUDIT EVENTS ───
class AuditEvent(Base):
    __tablename__ = "audit_events"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    journey_id = Column(Integer, nullable=True)
    payment_id = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    actor_type = Column(String, default="SYSTEM")  # SYSTEM, MODEL, MERCHANT, CUSTOMER, WEBHOOK
    actor_id = Column(String, nullable=True)
    event_type = Column(String)
    decision = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    estimated_uplift = Column(Float, nullable=True)
    estimated_incremental_value = Column(Float, nullable=True)
    model_version = Column(String, default="v1.0")
    policy_version = Column(String, default="v1.0")
    previous_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)

# ─── EXPERIMENTS ───
class Experiment(Base):
    __tablename__ = "experiments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String)
    description = Column(String, nullable=True)
    treatment_percentage = Column(Float, default=90.0)
    control_percentage = Column(Float, default=10.0)
    status = Column(String, default="ACTIVE")  # ACTIVE, PAUSED, COMPLETED
    treatment_count = Column(Integer, default=0)
    control_count = Column(Integer, default=0)
    treatment_recovered = Column(Integer, default=0)
    control_recovered = Column(Integer, default=0)
    treatment_revenue = Column(Float, default=0.0)
    control_revenue = Column(Float, default=0.0)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

# Each newly evaluated payment is assigned before execution. Keeping the arm at
# journey level makes treatment-vs-control measurement reproducible and avoids
# treating an outcome as causal without an explicit baseline.
class ExperimentAssignment(Base):
    __tablename__ = "experiment_assignments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False, index=True)
    journey_id = Column(Integer, ForeignKey("recovery_journeys.id"), nullable=False, unique=True, index=True)
    payment_id = Column(String, ForeignKey("payments.id"), nullable=False, index=True)
    arm = Column(String, nullable=False)  # CONTROL or TREATMENT
    selected_action = Column(String, nullable=False)
    source_mode = Column(String, default="TEST")  # TEST or LIVE
    outcome = Column(String, nullable=True)  # RECOVERED, CANCELLED, EXPIRED
    recovered_amount = Column(Float, default=0.0)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

# ─── WEBHOOK EVENTS ───
class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_id = Column(String, unique=True, index=True)
    event_type = Column(String)
    payment_id = Column(String, nullable=True)
    signature_valid = Column(Boolean, default=False)
    processed = Column(Boolean, default=False)
    raw_payload = Column(Text, nullable=True)
    received_at = Column(DateTime, default=datetime.utcnow)

# ─── MERCHANT POLICIES ───
class MerchantPolicy(Base):
    __tablename__ = "merchant_policies"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
    description = Column(String, nullable=True)
    category = Column(String, default="general")

def init_db():
    Base.metadata.create_all(bind=engine)

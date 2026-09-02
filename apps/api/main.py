from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database.models import (
    init_db, get_db, Customer, Payment, RecoveryJourney, ActionCandidate,
    RecoveryAction, AuditEvent, Experiment, ExperimentAssignment, WebhookEvent, MerchantPolicy
)
from core.economic_optimizer import evaluate_transaction
from core.policy_engine import evaluate_policies
from core.razorpay_adapter import create_recovery_payment_link, fetch_recovery_link_outcome, RazorpayAdapterError
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json
import random
import os
import hmac
import hashlib
import threading
import time
import requests
from pathlib import Path

app = FastAPI(title="CausalRecover API", version="1.0.0", description="AI Revenue Recovery Intelligence")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def reconcile_dispatched_action_in_background(action_id: int):
    """Short-lived safety net for Test Mode and delayed webhook delivery."""
    for _ in range(24):  # two minutes; webhooks remain the primary path
        time.sleep(5)
        try:
            response = requests.post(f"http://127.0.0.1:8000/api/actions/{action_id}/reconcile", timeout=15)
            if response.ok and response.json().get("outcome") in {"failed", "recovered"}:
                return
        except requests.RequestException:
            continue

@app.on_event("startup")
def on_startup():
    init_db()


def merchant_policy_map(db: Session) -> dict:
    """Single source of truth for editable merchant guardrails."""
    return {policy.key: policy.value for policy in db.query(MerchantPolicy).all()}


def customer_context(customer: Customer | None, payment: Payment, journey: RecoveryJourney) -> dict:
    return {
        "contact_consent": customer.contact_consent if customer else False,
        "previous_recovery_contacts": customer.previous_recovery_contacts if customer else 0,
        "attempt_count": journey.attempt_count or 0,
        "payment_amount": payment.amount,
    }


def experiment_arm(experiment: Experiment, payment_id: str) -> str:
    """Stable  allocation: retries never move a payment between experiment arms."""
    bucket = int(hashlib.sha256(f"{experiment.id}:{payment_id}".encode()).hexdigest()[:8], 16) % 10000
    return "CONTROL" if bucket < int(experiment.control_percentage * 100) else "TREATMENT"


def evaluate_and_queue_recovery(db: Session, payment: Payment, journey: RecoveryJourney, customer: Customer | None):
    """Evaluate all actions, persist the decision, and queue only a bounded action."""
    candidates = evaluate_transaction(
        payment.amount, payment.failure_category, customer.historical_success_rate if customer else 0.5
    )
    policies = merchant_policy_map(db)
    context = customer_context(customer, payment, journey)
    selected = None
    no_action_record = None

    for rank, candidate in enumerate(candidates, start=1):
        status, reason = evaluate_policies(candidate, context, policies)
        db_candidate = ActionCandidate(
            journey_id=journey.id,
            action_type=candidate["action_type"], probability=candidate["probability"],
            uplift=candidate["uplift"], action_cost=candidate["action_cost"],
            expected_incremental_revenue=candidate["expected_incremental_revenue"],
            net_incremental_value=candidate["net_incremental_value"],
            policy_status=status, policy_reason=reason, rank=rank,
        )
        if candidate["action_type"] == "NO_ACTION":
            no_action_record = db_candidate
        if selected is None and status == "ALLOW" and candidate["action_type"] != "NO_ACTION":
            db_candidate.is_selected = True
            selected = db_candidate
        db.add(db_candidate)

    active_experiment = db.query(Experiment).filter(Experiment.status == "ACTIVE").order_by(Experiment.id).first()
    assigned_arm = experiment_arm(active_experiment, payment.id) if active_experiment else None

    # A control assignment deliberately takes no action. This is the only
    # defensible baseline for measuring incremental recovery later.
    if assigned_arm == "CONTROL" and no_action_record:
        if selected:
            selected.is_selected = False
        selected = no_action_record
        selected.is_selected = True
        selected.policy_reason = "EXPERIMENT_CONTROL_BASELINE"

    if selected is None:
        # NO_ACTION is a deliberate, auditable choice—not an error state.
        selected = no_action_record
        if selected is None:
            selected = ActionCandidate(
                journey_id=journey.id, action_type="NO_ACTION", probability=payment.natural_recovery_prob,
                uplift=0, action_cost=0, expected_incremental_revenue=0, net_incremental_value=0,
                policy_status="ALLOW", policy_reason="NO_POLICY_COMPLIANT_ACTION", is_selected=True, rank=len(candidates) + 1,
            )
            db.add(selected)
        else:
            selected.is_selected = True
            selected.policy_reason = "NO_POLICY_COMPLIANT_ACTION"
        journey.status = "WAITING"
        journey.resolution = "NATURAL_RECOVERY_MONITORING"
    else:
        if assigned_arm == "CONTROL":
            journey.status = "WAITING"
            journey.resolution = "EXPERIMENT_CONTROL_BASELINE"
        else:
            journey.status = "ACTION_PENDING"
            db.add(RecoveryAction(
                journey_id=journey.id, action_type=selected.action_type, status="PENDING",
                estimated_value=selected.net_incremental_value,
            ))

    no_action = next((c for c in candidates if c["action_type"] == "NO_ACTION"), None)
    payment.natural_recovery_prob = no_action["probability"] if no_action else 0
    payment.best_action = selected.action_type
    payment.best_action_uplift = selected.uplift or 0
    payment.best_action_net_value = selected.net_incremental_value or 0
    db.add(AuditEvent(
        journey_id=journey.id, payment_id=payment.id, actor_type="MODEL", event_type="MODEL_EVALUATED",
        decision=selected.action_type, reason=selected.policy_reason,
        estimated_uplift=selected.uplift, estimated_incremental_value=selected.net_incremental_value,
        new_state=journey.status,
    ))
    if active_experiment and assigned_arm:
        source_mode = os.getenv("RAZORPAY_MODE", "TEST").upper()
        db.add(ExperimentAssignment(
            experiment_id=active_experiment.id, journey_id=journey.id, payment_id=payment.id,
            arm=assigned_arm, selected_action=selected.action_type, source_mode=source_mode,
        ))
        db.add(AuditEvent(
            journey_id=journey.id, payment_id=payment.id, actor_type="SYSTEM", event_type="EXPERIMENT_ASSIGNED",
            decision=assigned_arm, reason=f"{source_mode}_MODE_{assigned_arm}_ASSIGNMENT", new_state=journey.status,
        ))
    return selected


def normalize_failure(reason: str | None, code: str | None) -> str:
    text = f"{reason or ''} {code or ''}".upper()
    if "FUNDS" in text or "BALANCE" in text:
        return "INSUFFICIENT_FUNDS"
    if "EXPIRED" in text:
        return "CARD_EXPIRED"
    if "AUTH" in text or "OTP" in text or "3DS" in text:
        return "AUTHENTICATION_FAILED"
    if "GATEWAY" in text or "TIMEOUT" in text:
        return "GATEWAY_TECHNICAL_ERROR"
    if "LIMIT" in text:
        return "TRANSACTION_LIMIT"
    # A generic "declined by bank" message does not establish that the issuer
    # is unavailable. Keep it UNKNOWN unless Razorpay provides a specific code.
    if "ISSUER" in text and ("UNAVAILABLE" in text or "NOT AVAILABLE" in text):
        return "ISSUER_UNAVAILABLE"
    return "UNKNOWN"


def mark_recovery_completed(db: Session, payment: Payment, journey: RecoveryJourney, source: str):
    payment.status = "recovered"
    journey.status = "RECOVERED"
    journey.recovered_amount = payment.amount
    journey.resolution = source
    journey.resolved_at = datetime.utcnow()
    db.query(RecoveryAction).filter(
        RecoveryAction.journey_id == journey.id,
        RecoveryAction.status.in_(["PENDING", "APPROVED", "SCHEDULED", "EXECUTING"]),
    ).update({"status": "COMPLETED"})
    db.query(ExperimentAssignment).filter(
        ExperimentAssignment.journey_id == journey.id,
        ExperimentAssignment.outcome.is_(None),
    ).update({"outcome": "RECOVERED", "recovered_amount": payment.amount, "resolved_at": datetime.utcnow()})
    db.add(AuditEvent(
        journey_id=journey.id, payment_id=payment.id,
        actor_type="RAZORPAY_API" if source == "RAZORPAY_API_RECONCILIATION" else "WEBHOOK",
        event_type="PAYMENT_RECOVERED",
        reason=source, new_state="RECOVERED",
    ))

# ══════════════════════════════════════════════════════════════
# HEALTH
# ══════════════════════════════════════════════════════════════
@app.get("/health")
def health():
    return {"status": "healthy", "version": "1.0.0", "mode": "TEST"}

# ══════════════════════════════════════════════════════════════
# DASHBOARD OVERVIEW
# ══════════════════════════════════════════════════════════════
@app.get("/api/dashboard/overview")
def dashboard_overview(db: Session = Depends(get_db)):
    total_at_risk = db.query(func.sum(Payment.amount)).filter(Payment.status == "failed").scalar() or 0
    total_recovered_amount = db.query(func.sum(RecoveryJourney.recovered_amount)).filter(RecoveryJourney.status == "RECOVERED").scalar() or 0
    
    # Keep gross model-estimated uplift, intervention cost, and net value separate.
    estimated_incremental = db.query(func.sum(ActionCandidate.expected_incremental_revenue)).filter(
        ActionCandidate.is_selected == True,
        ActionCandidate.expected_incremental_revenue > 0
    ).scalar() or 0
    
    recovery_cost = db.query(func.sum(ActionCandidate.action_cost)).filter(
        ActionCandidate.is_selected == True
    ).scalar() or 0
    
    net_incremental = db.query(func.sum(ActionCandidate.net_incremental_value)).filter(
        ActionCandidate.is_selected == True,
        ActionCandidate.net_incremental_value > 0,
    ).scalar() or 0
    
    total_journeys = db.query(func.count(RecoveryJourney.id)).scalar() or 0
    recovered_journeys = db.query(func.count(RecoveryJourney.id)).filter(RecoveryJourney.status == "RECOVERED").scalar() or 0
    recovery_rate = (recovered_journeys / total_journeys * 100) if total_journeys > 0 else 0
    
    no_actions = db.query(func.count(ActionCandidate.id)).filter(
        ActionCandidate.is_selected == True, ActionCandidate.action_type == "NO_ACTION"
    ).scalar() or 0
    
    policy_blocks = db.query(func.count(ActionCandidate.id)).filter(
        ActionCandidate.policy_status == "BLOCK"
    ).scalar() or 0
    
    active_journeys = db.query(func.count(RecoveryJourney.id)).filter(
        RecoveryJourney.status.in_(["EVALUATING", "ACTION_PENDING", "ACTION_EXECUTED", "WAITING"])
    ).scalar() or 0
    
    return {
        "revenue_at_risk": round(total_at_risk, 2),
        "gross_recovered": round(total_recovered_amount, 2),
        "estimated_incremental": round(estimated_incremental, 2),
        "net_incremental_value": round(net_incremental, 2),
        "recovery_rate": round(recovery_rate, 1),
        "actions_avoided": no_actions,
        "policy_blocks": policy_blocks,
        "recovery_cost": round(recovery_cost, 2),
        "active_journeys": active_journeys,
        "total_journeys": total_journeys,
        "recovered_journeys": recovered_journeys,
    }

# ══════════════════════════════════════════════════════════════
# AT-RISK PAYMENTS
# ══════════════════════════════════════════════════════════════
@app.get("/api/payments/at-risk")
def get_at_risk_payments(
    failure_category: Optional[str] = None,
    method: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    q = db.query(Payment).order_by(desc(Payment.created_at))
    if failure_category:
        q = q.filter(Payment.failure_category == failure_category)
    if method:
        q = q.filter(Payment.method == method)
    if status:
        q = q.filter(Payment.status == status)
    else:
        q = q.filter(Payment.status == "failed")
    
    total = q.count()
    payments = q.offset(offset).limit(limit).all()
    
    results = []
    for p in payments:
        journey = db.query(RecoveryJourney).filter(RecoveryJourney.payment_id == p.id).first()
        selected = None
        if journey:
            selected = db.query(ActionCandidate).filter(
                ActionCandidate.journey_id == journey.id, ActionCandidate.is_selected == True
            ).first()
        
        results.append({
            "id": p.id,
            "customer_id": p.customer_id,
            "amount": p.amount,
            "currency": p.currency,
            "method": p.method,
            "failure_category": p.failure_category,
            "failure_reason": p.failure_reason,
            "status": p.status,
            "natural_recovery_prob": p.natural_recovery_prob,
            "best_action": p.best_action,
            "best_action_uplift": p.best_action_uplift,
            "best_action_net_value": p.best_action_net_value,
            "journey_status": journey.status if journey else None,
            "journey_id": journey.id if journey else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    
    return {"total": total, "payments": results}

# ══════════════════════════════════════════════════════════════
# SINGLE PAYMENT DETAIL
# ══════════════════════════════════════════════════════════════
@app.get("/api/payments/{payment_id}")
def get_payment_detail(payment_id: str, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    customer = db.query(Customer).filter(Customer.id == payment.customer_id).first()
    journey = db.query(RecoveryJourney).filter(RecoveryJourney.payment_id == payment_id).first()
    
    candidates = []
    actions_list = []
    if journey:
        candidates = [{
            "id": c.id,
            "action_type": c.action_type,
            "probability": round(c.probability, 4),
            "uplift": round(c.uplift, 4),
            "action_cost": c.action_cost,
            "expected_incremental_revenue": round(c.expected_incremental_revenue, 2),
            "net_incremental_value": round(c.net_incremental_value, 2),
            "policy_status": c.policy_status,
            "policy_reason": c.policy_reason,
            "is_selected": c.is_selected,
            "rank": c.rank,
        } for c in db.query(ActionCandidate).filter(ActionCandidate.journey_id == journey.id).order_by(ActionCandidate.rank).all()]
        
        actions_list = [{
            "id": a.id,
            "action_type": a.action_type,
            "status": a.status,
            "estimated_value": a.estimated_value,
            "executed_at": a.executed_at.isoformat() if a.executed_at else None,
        } for a in db.query(RecoveryAction).filter(RecoveryAction.journey_id == journey.id).all()]
    
    audits = [{
        "id": a.id,
        "timestamp": a.timestamp.isoformat() if a.timestamp else None,
        "actor_type": a.actor_type,
        "event_type": a.event_type,
        "decision": a.decision,
        "reason": a.reason,
        "previous_state": a.previous_state,
        "new_state": a.new_state,
    } for a in db.query(AuditEvent).filter(AuditEvent.payment_id == payment_id).order_by(AuditEvent.timestamp).all()]
    
    return {
        "payment": {
            "id": payment.id,
            "customer_id": payment.customer_id,
            "order_id": payment.order_id,
            "amount": payment.amount,
            "currency": payment.currency,
            "method": payment.method,
            "status": payment.status,
            "failure_code": payment.failure_code,
            "failure_reason": payment.failure_reason,
            "failure_source": payment.failure_source,
            "failure_step": payment.failure_step,
            "failure_category": payment.failure_category,
            "natural_recovery_prob": payment.natural_recovery_prob,
            "best_action": payment.best_action,
            "best_action_uplift": payment.best_action_uplift,
            "best_action_net_value": payment.best_action_net_value,
            "created_at": payment.created_at.isoformat() if payment.created_at else None,
        },
        "customer": {
            "id": customer.id if customer else None,
            "historical_success_rate": customer.historical_success_rate if customer else None,
            "contact_consent": customer.contact_consent if customer else None,
            "preferred_method": customer.preferred_method if customer else None,
            "previous_failures": customer.previous_failures if customer else None,
            "is_repeat_customer": customer.is_repeat_customer if customer else None,
        } if customer else None,
        "journey": {
            "id": journey.id,
            "status": journey.status,
            "amount_at_risk": journey.amount_at_risk,
            "recovered_amount": journey.recovered_amount,
            "resolution": journey.resolution,
            "attempt_count": journey.attempt_count,
            "started_at": journey.started_at.isoformat() if journey.started_at else None,
            "resolved_at": journey.resolved_at.isoformat() if journey.resolved_at else None,
        } if journey else None,
        "candidates": candidates,
        "actions": actions_list,
        "audit_trail": audits,
    }

# ══════════════════════════════════════════════════════════════
# RECOVERY JOURNEYS
# ══════════════════════════════════════════════════════════════
@app.get("/api/journeys")
def get_journeys(
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    q = db.query(RecoveryJourney).order_by(desc(RecoveryJourney.started_at))
    if status:
        q = q.filter(RecoveryJourney.status == status)
    total = q.count()
    journeys = q.offset(offset).limit(limit).all()
    
    results = []
    for j in journeys:
        payment = db.query(Payment).filter(Payment.id == j.payment_id).first()
        selected = db.query(ActionCandidate).filter(
            ActionCandidate.journey_id == j.id, ActionCandidate.is_selected == True
        ).first()
        # Webhook/manual recovery flows can create an executable RecoveryAction
        # without a persisted model candidate. Show that real action rather than
        # incorrectly implying that no action was selected.
        dispatched_action = db.query(RecoveryAction).filter(
            RecoveryAction.journey_id == j.id
        ).order_by(desc(RecoveryAction.created_at)).first()
        selected_action = selected.action_type if selected else (dispatched_action.action_type if dispatched_action else None)
        selected_net_value = (
            selected.net_incremental_value if selected
            else (dispatched_action.estimated_value if dispatched_action else None)
        )
        results.append({
            "id": j.id,
            "payment_id": j.payment_id,
            "customer_id": j.customer_id,
            "amount_at_risk": j.amount_at_risk,
            "status": j.status,
            "recovered_amount": j.recovered_amount,
            "resolution": j.resolution,
            "attempt_count": j.attempt_count,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "resolved_at": j.resolved_at.isoformat() if j.resolved_at else None,
            "failure_category": payment.failure_category if payment else None,
            "failure_code": payment.failure_code if payment else None,
            "failure_reason": payment.failure_reason if payment else None,
            "method": payment.method if payment else None,
            "selected_action": selected_action,
            "selected_uplift": round(selected.uplift, 4) if selected else None,
            "selected_net_value": round(selected_net_value, 2) if selected_net_value is not None else None,
        })
    
    return {"total": total, "journeys": results}

# ══════════════════════════════════════════════════════════════
# SIMULATOR / DECISION LAB
# ══════════════════════════════════════════════════════════════
class SimulatorRequest(BaseModel):
    amount: float = 7499
    failure_category: str = "ISSUER_UNAVAILABLE"
    payment_method: str = "card"
    historical_success_rate: float = 0.65
    contact_consent: bool = True

@app.post("/api/simulator/evaluate")
def simulate_evaluation(req: SimulatorRequest, db: Session = Depends(get_db)):
    candidates = evaluate_transaction(req.amount, req.failure_category, req.historical_success_rate)
    
    customer_context = {"contact_consent": req.contact_consent, "payment_amount": req.amount, "previous_recovery_contacts": 0, "attempt_count": 0}
    policies = merchant_policy_map(db)
    
    for i, cand in enumerate(candidates):
        status, reason = evaluate_policies(cand, customer_context, policies)
        cand["policy_status"] = status
        cand["policy_reason"] = reason
        cand["rank"] = i + 1
    
    # Find best allowed action
    selected = None
    for cand in candidates:
        if cand["policy_status"] == "ALLOW" and cand["action_type"] != "NO_ACTION":
            if cand["net_incremental_value"] > 0:
                selected = cand["action_type"]
                break
    
    if not selected:
        selected = "NO_ACTION"
    
    for cand in candidates:
        cand["is_selected"] = cand["action_type"] == selected
    
    return {
        "candidates": candidates,
        "selected_action": selected,
        "natural_recovery_prob": candidates[-1]["probability"] if candidates else 0,
        "label": "MODEL_ESTIMATE — No money action executed.",
    }

# ══════════════════════════════════════════════════════════════
# ACTIONS QUEUE
# ══════════════════════════════════════════════════════════════
@app.get("/api/actions")
def get_actions(
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    q = db.query(RecoveryAction).order_by(desc(RecoveryAction.created_at))
    if status:
        q = q.filter(RecoveryAction.status == status)
    actions = q.limit(limit).all()
    
    results = []
    for a in actions:
        journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == a.journey_id).first()
        payment = db.query(Payment).filter(Payment.id == journey.payment_id).first() if journey else None
        results.append({
            "id": a.id,
            "journey_id": a.journey_id,
            "action_type": a.action_type,
            "status": a.status,
            "estimated_value": a.estimated_value,
            "customer_id": journey.customer_id if journey else None,
            "amount": payment.amount if payment else None,
            "payment_id": journey.payment_id if journey else None,
            "provider_reference": a.provider_reference,
            "failure_reason": a.failure_reason,
            "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
            "executed_at": a.executed_at.isoformat() if a.executed_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    
    return {"actions": results}

@app.post("/api/actions/{action_id}/approve")
def approve_action(action_id: int, db: Session = Depends(get_db)):
    action = db.query(RecoveryAction).filter(RecoveryAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status != "PENDING":
        raise HTTPException(status_code=409, detail=f"Only pending actions can be approved (current: {action.status})")
    action.status = "APPROVED"
    journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == action.journey_id).first()
    db.add(AuditEvent(
        journey_id=action.journey_id, payment_id=journey.payment_id if journey else None,
        actor_type="MERCHANT", event_type="ACTION_APPROVED", decision=action.action_type,
        reason="MERCHANT_APPROVAL", previous_state="PENDING", new_state="APPROVED"
    ))
    db.commit()
    return {"status": "approved", "action_id": action_id}

@app.post("/api/actions/{action_id}/cancel")
def cancel_action(action_id: int, db: Session = Depends(get_db)):
    action = db.query(RecoveryAction).filter(RecoveryAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status not in {"PENDING", "APPROVED", "SCHEDULED"}:
        raise HTTPException(status_code=409, detail=f"Action cannot be cancelled from {action.status}")
    previous_status = action.status
    action.status = "CANCELLED"
    journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == action.journey_id).first()
    if journey:
        journey.status = "STOPPED"
        journey.resolution = "MERCHANT_CANCELLED"
        journey.resolved_at = datetime.utcnow()
    db.add(AuditEvent(
        journey_id=action.journey_id, payment_id=journey.payment_id if journey else None,
        actor_type="MERCHANT", event_type="ACTION_CANCELLED", decision=action.action_type,
        reason="MERCHANT_CANCELLED", previous_state=previous_status, new_state="STOPPED"
    ))
    db.commit()
    return {"status": "cancelled", "action_id": action_id}


@app.post("/api/actions/{action_id}/dispatch")
def dispatch_action(action_id: int, db: Session = Depends(get_db)):
    """Dispatch a policy-approved recovery action, creating Razorpay Test links when applicable."""
    action = db.query(RecoveryAction).filter(RecoveryAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status != "APPROVED":
        raise HTTPException(status_code=409, detail=f"Action cannot be dispatched from {action.status}")

    journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == action.journey_id).first()
    payment = db.query(Payment).filter(Payment.id == journey.payment_id).first() if journey else None
    customer = db.query(Customer).filter(Customer.id == payment.customer_id).first() if payment and payment.customer_id else None

    provider_url = None
    provider_created_at = None
    if action.action_type == "PAYMENT_LINK":
        if not payment:
            raise HTTPException(status_code=409, detail="Payment context is unavailable")
        try:
            link = create_recovery_payment_link(action.id, payment, customer)
        except RazorpayAdapterError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        action.provider_reference = link["id"]
        action.status = "EXECUTING"
        provider_url = link.get("short_url")
        provider_created_at = link.get("created_at")
    else:
        action.provider_reference = f"workflow_{action.id}_{int(datetime.utcnow().timestamp())}"
        action.status = "SCHEDULED"
    event_time = datetime.utcfromtimestamp(provider_created_at) if provider_created_at else datetime.utcnow()
    action.executed_at = event_time
    if journey:
        journey.status = "WAITING"
        journey.attempt_count += 1
    db.add(AuditEvent(
        journey_id=action.journey_id, payment_id=journey.payment_id if journey else None,
        actor_type="SYSTEM", event_type="ACTION_DISPATCHED", decision=action.action_type,
        reason="RAZORPAY_TEST_PAYMENT_LINK_CREATED" if provider_url else "RECOVERY_WORKFLOW_SCHEDULED", new_state="WAITING",
        timestamp=event_time,
    ))
    db.commit()
    if provider_url:
        threading.Thread(target=reconcile_dispatched_action_in_background, args=(action.id,), daemon=True).start()
    return {"status": action.status.lower(), "action_id": action_id, "provider_reference": action.provider_reference, "payment_link": provider_url}


@app.post("/api/actions/{action_id}/reconcile")
def reconcile_action(action_id: int, db: Session = Depends(get_db)):
    """Verify a dispatched Razorpay recovery link when webhook delivery is delayed."""
    action = db.query(RecoveryAction).filter(RecoveryAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.action_type != "PAYMENT_LINK" or not action.provider_reference:
        raise HTTPException(status_code=409, detail="This action has no Razorpay payment link to verify")

    journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == action.journey_id).first()
    payment = db.query(Payment).filter(Payment.id == journey.payment_id).first() if journey else None
    if not journey or not payment:
        raise HTTPException(status_code=409, detail="Recovery context is unavailable")
    if action.status == "FAILED":
        return {"outcome": "failed", "journey_status": journey.status, "reason": action.failure_reason, "already_reconciled": True}
    if journey.status == "RECOVERED":
        return {"outcome": "recovered", "journey_status": journey.status, "already_reconciled": True}

    try:
        outcome = fetch_recovery_link_outcome(action.provider_reference)
    except RazorpayAdapterError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if outcome["link_status"] == "paid":
        mark_recovery_completed(db, payment, journey, "RAZORPAY_API_RECONCILIATION")
        db.commit()
        return {"outcome": "recovered", "journey_status": journey.status}

    failure = outcome.get("latest_failure")
    if failure:
        reason = failure.get("error_description") or failure.get("error_reason") or "PAYMENT_LINK_CHECKOUT_FAILED"
        failure_time = datetime.utcfromtimestamp(failure["created_at"]) if failure.get("created_at") else datetime.utcnow()
        action.status = "FAILED"
        action.failure_reason = reason
        journey.status = "WAITING"
        db.add(AuditEvent(
            journey_id=journey.id, payment_id=payment.id, actor_type="RAZORPAY_API",
            event_type="RECOVERY_PAYMENT_FAILED", decision=action.action_type,
            reason=reason, previous_state="EXECUTING", new_state="WAITING",
            metadata_json=json.dumps({"provider_payment_id": failure.get("id"), "error_code": failure.get("error_code")}),
            timestamp=failure_time,
        ))
        db.commit()
        return {"outcome": "failed", "journey_status": journey.status, "reason": reason}

    return {"outcome": "pending", "journey_status": journey.status}

# ══════════════════════════════════════════════════════════════
# AUDIT TRAIL
# ══════════════════════════════════════════════════════════════
@app.get("/api/audit")
def get_audit_events(
    actor_type: Optional[str] = None,
    event_type: Optional[str] = None,
    journey_id: Optional[int] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db)
):
    q = db.query(AuditEvent).order_by(desc(AuditEvent.timestamp))
    if actor_type:
        q = q.filter(AuditEvent.actor_type == actor_type)
    if event_type:
        q = q.filter(AuditEvent.event_type == event_type)
    if journey_id:
        q = q.filter(AuditEvent.journey_id == journey_id)
    
    events = q.limit(limit).all()
    return {"events": [{
        "id": e.id,
        "journey_id": e.journey_id,
        "payment_id": e.payment_id,
        "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        "actor_type": e.actor_type,
        "event_type": e.event_type,
        "decision": e.decision,
        "reason": e.reason,
        "estimated_uplift": e.estimated_uplift,
        "estimated_incremental_value": e.estimated_incremental_value,
        "model_version": e.model_version,
        "previous_state": e.previous_state,
        "new_state": e.new_state,
    } for e in events]}

# ══════════════════════════════════════════════════════════════
# EXPERIMENTS
# ══════════════════════════════════════════════════════════════
@app.get("/api/experiments")
def get_experiments(db: Session = Depends(get_db)):
    exps = db.query(Experiment).order_by(desc(Experiment.started_at)).all()
    results = []
    for e in exps:
        treatment_rate = e.treatment_recovered / e.treatment_count if e.treatment_count else 0
        control_rate = e.control_recovered / e.control_count if e.control_count else 0
        results.append({
            "id": e.id, "name": e.name, "description": e.description,
            "treatment_percentage": e.treatment_percentage, "control_percentage": e.control_percentage,
            "status": e.status, "treatment_count": e.treatment_count, "control_count": e.control_count,
            "treatment_recovered": e.treatment_recovered, "control_recovered": e.control_recovered,
            "treatment_revenue": e.treatment_revenue, "control_revenue": e.control_revenue,
            "treatment_recovery_rate": round(treatment_rate, 4),
            "control_recovery_rate": round(control_rate, 4),
            "observed_lift_pp": round((treatment_rate - control_rate) * 100, 2),
            "measurement_label": "EXPERIMENTAL MEASUREMENT — benchmarked against a control baseline",
            "data_source": "OFFLINE_SEEDED_BENCHMARK",
            "started_at": e.started_at.isoformat() if e.started_at else None,
        })
    return {"experiments": results}


@app.get("/api/experiments/evidence")
def get_experiment_evidence(db: Session = Depends(get_db)):
    """Report only live, randomized outcomes as production-evidence candidates."""
    minimum_per_arm = int(os.getenv("CAUSAL_EVIDENCE_MIN_PER_ARM", "30"))
    assignments = db.query(ExperimentAssignment).all()
    live = [a for a in assignments if a.source_mode == "LIVE"]
    test = [a for a in assignments if a.source_mode != "LIVE"]

    def arm_summary(rows, arm):
        arm_rows = [a for a in rows if a.arm == arm]
        recovered = [a for a in arm_rows if a.outcome == "RECOVERED"]
        return {"assigned": len(arm_rows), "recovered": len(recovered), "recovered_amount": round(sum(a.recovered_amount or 0 for a in recovered), 2)}

    control = arm_summary(live, "CONTROL")
    treatment = arm_summary(live, "TREATMENT")
    ready = control["assigned"] >= minimum_per_arm and treatment["assigned"] >= minimum_per_arm
    return {
        "source_mode": os.getenv("RAZORPAY_MODE", "TEST").upper(),
        "live_assignments": len(live),
        "test_assignments": len(test),
        "control": control,
        "treatment": treatment,
        "minimum_per_arm": minimum_per_arm,
        "ready_for_effect_evaluation": ready,
        "claim_status": "READY_FOR_CONFIDENCE_INTERVAL_EVALUATION" if ready else "COLLECTING_LIVE_RANDOMIZED_OUTCOMES",
        "message": "Live randomized outcomes are required before estimating merchant impact. Test Mode outcomes remain operational verification only.",
    }

# ══════════════════════════════════════════════════════════════
# POLICIES
# ══════════════════════════════════════════════════════════════
@app.get("/api/policies")
def get_policies(db: Session = Depends(get_db)):
    policies = db.query(MerchantPolicy).all()
    return {"policies": [{
        "id": p.id,
        "key": p.key,
        "value": p.value,
        "description": p.description,
        "category": p.category,
    } for p in policies]}

class PolicyUpdate(BaseModel):
    key: str
    value: str

@app.put("/api/policies")
def update_policy(update: PolicyUpdate, db: Session = Depends(get_db)):
    policy = db.query(MerchantPolicy).filter(MerchantPolicy.key == update.key).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    policy.value = update.value
    db.commit()
    return {"status": "updated", "key": update.key, "value": update.value}

# ══════════════════════════════════════════════════════════════
# INTEGRATIONS
# ══════════════════════════════════════════════════════════════
@app.get("/api/integrations/razorpay/status")
def razorpay_status(db: Session = Depends(get_db)):
    last_webhook = db.query(WebhookEvent).order_by(desc(WebhookEvent.received_at)).first()
    total_webhooks = db.query(func.count(WebhookEvent.id)).scalar() or 0
    valid_webhooks = db.query(func.count(WebhookEvent.id)).filter(WebhookEvent.signature_valid == True).scalar() or 0
    
    connected = bool(os.getenv("RAZORPAY_KEY_ID") and os.getenv("RAZORPAY_KEY_SECRET"))
    return {
        "connected": connected,
        "connection_status": "CONNECTED" if connected else "CONFIGURATION_REQUIRED",
        "mode": "TEST",
        "total_webhooks": total_webhooks,
        "valid_webhooks": valid_webhooks,
        "last_webhook": last_webhook.received_at.isoformat() if last_webhook else None,
    }

# ══════════════════════════════════════════════════════════════
# ANALYTICS
# ══════════════════════════════════════════════════════════════
@app.get("/api/analytics/recovery-by-failure")
def analytics_by_failure(db: Session = Depends(get_db)):
    results = db.query(
        Payment.failure_category,
        func.count(Payment.id).label("total"),
        func.sum(Payment.amount).label("total_amount"),
    ).group_by(Payment.failure_category).all()
    
    recovered = db.query(
        Payment.failure_category,
        func.count(Payment.id).label("recovered"),
        func.sum(RecoveryJourney.recovered_amount).label("recovered_amount"),
    ).join(RecoveryJourney, RecoveryJourney.payment_id == Payment.id).filter(
        RecoveryJourney.status == "RECOVERED"
    ).group_by(Payment.failure_category).all()
    
    recovered_map = {r.failure_category: {"recovered": r.recovered, "recovered_amount": float(r.recovered_amount or 0)} for r in recovered}
    
    return {"data": [{
        "failure_category": r.failure_category,
        "total": r.total,
        "total_amount": float(r.total_amount or 0),
        "recovered": recovered_map.get(r.failure_category, {}).get("recovered", 0),
        "recovered_amount": recovered_map.get(r.failure_category, {}).get("recovered_amount", 0),
    } for r in results]}

@app.get("/api/analytics/recovery-by-action")
def analytics_by_action(db: Session = Depends(get_db)):
    results = db.query(
        ActionCandidate.action_type,
        func.count(ActionCandidate.id).label("count"),
        func.avg(ActionCandidate.uplift).label("avg_uplift"),
        func.sum(ActionCandidate.net_incremental_value).label("total_net_value"),
    ).filter(ActionCandidate.is_selected == True).group_by(ActionCandidate.action_type).all()
    
    return {"data": [{
        "action_type": r.action_type,
        "count": r.count,
        "avg_uplift": round(float(r.avg_uplift or 0), 4),
        "total_net_value": round(float(r.total_net_value or 0), 2),
    } for r in results]}

# ══════════════════════════════════════════════════════════════
# MODELS INFO
# ══════════════════════════════════════════════════════════════
@app.get("/api/models")
def get_model_info():
    card_path = Path(__file__).resolve().parents[2] / "ml" / "models" / "model_card.json"
    try:
        card = json.loads(card_path.read_text())
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=503, detail="Model card is unavailable")

    models = []
    for action in card["actions"]:
        metric = card["propensity_metrics"].get(action, {})
        models.append({
            "name": "Natural Recovery Model (NO_ACTION)" if action == "NO_ACTION" else f"Uplift Model ({action})",
            "version": "v1.0", "algorithm": "LightGBM Classifier", "approach": card["approach"],
            "dataset_size": metric.get("samples_train", card["train_size"]),
            "test_size": metric.get("samples_test", card["test_size"]),
            "features": card["features"], "trained_at": "2026-08-31", "status": "ACTIVE",
            "roc_auc": metric.get("roc_auc"), "brier_score": metric.get("brier_score"),
        })
    return {"models": models, "limitations": " ".join(card["known_limitations"]), "dataset_label": "OFFLINE VALIDATION"}

# ══════════════════════════════════════════════════════════════
# WEBHOOK RECEIVER (Razorpay Integration)
# ══════════════════════════════════════════════════════════════
@app.post("/api/events/razorpay/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    signature_required = os.getenv("WEBHOOK_SIGNATURE_REQUIRED", "false").lower() == "true"
    signature_valid = not signature_required or bool(signature and secret and hmac.compare_digest(
        hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest(), signature
    ))
    if not signature_valid:
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook signature")

    try:
        data = json.loads(payload.decode())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
        
    event_type = data.get("event")
    event_id = request.headers.get("X-Razorpay-Event-Id", f"evt_{datetime.utcnow().timestamp()}")
    
    existing_event = db.query(WebhookEvent).filter(WebhookEvent.event_id == event_id).first()
    if existing_event:
        return {"status": "ok", "message": "Event already processed"}

    # Store every inbound event before mutating recovery state.
    webhook_event = WebhookEvent(
        event_id=event_id,
        event_type=event_type,
        payment_id=data.get("payload", {}).get("payment", {}).get("entity", {}).get("id"),
        signature_valid=signature_valid,
        raw_payload=payload.decode()
    )
    db.add(webhook_event)
    db.flush()

    if event_type == "payment.failed":
        entity = data.get("payload", {}).get("payment", {}).get("entity", {})
        pay_id = entity["id"]
        linked_action = None
        if entity.get("payment_link_id"):
            linked_action = db.query(RecoveryAction).filter(RecoveryAction.provider_reference == entity["payment_link_id"]).first()
        if linked_action:
            journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == linked_action.journey_id).first()
            payment = db.query(Payment).filter(Payment.id == journey.payment_id).first() if journey else None
            failure_reason = entity.get("error_description") or entity.get("error_reason", "PAYMENT_LINK_CHECKOUT_FAILED")
            linked_action.status = "FAILED"
            linked_action.failure_reason = failure_reason
            if journey:
                journey.status = "WAITING"
            db.add(AuditEvent(
                journey_id=journey.id if journey else None, payment_id=payment.id if payment else None,
                actor_type="WEBHOOK", event_type="RECOVERY_PAYMENT_FAILED", decision=linked_action.action_type,
                reason=failure_reason, previous_state="EXECUTING", new_state="WAITING",
                timestamp=datetime.utcfromtimestamp(entity["created_at"]) if entity.get("created_at") else datetime.utcnow(),
            ))
            webhook_event.processed = True
            db.commit()
            return {"status": "ok", "journey_id": journey.id if journey else None, "recovery_action": "failed"}

        existing = db.query(Payment).filter(Payment.id == pay_id).first()
        if existing:
            webhook_event.processed = True
            db.commit()
            return {"status": "ok", "message": "Already processed"}

        customer_id = entity.get("customer_id")
        customer = db.query(Customer).filter(Customer.id == customer_id).first() if customer_id else None
        if customer_id and not customer:
            customer = Customer(id=customer_id, email=entity.get("email"), contact_consent=False)
            db.add(customer)

        failure_reason = entity.get("error_description") or entity.get("error_reason", "UNKNOWN")
        failure_detail = " ".join(filter(None, [
            entity.get("error_reason"), entity.get("error_description"), entity.get("error_code"),
        ]))
        failure_code = entity.get("error_code", "UNKNOWN")
        payment = Payment(
            id=pay_id,
            provider_payment_id=pay_id,
            order_id=entity.get("order_id"),
            customer_id=customer_id,
            amount=entity.get("amount", 0) / 100.0,
            currency=entity.get("currency", "INR"),
            method=entity.get("method", "card"),
            status="failed",
            failure_code=failure_code,
            failure_reason=failure_reason,
            failure_source=entity.get("error_source", "unknown"),
            failure_step=entity.get("error_step", "unknown"),
            failure_category=normalize_failure(failure_detail, failure_code),
            created_at=datetime.utcfromtimestamp(entity["created_at"]) if entity.get("created_at") else datetime.utcnow(),
        )
        db.add(payment)
        db.flush()
        journey = RecoveryJourney(payment_id=pay_id, customer_id=customer_id, amount_at_risk=payment.amount, status="EVALUATING")
        db.add(journey)
        db.flush()
        evaluate_and_queue_recovery(db, payment, journey, customer)
        webhook_event.processed = True
        db.commit()
        return {"status": "ok", "journey_id": journey.id, "selected_action": payment.best_action}

    if event_type == "payment_link.paid":
        link_id = data.get("payload", {}).get("payment_link", {}).get("entity", {}).get("id")
        linked_action = db.query(RecoveryAction).filter(RecoveryAction.provider_reference == link_id).first()
        if linked_action:
            journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == linked_action.journey_id).first()
            payment = db.query(Payment).filter(Payment.id == journey.payment_id).first() if journey else None
            if payment and journey:
                mark_recovery_completed(db, payment, journey, "RAZORPAY_PAYMENT_LINK_WEBHOOK")
        webhook_event.processed = True
        db.commit()
        return {"status": "ok"}

    if event_type == "payment_link.expired":
        link_id = data.get("payload", {}).get("payment_link", {}).get("entity", {}).get("id")
        linked_action = db.query(RecoveryAction).filter(RecoveryAction.provider_reference == link_id).first()
        if linked_action:
            journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == linked_action.journey_id).first()
            payment = db.query(Payment).filter(Payment.id == journey.payment_id).first() if journey else None
            linked_action.status = "FAILED"
            linked_action.failure_reason = "PAYMENT_LINK_EXPIRED_NO_COMPLETION"
            if journey:
                journey.status = "STOPPED"
                journey.resolution = "CHECKOUT_ABANDONED"
                journey.resolved_at = datetime.utcnow()
            db.add(AuditEvent(
                journey_id=journey.id if journey else None, payment_id=payment.id if payment else None,
                actor_type="WEBHOOK", event_type="RECOVERY_LINK_EXPIRED", decision="PAYMENT_LINK",
                reason="CHECKOUT_ABANDONED", new_state="STOPPED",
            ))
        webhook_event.processed = True
        db.commit()
        return {"status": "ok"}

    if event_type in {"payment.captured", "payment.authorized"}:
        entity = data.get("payload", {}).get("payment", {}).get("entity", {})
        payment = db.query(Payment).filter(Payment.id == entity.get("id")).first()
        linked_action = None
        if not payment and entity.get("payment_link_id"):
            linked_action = db.query(RecoveryAction).filter(RecoveryAction.provider_reference == entity["payment_link_id"]).first()
            if linked_action:
                linked_journey = db.query(RecoveryJourney).filter(RecoveryJourney.id == linked_action.journey_id).first()
                payment = db.query(Payment).filter(Payment.id == linked_journey.payment_id).first() if linked_journey else None
        if payment:
            journey = db.query(RecoveryJourney).filter(RecoveryJourney.payment_id == payment.id).first()
            if journey:
                mark_recovery_completed(db, payment, journey, "RAZORPAY_PAYMENT_CAPTURED_WEBHOOK")
        webhook_event.processed = True
        db.commit()
    return {"status": "ok"}

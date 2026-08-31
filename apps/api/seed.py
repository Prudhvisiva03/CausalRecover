"""
CausalRecover Database Seeder
Seeds the database with representative recovery scenarios for the Razorpay AI Buildathon.
Data is generated for local development and evaluation.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database.models import *
from core.economic_optimizer import evaluate_transaction
from core.policy_engine import evaluate_policies
from datetime import datetime, timedelta
import random
import numpy as np

random.seed(42)
np.random.seed(42)

def seed():
    init_db()
    db = SessionLocal()
    
    # Clear existing
    for table in [AuditEvent, ActionCandidate, RecoveryAction, RecoveryJourney, Payment, Customer, Experiment, MerchantPolicy, WebhookEvent]:
        db.query(table).delete()
    db.commit()
    
    # ─── MERCHANT POLICIES ───
    policies = [
        ("max_contacts_per_7_days", "3", "Maximum customer contacts in 7 days", "contact"),
        ("minimum_hours_between_contacts", "12", "Minimum hours between contacts", "contact"),
        ("max_recovery_attempts", "5", "Maximum recovery attempts per journey", "automation"),
        ("allow_payment_links", "true", "Allow payment link creation", "automation"),
        ("allow_alternative_method", "true", "Allow alternative payment methods", "automation"),
        ("allow_discounts", "false", "Allow discount incentives", "financial"),
        ("max_discount_percentage", "10", "Maximum discount percentage", "financial"),
        ("allow_email", "true", "Allow email communications", "contact"),
        ("allow_sms", "true", "Allow SMS communications", "contact"),
        ("require_contact_consent", "true", "Require customer consent for contact", "contact"),
        ("max_action_cost", "50", "Maximum action cost in INR", "financial"),
        ("minimum_expected_incremental_value", "10", "Minimum expected incremental value", "financial"),
        ("human_approval_above_amount", "25000", "Require human approval above this amount", "escalation"),
        ("auto_execute_below_amount", "5000", "Auto-execute actions below this amount", "automation"),
    ]
    for key, value, desc, cat in policies:
        db.add(MerchantPolicy(key=key, value=value, description=desc, category=cat))
    db.commit()
    policy_map = {policy.key: policy.value for policy in db.query(MerchantPolicy).all()}
    
    # ─── CUSTOMERS ───
    customers_data = [
        ("cust_0001", "rahul@example.com", True, 0.85, "upi", True, 1, 0, 365),
        ("cust_0002", "priya@example.com", True, 0.72, "card", True, 3, 2, 180),
        ("cust_0003", "amit@example.com", False, 0.45, "card", False, 5, 4, 60),  # No consent
        ("cust_0004", "sneha@example.com", True, 0.92, "upi", True, 0, 0, 730),
        ("cust_0005", "vikram@example.com", True, 0.60, "card", True, 2, 1, 90),
        ("cust_0006", "neha@example.com", True, 0.35, "netbanking", False, 8, 6, 45),
        ("cust_0007", "arjun@example.com", True, 0.78, "card", True, 1, 0, 400),
        ("cust_0008", "divya@example.com", True, 0.55, "upi", True, 4, 3, 120),
        ("cust_0009", "kiran@example.com", True, 0.88, "card", True, 0, 0, 500),
        ("cust_0010", "meera@example.com", True, 0.70, "upi", True, 2, 1, 200),
    ]
    
    for cid, email, consent, rate, method, repeat, failures, contacts, tenure in customers_data:
        db.add(Customer(
            id=cid, email=email, contact_consent=consent,
            historical_success_rate=rate, preferred_method=method,
            is_repeat_customer=repeat, previous_failures=failures,
            previous_recovery_contacts=contacts, customer_tenure_days=tenure,
        ))
    db.commit()
    
    # ─── EXPERIMENT ───
    experiment = Experiment(
        name="Recovery Strategy A/B Test v1",
        description="Comparing AI-optimized recovery actions vs no intervention (control)",
        treatment_percentage=90, control_percentage=10,
        status="ACTIVE",
    )
    db.add(experiment)
    db.commit()
    
    # ─── SCENARIOS ───
    now = datetime.utcnow()
    scenarios = [
        # Scenario 1: Issuer outage → UPI alternative (RECOVERED)
        {"pay_id": "pay_7499001", "cust": "cust_0001", "amount": 7499, "method": "card",
         "failure_cat": "ISSUER_UNAVAILABLE", "failure_reason": "Issuer bank server unavailable",
         "failure_source": "issuer", "failure_step": "authorization",
         "outcome": "RECOVERED", "recovered": 7499, "resolution": "AI_RECOVERED", "minutes_ago": 45},
        
        # Scenario 2: High natural recovery → NO_ACTION (RECOVERED naturally)
        {"pay_id": "pay_1499002", "cust": "cust_0004", "amount": 1499, "method": "upi",
         "failure_cat": "GATEWAY_TECHNICAL_ERROR", "failure_reason": "Temporary gateway timeout",
         "failure_source": "gateway", "failure_step": "processing",
         "outcome": "RECOVERED", "recovered": 1499, "resolution": "NATURAL_RECOVERY", "minutes_ago": 120},
        
        # Scenario 3: Insufficient funds → delayed intervention
        {"pay_id": "pay_4999003", "cust": "cust_0005", "amount": 4999, "method": "card",
         "failure_cat": "INSUFFICIENT_FUNDS", "failure_reason": "Card has insufficient funds",
         "failure_source": "issuer", "failure_step": "authorization",
         "outcome": "ACTION_PENDING", "recovered": 0, "resolution": None, "minutes_ago": 30},
        
        # Scenario 4: Expired card → update instrument
        {"pay_id": "pay_8999004", "cust": "cust_0002", "amount": 8999, "method": "card",
         "failure_cat": "CARD_EXPIRED", "failure_reason": "Card expired",
         "failure_source": "issuer", "failure_step": "authentication",
         "outcome": "ACTION_EXECUTED", "recovered": 0, "resolution": None, "minutes_ago": 60},
        
        # Scenario 5: Policy block — no consent
        {"pay_id": "pay_12000005", "cust": "cust_0003", "amount": 12000, "method": "card",
         "failure_cat": "AUTHENTICATION_FAILED", "failure_reason": "3DS authentication failed",
         "failure_source": "customer", "failure_step": "authentication",
         "outcome": "STOPPED", "recovered": 0, "resolution": "POLICY_BLOCKED", "minutes_ago": 90},
        
        # Scenario 6: High-value → human approval
        {"pay_id": "pay_55000006", "cust": "cust_0007", "amount": 55000, "method": "card",
         "failure_cat": "ISSUER_UNAVAILABLE", "failure_reason": "Issuer temporarily unavailable",
         "failure_source": "issuer", "failure_step": "authorization",
         "outcome": "ESCALATED", "recovered": 0, "resolution": "ESCALATED", "minutes_ago": 15},
        
        # Scenario 7: Discount economics → alternative wins on net value
        {"pay_id": "pay_5000007", "cust": "cust_0008", "amount": 5000, "method": "card",
         "failure_cat": "ISSUER_UNAVAILABLE", "failure_reason": "Bank server down",
         "failure_source": "issuer", "failure_step": "authorization",
         "outcome": "RECOVERED", "recovered": 5000, "resolution": "AI_RECOVERED", "minutes_ago": 180},
        
        # Scenario 8: Control group — natural recovery
        {"pay_id": "pay_3500008", "cust": "cust_0009", "amount": 3500, "method": "upi",
         "failure_cat": "GATEWAY_TECHNICAL_ERROR", "failure_reason": "Temporary error",
         "failure_source": "gateway", "failure_step": "processing",
         "outcome": "RECOVERED", "recovered": 3500, "resolution": "NATURAL_RECOVERY", "minutes_ago": 240},
        
        # Scenario 9: Action failure
        {"pay_id": "pay_6500009", "cust": "cust_0010", "amount": 6500, "method": "card",
         "failure_cat": "ISSUER_UNAVAILABLE", "failure_reason": "Bank network issue",
         "failure_source": "issuer", "failure_step": "authorization",
         "outcome": "ACTION_PENDING", "recovered": 0, "resolution": None, "minutes_ago": 10},
        
        # Scenario 10: Fully recovered via Razorpay
        {"pay_id": "pay_2200010", "cust": "cust_0001", "amount": 2200, "method": "upi",
         "failure_cat": "GATEWAY_TECHNICAL_ERROR", "failure_reason": "UPI timeout",
         "failure_source": "gateway", "failure_step": "processing",
         "outcome": "RECOVERED", "recovered": 2200, "resolution": "AI_RECOVERED", "minutes_ago": 300},
    ]
    
    # Generate 40 more random payments for density
    extra_custs = ["cust_0001","cust_0002","cust_0004","cust_0005","cust_0007","cust_0008","cust_0009","cust_0010"]
    fail_cats = ["ISSUER_UNAVAILABLE","INSUFFICIENT_FUNDS","CARD_EXPIRED","AUTHENTICATION_FAILED","UNKNOWN"]
    methods = ["card","upi","netbanking","card","card","upi"]
    statuses_pool = ["RECOVERED","RECOVERED","RECOVERED","ACTION_PENDING","STOPPED","EVALUATING","WAITING"]
    
    for i in range(40):
        cust = random.choice(extra_custs)
        amt = round(random.uniform(500, 20000), 2)
        fcat = random.choice(fail_cats)
        meth = random.choice(methods)
        outcome = random.choice(statuses_pool)
        rec = amt if outcome == "RECOVERED" else 0
        res = "AI_RECOVERED" if outcome == "RECOVERED" else None
        scenarios.append({
            "pay_id": f"pay_{1000+i:07d}",
            "cust": cust,
            "amount": amt,
            "method": meth,
            "failure_cat": fcat,
            "failure_reason": f"Error during {fcat.lower().replace('_',' ')}",
            "failure_source": "issuer" if "ISSUER" in fcat else "gateway",
            "failure_step": "authorization",
            "outcome": outcome,
            "recovered": rec,
            "resolution": res,
            "minutes_ago": random.randint(5, 1440),
        })
    
    treatment_count = 0
    control_count = 0
    treatment_recovered = 0
    control_recovered = 0
    treatment_revenue = 0.0
    control_revenue = 0.0
    
    for s in scenarios:
        created = now - timedelta(minutes=s["minutes_ago"])
        
        customer = db.query(Customer).filter(Customer.id == s["cust"]).first()
        hist_rate = customer.historical_success_rate if customer else 0.5
        
        # Create payment
        payment = Payment(
            id=s["pay_id"],
            customer_id=s["cust"],
            order_id=f"order_{s['pay_id'][4:]}",
            amount=s["amount"],
            method=s["method"],
            status="recovered" if s["outcome"] == "RECOVERED" else "failed",
            failure_category=s["failure_cat"],
            failure_reason=s["failure_reason"],
            failure_source=s["failure_source"],
            failure_step=s["failure_step"],
            failure_code=s["failure_cat"],
            created_at=created,
        )
        
        # Run the ML model
        candidates = evaluate_transaction(s["amount"], s["failure_cat"], hist_rate)
        
        if candidates:
            no_action_prob = candidates[-1]["probability"]  # Last one after sort
            # Find the NO_ACTION candidate
            for c in candidates:
                if c["action_type"] == "NO_ACTION":
                    no_action_prob = c["probability"]
                    break
            payment.natural_recovery_prob = no_action_prob
            
            best = candidates[0] if candidates[0]["action_type"] != "NO_ACTION" else (candidates[1] if len(candidates) > 1 else candidates[0])
            payment.best_action = best["action_type"]
            payment.best_action_uplift = best["uplift"]
            payment.best_action_net_value = best["net_incremental_value"]
        
        db.add(payment)
        db.flush()
        
        # Determine treatment vs control
        is_control = random.random() < 0.10  # 10% control
        
        # Create journey
        resolved_at = (created + timedelta(minutes=random.randint(5, 60))) if s["outcome"] == "RECOVERED" else None
        journey = RecoveryJourney(
            payment_id=s["pay_id"],
            customer_id=s["cust"],
            amount_at_risk=s["amount"],
            status=s["outcome"],
            recovered_amount=s["recovered"],
            resolution=s["resolution"] if not is_control else ("NATURAL_RECOVERY" if s["outcome"] == "RECOVERED" else s.get("resolution")),
            started_at=created,
            resolved_at=resolved_at,
            attempt_count=random.randint(0, 3),
        )
        db.add(journey)
        db.flush()
        
        # Experiment tracking
        if is_control:
            control_count += 1
            if s["outcome"] == "RECOVERED":
                control_recovered += 1
                control_revenue += s["recovered"]
        else:
            treatment_count += 1
            if s["outcome"] == "RECOVERED":
                treatment_recovered += 1
                treatment_revenue += s["recovered"]
        
        # Save action candidates
        customer_ctx = {
            "contact_consent": customer.contact_consent if customer else False,
            "previous_recovery_contacts": customer.previous_recovery_contacts if customer else 0,
            "attempt_count": journey.attempt_count,
            "payment_amount": s["amount"],
        }
        
        if candidates:
            best_found = False
            for rank, cand in enumerate(candidates):
                # Special handling for scenario 5 (no consent)
                if s["pay_id"] == "pay_12000005" and cand["action_type"] in ["CUSTOMER_NUDGE", "ALTERNATIVE_PAYMENT_METHOD"]:
                    p_status, p_reason = "BLOCK", "NO_CUSTOMER_CONSENT"
                elif s["pay_id"] == "pay_55000006" and cand["action_type"] != "NO_ACTION":
                    p_status, p_reason = "REQUIRE_APPROVAL", "AMOUNT_REQUIRES_HUMAN_APPROVAL"
                else:
                    p_status, p_reason = evaluate_policies(cand, customer_ctx, policy_map)
                
                is_sel = False
                if not best_found and not is_control:
                    if s["outcome"] == "RECOVERED" and s["resolution"] == "NATURAL_RECOVERY":
                        # Control/natural recovery - select NO_ACTION
                        if cand["action_type"] == "NO_ACTION":
                            is_sel = True
                            best_found = True
                    elif p_status == "ALLOW" and cand["net_incremental_value"] > 0:
                        is_sel = True
                        best_found = True
                    elif cand["action_type"] == "NO_ACTION" and not best_found:
                        pass  # Skip NO_ACTION unless nothing else is valid
                
                if is_control and cand["action_type"] == "NO_ACTION":
                    is_sel = True
                    best_found = True
                
                db_cand = ActionCandidate(
                    journey_id=journey.id,
                    action_type=cand["action_type"],
                    probability=round(cand["probability"], 4),
                    uplift=round(cand["uplift"], 4),
                    action_cost=cand["action_cost"],
                    expected_incremental_revenue=round(cand["expected_incremental_revenue"], 2),
                    net_incremental_value=round(cand["net_incremental_value"], 2),
                    policy_status=p_status,
                    policy_reason=p_reason,
                    is_selected=is_sel,
                    rank=rank + 1,
                )
                db.add(db_cand)
            
            # If no action was selected, default to NO_ACTION
            if not best_found:
                for c in db.query(ActionCandidate).filter(ActionCandidate.journey_id == journey.id, ActionCandidate.action_type == "NO_ACTION").all():
                    c.is_selected = True
        
        # Create RecoveryAction for non-control journeys
        if not is_control and payment.best_action and payment.best_action != "NO_ACTION":
            action_status = "COMPLETED" if s["outcome"] == "RECOVERED" else ("FAILED" if s["pay_id"] == "pay_6500009" else "PENDING")
            ra = RecoveryAction(
                journey_id=journey.id,
                action_type=payment.best_action,
                status=action_status,
                estimated_value=payment.best_action_net_value,
                executed_at=created + timedelta(minutes=2) if action_status != "PENDING" else None,
                created_at=created,
                failure_reason="Payment link API returned 500" if s["pay_id"] == "pay_6500009" else None,
            )
            db.add(ra)
        
        # Audit Events
        audit_events = [
            ("PAYMENT_FAILED", "WEBHOOK", None, None, None, None),
            ("FAILURE_NORMALIZED", "SYSTEM", s["failure_cat"], None, None, "NEW"),
            ("MODEL_EVALUATED", "MODEL", payment.best_action, None, payment.best_action_uplift, "EVALUATING"),
        ]
        
        if s["outcome"] == "RECOVERED":
            audit_events.append(("ACTION_APPROVED", "SYSTEM", payment.best_action, "POLICY_CHECKS_PASSED", None, "ACTION_PENDING"))
            audit_events.append(("PAYMENT_RECOVERED", "WEBHOOK", None, None, None, "RECOVERED"))
        elif s["pay_id"] == "pay_12000005":
            audit_events.append(("ACTION_BLOCKED", "SYSTEM", "CUSTOMER_NUDGE", "NO_CUSTOMER_CONSENT", None, "STOPPED"))
        elif s["pay_id"] == "pay_55000006":
            audit_events.append(("HUMAN_APPROVAL_REQUIRED", "SYSTEM", payment.best_action, "AMOUNT_REQUIRES_HUMAN_APPROVAL", None, "ESCALATED"))
        
        for idx, (etype, actor, decision, reason, uplift, new_state) in enumerate(audit_events):
            db.add(AuditEvent(
                journey_id=journey.id,
                payment_id=s["pay_id"],
                timestamp=created + timedelta(seconds=idx * 2),
                actor_type=actor,
                event_type=etype,
                decision=decision,
                reason=reason,
                estimated_uplift=uplift,
                estimated_incremental_value=payment.best_action_net_value if uplift else None,
                new_state=new_state,
            ))
    
    # Update experiment
    experiment.treatment_count = treatment_count
    experiment.control_count = control_count
    experiment.treatment_recovered = treatment_recovered
    experiment.control_recovered = control_recovered
    experiment.treatment_revenue = round(treatment_revenue, 2)
    experiment.control_revenue = round(control_revenue, 2)
    
    db.commit()
    db.close()
    
    print("=" * 60)
    print("CausalRecover Database Seeded Successfully!")
    print("=" * 60)
    print(f"Customers:   {len(customers_data)}")
    print(f"Payments:    {len(scenarios)}")
    print(f"Policies:    {len(policies)}")
    print(f"Experiment:  Treatment={treatment_count}, Control={control_count}")
    print(f"  Treatment Recovered: {treatment_recovered} (INR {treatment_revenue:,.2f})")
    print(f"  Control Recovered:   {control_recovered} (INR {control_revenue:,.2f})")
    print("=" * 60)

if __name__ == "__main__":
    seed()

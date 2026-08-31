from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from database.models import SessionLocal, Payment, RecoveryJourney, ActionCandidate, Customer
from core.economic_optimizer import evaluate_transaction
from core.policy_engine import evaluate_policies
import hmac
import hashlib
import os

router = APIRouter()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_signature(body: str, signature: str, secret: str):
    expected_mac = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_mac, signature)

@router.post("/api/events/razorpay/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "test_secret_123")
    
    # Local webhook testing may skip validation; deployed integrations must enable it.
    if os.getenv("WEBHOOK_SIGNATURE_REQUIRED", "false").lower() == "true":
        if not signature or not verify_signature(body.decode(), signature, secret):
            raise HTTPException(status_code=400, detail="Invalid signature")
    
    payload = await request.json()
    event_type = payload.get("event")
    
    # We only care about payment.failed for revenue recovery initially
    if event_type == "payment.failed":
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        
        pay_id = payment_entity.get("id")
        amount = payment_entity.get("amount", 0) / 100.0 # Convert paise to INR
        currency = payment_entity.get("currency", "INR")
        failure_reason = payment_entity.get("error_reason", "UNKNOWN")
        failure_code = payment_entity.get("error_code")
        
        # Normalize Razorpay error to our categories
        failure_category = normalize_failure(failure_reason, failure_code)
        
        # 1. Idempotency Check
        existing_payment = db.query(Payment).filter(Payment.id == pay_id).first()
        if existing_payment:
            return {"status": "ok", "message": "Event already processed"}
            
        # 2. Save Payment
        payment = Payment(
            id=pay_id,
            amount=amount,
            currency=currency,
            status="failed",
            failure_category=failure_category
        )
        db.add(payment)
        
        # 3. Create Recovery Journey
        journey = RecoveryJourney(payment_id=pay_id)
        db.add(journey)
        db.commit()
        db.refresh(journey)
        
        # 4. Intelligence Engine (Economic Optimizer)
        # Fallback customer history when no profile has been supplied.
        customer_history = 0.65 
        candidates = evaluate_transaction(amount, failure_category, customer_history)
        
        # 5. Policy Engine & Save Candidates
        best_action_found = False
        
        for cand in candidates:
            status, reason = evaluate_policies(cand)
            db_cand = ActionCandidate(
                journey_id=journey.id,
                action_type=cand['action_type'],
                probability=cand['probability'],
                uplift=cand['uplift'],
                action_cost=cand['action_cost'],
                net_incremental_value=cand['net_incremental_value'],
                policy_status=status
            )
            
            # Select the highest ranked allowed action
            if not best_action_found and status == "ALLOW":
                db_cand.is_selected = True
                best_action_found = True
                
            db.add(db_cand)
            
        db.commit()
        return {"status": "ok", "journey_id": journey.id}
        
    return {"status": "ignored"}

def normalize_failure(reason: str, code: str):
    reason_upper = (reason or "").upper()
    if "ISSUER" in reason_upper or "BANK" in reason_upper:
        return "ISSUER_UNAVAILABLE"
    if "FUNDS" in reason_upper or "BALANCE" in reason_upper:
        return "INSUFFICIENT_FUNDS"
    if "EXPIRED" in reason_upper:
        return "CARD_EXPIRED"
    if "AUTH" in reason_upper:
        return "AUTHENTICATION_FAILED"
    return "UNKNOWN"

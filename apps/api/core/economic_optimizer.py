import joblib
import os
import pandas as pd
import numpy as np

# Load models and encoders lazily
_models = {}
_encoders = {}
_feature_cols = []

def _load_ml_assets():
    global _models, _encoders, _feature_cols
    if _models:
        return
        
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "models"))
    
    try:
        _encoders = joblib.load(os.path.join(models_dir, "encoders.pkl"))
        _feature_cols = joblib.load(os.path.join(models_dir, "feature_cols.pkl"))
        
        actions = ["NO_ACTION", "RETRY_LATER", "ALTERNATIVE_PAYMENT_METHOD", "CUSTOMER_NUDGE", "PAYMENT_LINK", "UPDATE_PAYMENT_INSTRUMENT"]
        for action in actions:
            model_path = os.path.join(models_dir, f"model_{action}.pkl")
            if os.path.exists(model_path):
                _models[action] = joblib.load(model_path)
    except Exception as e:
        print(f"Warning: ML models not found. Using fallback heuristics. {e}")

def evaluate_transaction(amount: float, failure_category: str, historical_success_rate: float = 0.5):
    _load_ml_assets()
    
    # Costs
    action_costs = {
        "NO_ACTION": 0.0, "RETRY_LATER": 1.0, "ALTERNATIVE_PAYMENT_METHOD": 3.0,
        "CUSTOMER_NUDGE": 2.0, "PAYMENT_LINK": 2.5, "UPDATE_PAYMENT_INSTRUMENT": 1.5
    }
    
    candidates = []
    
    if not _models:
        # Fallback if models aren't generated yet
        for action, cost in action_costs.items():
            prob = 0.3 if action == "NO_ACTION" else 0.4
            uplift = 0.0 if action == "NO_ACTION" else 0.1
            candidates.append({
                "action_type": action,
                "probability": prob,
                "uplift": uplift,
                "action_cost": cost,
                "expected_incremental_revenue": (uplift * amount),
                "net_incremental_value": (uplift * amount) - cost
            })
        return sorted(candidates, key=lambda x: x["net_incremental_value"], reverse=True)

    def safe_encode(encoder_name, value):
        if encoder_name not in _encoders: return 0
        le = _encoders[encoder_name]
        return le.transform([value])[0] if value in le.classes_ else 0

    feature_dict = {
        "amount": amount,
        "failure_category_enc": safe_encode("failure_category", failure_category),
        "payment_method_enc": safe_encode("payment_method", "card"),
        "issuer_category_enc": safe_encode("issuer_category", "HDFC"),
        "failure_source_enc": safe_encode("failure_source", "issuer"),
        "hour_of_day": 14,
        "day_of_week": 2,
        "customer_tenure_days": 180,
        "previous_attempts": 1,
        "historical_success_rate": historical_success_rate,
        "historical_upi_success_rate": max(historical_success_rate, 0.6),
        "historical_card_success_rate": historical_success_rate,
        "previous_failures": 2,
        "average_order_value": amount * 1.2,
        "bank_health_score": 0.8,
        "is_repeat_customer": 1,
        "time_since_failure_minutes": 5,
        "previous_recovery_contacts": 1,
        "contact_consent": 1,
        "days_since_last_contact": 10,
    }
    
    X_input = pd.DataFrame([feature_dict])[ _feature_cols ]
    
    base_prob = 0.0
    if "NO_ACTION" in _models:
        base_prob = _models["NO_ACTION"].predict_proba(X_input)[0, 1]
        
    for action, model in _models.items():
        prob = model.predict_proba(X_input)[0, 1]
        uplift = prob - base_prob if action != "NO_ACTION" else 0.0
        cost = action_costs.get(action, 0.0)
        
        candidates.append({
            "action_type": action,
            "probability": float(prob),
            "uplift": float(uplift),
            "action_cost": float(cost),
            "expected_incremental_revenue": float(uplift * amount),
            "net_incremental_value": float((uplift * amount) - cost)
        })
        
    candidates.sort(key=lambda x: x["net_incremental_value"], reverse=True)
    return candidates

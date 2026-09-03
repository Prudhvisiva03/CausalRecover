import joblib
import os
import pandas as pd
import numpy as np
from datetime import datetime

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

def evaluate_transaction(
    amount: float,
    failure_category: str,
    historical_success_rate: float = 0.5,
    payment_method: str = "card",
    failure_source: str = "unknown",
    event_time: datetime | None = None,
    customer_features: dict | None = None,
):
    """Return offline model estimates using only recorded inputs plus explicit imputation.

    The model was trained on semi-synthetic data and expects more features than a
    standard Razorpay failure webhook supplies. Missing merchant-history fields
    receive fixed neutral values; callers must not treat the result as proven
    causal impact.
    """
    _load_ml_assets()
    customer_features = customer_features or {}
    event_time = event_time or datetime.utcnow()
    
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

    def value(name, fallback):
        observed = customer_features.get(name)
        return fallback if observed is None else observed

    feature_dict = {
        "amount": amount,
        "failure_category_enc": safe_encode("failure_category", failure_category),
        "payment_method_enc": safe_encode("payment_method", payment_method),
        # Razorpay's bank name is not the synthetic training taxonomy; OTHER is
        # safer than silently mapping an unknown issuer to the first label.
        "issuer_category_enc": safe_encode("issuer_category", "OTHER"),
        "failure_source_enc": safe_encode("failure_source", failure_source),
        "hour_of_day": event_time.hour,
        "day_of_week": event_time.weekday(),
        "customer_tenure_days": value("customer_tenure_days", 180),
        "previous_attempts": value("previous_attempts", 0),
        "historical_success_rate": historical_success_rate,
        "historical_upi_success_rate": value("historical_upi_success_rate", historical_success_rate),
        "historical_card_success_rate": value("historical_card_success_rate", historical_success_rate),
        "previous_failures": value("previous_failures", 0),
        "average_order_value": value("average_order_value", amount),
        "bank_health_score": value("bank_health_score", 0.5),
        "is_repeat_customer": value("is_repeat_customer", 0),
        "time_since_failure_minutes": value("time_since_failure_minutes", 0),
        "previous_recovery_contacts": value("previous_recovery_contacts", 0),
        "contact_consent": value("contact_consent", 0),
        "days_since_last_contact": value("days_since_last_contact", 14),
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

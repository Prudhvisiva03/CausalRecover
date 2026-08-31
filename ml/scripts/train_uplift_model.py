"""
CausalRecover — Model Training & Evaluation
T-Learner approach using LightGBM for causal uplift estimation.
Produces real evaluation metrics — nothing hardcoded.
"""
import pandas as pd
import numpy as np
import lightgbm as lgb
import joblib
import os
import json
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss, accuracy_score

def train_and_evaluate():
    print("=" * 60)
    print("CausalRecover Model Training & Evaluation")
    print("=" * 60)

    train_df = pd.read_csv("datasets/train.csv")
    test_df = pd.read_csv("datasets/test.csv")

    # ─── FEATURE ENGINEERING ───
    cat_cols = ["failure_category", "payment_method", "issuer_category", "failure_source"]
    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        train_df[f"{col}_enc"] = le.fit_transform(train_df[col])
        test_df[f"{col}_enc"] = le.transform(test_df[col].map(lambda x: x if x in le.classes_ else le.classes_[0]))
        encoders[col] = le

    feature_cols = [
        "amount", "failure_category_enc", "payment_method_enc", "issuer_category_enc",
        "failure_source_enc", "hour_of_day", "day_of_week", "customer_tenure_days",
        "previous_attempts", "historical_success_rate", "historical_upi_success_rate",
        "historical_card_success_rate", "previous_failures", "average_order_value",
        "bank_health_score", "is_repeat_customer", "time_since_failure_minutes",
        "previous_recovery_contacts", "contact_consent", "days_since_last_contact",
    ]

    os.makedirs("models", exist_ok=True)
    joblib.dump(encoders, "models/encoders.pkl")
    joblib.dump(feature_cols, "models/feature_cols.pkl")

    actions = train_df["treatment_action"].unique().tolist()
    metrics = {}

    for action in sorted(actions):
        print(f"\n--- Training: {action} ---")
        action_train = train_df[train_df["treatment_action"] == action]
        action_test = test_df[test_df["treatment_action"] == action]

        if len(action_train) < 50 or len(action_test) < 10:
            print(f"  Skipping {action}: insufficient samples")
            continue

        X_train = action_train[feature_cols]
        y_train = action_train["outcome_recovered"]
        X_test = action_test[feature_cols]
        y_test = action_test["outcome_recovered"]

        model = lgb.LGBMClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            num_leaves=31, min_child_samples=20,
            random_state=42, verbose=-1
        )
        model.fit(X_train, y_train)

        # ─── EVALUATION ───
        y_pred_proba = model.predict_proba(X_test)[:, 1]
        y_pred = model.predict(X_test)

        auc = roc_auc_score(y_test, y_pred_proba)
        pr_auc = average_precision_score(y_test, y_pred_proba)
        brier = brier_score_loss(y_test, y_pred_proba)
        acc = accuracy_score(y_test, y_pred)

        metrics[action] = {
            "samples_train": len(action_train),
            "samples_test": len(action_test),
            "roc_auc": round(auc, 4),
            "pr_auc": round(pr_auc, 4),
            "brier_score": round(brier, 4),
            "accuracy": round(acc, 4),
            "mean_predicted_prob": round(float(y_pred_proba.mean()), 4),
            "actual_recovery_rate": round(float(y_test.mean()), 4),
        }

        print(f"  ROC-AUC: {auc:.4f} | PR-AUC: {pr_auc:.4f} | Brier: {brier:.4f} | Acc: {acc:.4f}")
        print(f"  Train: {len(action_train)} | Test: {len(action_test)}")

        joblib.dump(model, f"models/model_{action}.pkl")

    # ─── UPLIFT EVALUATION ───
    print("\n" + "=" * 60)
    print("UPLIFT EVALUATION (on test set)")
    print("=" * 60)

    no_action_model = joblib.load("models/model_NO_ACTION.pkl")
    X_test_all = test_df[feature_cols]
    base_probs = no_action_model.predict_proba(X_test_all)[:, 1]

    uplift_metrics = {}
    for action in sorted(actions):
        if action == "NO_ACTION":
            continue
        model_path = f"models/model_{action}.pkl"
        if not os.path.exists(model_path):
            continue
        action_model = joblib.load(model_path)
        action_probs = action_model.predict_proba(X_test_all)[:, 1]
        uplift = action_probs - base_probs

        uplift_metrics[action] = {
            "mean_uplift": round(float(uplift.mean()), 4),
            "median_uplift": round(float(np.median(uplift)), 4),
            "std_uplift": round(float(uplift.std()), 4),
            "pct_positive_uplift": round(float((uplift > 0).mean()), 4),
            "max_uplift": round(float(uplift.max()), 4),
        }
        print(f"  {action}: Mean Uplift = {uplift.mean():.4f}, Positive Uplift = {(uplift > 0).mean():.1%}")

    # ─── SAVE MODEL CARD ───
    model_card = {
        "project": "CausalRecover",
        "objective": "Estimate causal effect of recovery interventions on payment recovery",
        "approach": "T-Learner (independent LightGBM model per treatment action)",
        "dataset": "Semi-synthetic with heterogeneous treatment effects",
        "dataset_label": "SYNTHETIC",
        "dataset_size": len(train_df) + len(test_df),
        "train_size": len(train_df),
        "test_size": len(test_df),
        "features": feature_cols,
        "num_features": len(feature_cols),
        "actions": sorted(actions),
        "propensity_metrics": metrics,
        "uplift_metrics": uplift_metrics,
        "known_limitations": [
            "Model trained on semi-synthetic data, not real merchant transactions",
            "Treatment effects are simulated with known DGP, not observed from production",
            "Should NOT be interpreted as proven production uplift",
            "Feature set is limited compared to production requirements",
            "No temporal validation (time-based splits not implemented)",
        ],
        "prohibited_interpretation": [
            "Do not present synthetic evaluation metrics as production accuracy",
            "Do not claim incremental recovery numbers as real financial impact",
        ],
    }

    with open("models/model_card.json", "w") as f:
        json.dump(model_card, f, indent=2)

    print("\n" + "=" * 60)
    print("All models trained. Model card saved to models/model_card.json")
    print("=" * 60)

if __name__ == "__main__":
    train_and_evaluate()

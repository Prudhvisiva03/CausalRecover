"""
CausalRecover — Enhanced Dataset Generator
Generates a reproducible semi-synthetic recovery dataset with 20+ features
and heterogeneous treatment effects for causal evaluation.
"""
import pandas as pd
import numpy as np
import os

def generate_data(num_samples=20000, seed=42):
    np.random.seed(seed)

    # ─── BASE FEATURES ───
    transaction_ids = [f"txn_{i:07d}" for i in range(num_samples)]
    customer_ids = [f"cust_{np.random.randint(1000, 9999):04d}" for _ in range(num_samples)]
    merchant_ids = [f"merch_{np.random.randint(1, 20):02d}" for _ in range(num_samples)]

    amounts = np.random.lognormal(mean=7.5, sigma=1.2, size=num_samples).round(2)
    amounts = np.clip(amounts, 100, 100000)

    currencies = np.array(["INR"] * num_samples)

    payment_methods = np.random.choice(["card", "upi", "netbanking", "wallet"], p=[0.45, 0.35, 0.12, 0.08], size=num_samples)

    issuer_categories = np.random.choice(["HDFC", "ICICI", "SBI", "AXIS", "KOTAK", "OTHER"], p=[0.25, 0.2, 0.15, 0.15, 0.1, 0.15], size=num_samples)

    failure_categories = np.random.choice(
        ["ISSUER_UNAVAILABLE", "INSUFFICIENT_FUNDS", "CARD_EXPIRED", "AUTHENTICATION_FAILED", "GATEWAY_TECHNICAL_ERROR", "TRANSACTION_LIMIT", "UNKNOWN"],
        p=[0.30, 0.20, 0.08, 0.15, 0.12, 0.05, 0.10],
        size=num_samples
    )

    failure_sources = np.where(
        np.isin(failure_categories, ["ISSUER_UNAVAILABLE", "INSUFFICIENT_FUNDS", "CARD_EXPIRED"]), "issuer",
        np.where(np.isin(failure_categories, ["GATEWAY_TECHNICAL_ERROR"]), "gateway",
        np.where(np.isin(failure_categories, ["AUTHENTICATION_FAILED"]), "customer", "unknown"))
    )

    failure_steps = np.where(
        np.isin(failure_categories, ["AUTHENTICATION_FAILED"]), "authentication",
        np.where(np.isin(failure_categories, ["GATEWAY_TECHNICAL_ERROR"]), "processing", "authorization")
    )

    # ─── CUSTOMER FEATURES ───
    hour_of_day = np.random.randint(0, 24, size=num_samples)
    day_of_week = np.random.randint(0, 7, size=num_samples)
    customer_tenure_days = np.random.exponential(180, size=num_samples).astype(int)
    previous_attempts = np.random.poisson(1.5, size=num_samples)
    historical_success_rate = np.random.beta(5, 3, size=num_samples).round(3)
    historical_upi_success_rate = np.random.beta(6, 2, size=num_samples).round(3)
    historical_card_success_rate = np.random.beta(4, 3, size=num_samples).round(3)
    previous_failures = np.random.poisson(2, size=num_samples)
    average_order_value = np.random.lognormal(7, 0.8, size=num_samples).round(2)
    bank_health_score = np.random.beta(8, 2, size=num_samples).round(3)  # 0-1, higher = healthier
    is_repeat_customer = (np.random.random(num_samples) > 0.35).astype(int)
    time_since_failure_minutes = np.random.exponential(30, size=num_samples).round(0)
    previous_recovery_contacts = np.random.poisson(0.8, size=num_samples)
    contact_consent = (np.random.random(num_samples) > 0.15).astype(int)
    days_since_last_contact = np.random.exponential(14, size=num_samples).round(0)

    # ─── TREATMENT ASSIGNMENT (Randomized) ───
    actions = ["NO_ACTION", "RETRY_LATER", "ALTERNATIVE_PAYMENT_METHOD", "CUSTOMER_NUDGE", "PAYMENT_LINK", "UPDATE_PAYMENT_INSTRUMENT"]
    action_probs = [0.20, 0.20, 0.20, 0.15, 0.15, 0.10]
    assigned_actions = np.random.choice(actions, p=action_probs, size=num_samples)

    action_costs = {
        "NO_ACTION": 0.0, "RETRY_LATER": 1.0, "ALTERNATIVE_PAYMENT_METHOD": 3.0,
        "CUSTOMER_NUDGE": 2.0, "PAYMENT_LINK": 2.5, "UPDATE_PAYMENT_INSTRUMENT": 1.5
    }

    # ─── HETEROGENEOUS TREATMENT EFFECTS (Data Generating Process) ───
    outcomes = []
    for i in range(num_samples):
        f = failure_categories[i]
        act = assigned_actions[i]
        sr = historical_success_rate[i]
        bh = bank_health_score[i]
        pm = payment_methods[i]
        amt = amounts[i]
        upi_sr = historical_upi_success_rate[i]
        tenure = customer_tenure_days[i]
        repeat = is_repeat_customer[i]
        contacts = previous_recovery_contacts[i]

        # ─── Natural Recovery (base probability) ───
        base_p = 0.08 + (sr * 0.25) + (bh * 0.1)
        if f == "ISSUER_UNAVAILABLE":
            base_p += 0.08 * bh  # Higher bank health → more natural recovery
        elif f == "INSUFFICIENT_FUNDS":
            base_p -= 0.08
        elif f == "CARD_EXPIRED":
            base_p -= 0.12
        elif f == "GATEWAY_TECHNICAL_ERROR":
            base_p += 0.15  # Gateway issues resolve themselves
        if repeat:
            base_p += 0.05
        if amt > 20000:
            base_p -= 0.05  # Higher amounts less likely to naturally recover
        base_p = np.clip(base_p, 0.02, 0.85)

        # ─── Treatment Effects (Uplift varies by context) ───
        uplift = 0.0
        if act == "NO_ACTION":
            uplift = 0.0
        elif act == "RETRY_LATER":
            if f == "ISSUER_UNAVAILABLE" and bh > 0.7:
                uplift = 0.18  # Bank is recovering, retry helps
            elif f == "INSUFFICIENT_FUNDS":
                uplift = 0.04  # Retry doesn't help much
            elif f == "GATEWAY_TECHNICAL_ERROR":
                uplift = 0.22  # Gateway fixed, retry works well
            else:
                uplift = 0.10
        elif act == "ALTERNATIVE_PAYMENT_METHOD":
            if f in ["ISSUER_UNAVAILABLE", "CARD_EXPIRED"] and upi_sr > 0.6:
                uplift = 0.32  # Strong UPI history + card issue = very effective
            elif f == "ISSUER_UNAVAILABLE":
                uplift = 0.22
            else:
                uplift = 0.12
        elif act == "CUSTOMER_NUDGE":
            if contacts > 3:
                uplift = -0.02  # Contact fatigue → NEGATIVE effect
            elif tenure > 200:
                uplift = 0.12  # Loyal customers respond well
            else:
                uplift = 0.06
        elif act == "PAYMENT_LINK":
            if f in ["ISSUER_UNAVAILABLE", "GATEWAY_TECHNICAL_ERROR"]:
                uplift = 0.20
            else:
                uplift = 0.10
        elif act == "UPDATE_PAYMENT_INSTRUMENT":
            if f == "CARD_EXPIRED":
                uplift = 0.38  # Very effective for expired cards
            else:
                uplift = 0.05  # Not useful for non-card issues

        # Add noise
        uplift += np.random.normal(0, 0.03)
        final_prob = np.clip(base_p + uplift, 0, 1)
        recovered = int(np.random.rand() < final_prob)
        outcomes.append(recovered)

    # ─── BUILD DATAFRAME ───
    df = pd.DataFrame({
        "transaction_id": transaction_ids,
        "customer_id": customer_ids,
        "merchant_id": merchant_ids,
        "amount": amounts,
        "currency": currencies,
        "payment_method": payment_methods,
        "issuer_category": issuer_categories,
        "failure_category": failure_categories,
        "failure_source": failure_sources,
        "failure_step": failure_steps,
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week,
        "customer_tenure_days": customer_tenure_days,
        "previous_attempts": previous_attempts,
        "historical_success_rate": historical_success_rate,
        "historical_upi_success_rate": historical_upi_success_rate,
        "historical_card_success_rate": historical_card_success_rate,
        "previous_failures": previous_failures,
        "average_order_value": average_order_value,
        "bank_health_score": bank_health_score,
        "is_repeat_customer": is_repeat_customer,
        "time_since_failure_minutes": time_since_failure_minutes,
        "previous_recovery_contacts": previous_recovery_contacts,
        "contact_consent": contact_consent,
        "days_since_last_contact": days_since_last_contact,
        "treatment_action": assigned_actions,
        "action_cost": [action_costs[a] for a in assigned_actions],
        "outcome_recovered": outcomes,
    })

    return df

if __name__ == "__main__":
    print("Generating enhanced semi-synthetic dataset (20,000 rows, 28 features)...")
    df = generate_data(20000)

    train_df = df.sample(frac=0.8, random_state=42)
    test_df = df.drop(train_df.index)

    os.makedirs("datasets", exist_ok=True)
    train_df.to_csv("datasets/train.csv", index=False)
    test_df.to_csv("datasets/test.csv", index=False)

    print(f"Train: {len(train_df)} rows | Test: {len(test_df)} rows")
    print(f"Features: {len(df.columns)}")
    print(f"Recovery rate: {df['outcome_recovered'].mean():.2%}")
    print(f"Actions: {df['treatment_action'].value_counts().to_dict()}")
    print("Saved to ml/datasets/")

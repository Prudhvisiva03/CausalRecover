# CausalRecover

> **Recover what would otherwise be lost.**

AI Revenue Recovery Intelligence — Built for [Razorpay AI Buildathon 2026](https://razorpay.com/buildathon), Track 03.

⚠️ **This is NOT an official Razorpay product.** It is an independent hackathon project.

---

## What is CausalRecover?

CausalRecover is an **incrementality-aware AI Revenue Recovery system**. Instead of only predicting whether a customer will repay, it estimates whether a specific intervention will **cause additional recovery** compared with doing nothing, accounts for the cost of that intervention, applies merchant-defined guardrails, executes approved workflows, and measures recovery against a control group.

**Core insight:** Existing systems optimize `P(pay | action)`. CausalRecover optimizes the **incremental effect**:

```
Net Incremental Value = [P(pay|action) - P(pay|no_action)] × amount - action_cost
```

## Problem

Merchants lose revenue through payment failures. Existing recovery workflows often:
- Retry indiscriminately
- Contact customers unnecessarily  
- Give discounts to customers who would have paid anyway
- Measure gross recovered money instead of causal contribution
- Treat each failure independently

## Architecture

```
Razorpay Test Event
        ↓
Event Ingestion + Signature Verification
        ↓
Failure Normalizer (ISSUER_UNAVAILABLE, INSUFFICIENT_FUNDS, etc.)
        ↓
Natural Recovery Model (LightGBM) → P(recovery | no action)
        ↓
Treatment/Uplift Models (T-Learner) → P(recovery | each action)
        ↓
Economic Value Engine → Net Incremental Value calculation
        ↓
Deterministic Policy Engine → Consent, limits, costs, approvals
        ↓
Execution Adapter → Payment links, notifications (sandboxed)
        ↓
Outcome Verification → Webhook confirms recovery
        ↓
Experiment Store → Treatment vs Control measurement
        ↓
Audit Log + Analytics Dashboard
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS |
| ML | LightGBM, scikit-learn, pandas |
| Database | SQLite (local) / PostgreSQL (production) |
| Payment | Razorpay Test Mode API |

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+

### 1. Clone & Setup
```bash
git clone <repo-url>
cd Resorpay
```

### 2. Backend
```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

### 3. ML Pipeline
```bash
cd ml
python scripts/generate_dataset.py
python scripts/train_uplift_model.py
cd ..
```

### 4. Seed Database
```bash
cd apps/api
python seed.py
```

### 5. Start Backend
```bash
cd apps/api
uvicorn main:app --reload --port 8000
```

### 6. Start Frontend
```bash
cd apps/web
npm install
npm run dev
```

### 7. Open
- Dashboard: http://localhost:3000
- Landing Page: http://localhost:3000/landing
- API Docs: http://localhost:8000/docs

## Environment Variables

Copy `.env.example` to `.env`:
```
DATABASE_URL=sqlite:///./causal_recover.db
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_API_URL=http://localhost:8000
WEBHOOK_SIGNATURE_REQUIRED=false
```

## ML Approach

- **T-Learner**: Independent LightGBM model per treatment action
- **Dataset**: 20,000 semi-synthetic rows with heterogeneous treatment effects
- **Features**: 20 features (amount, failure type, customer history, bank health, etc.)
- **Evaluation**: ROC-AUC, PR-AUC, Brier Score, Uplift metrics
- **Model Card**: Auto-generated at `ml/models/model_card.json`

## Key Screens

| Screen | Description |
|--------|------------|
| Overview | KPIs from real DB: Revenue at risk, gross vs incremental recovery |
| At-Risk Payments | Dense data table with filters |
| Journey Detail | **Hero screen**: Causal action comparison with economics |
| Decision Lab | Interactive ML simulator |
| Experiments | Treatment vs Control A/B comparison |
| Audit Trail | Append-only event log |
| Revenue Analytics | Recovery by failure type and action |
| Policies | Merchant-configurable deterministic guardrails |
| Models | ML transparency and model card |

## Security

- Webhook signature validation (HMAC-SHA256)
- Idempotent event processing
- No secrets in frontend bundle
- Deterministic policy engine (AI never overrides rules)
- Append-only audit trail
- Input validation via Pydantic
- No PAN/CVV storage

## Limitations

- Model trained on **semi-synthetic data** — not real merchant transactions
- Communication adapters are sandboxed (no real SMS/WhatsApp)
- Bank health scores are simulated
- Should NOT be interpreted as proven production uplift
- Authentication is minimal in the local development setup

## License

Built for Razorpay AI Buildathon 2026. Not an official Razorpay product.

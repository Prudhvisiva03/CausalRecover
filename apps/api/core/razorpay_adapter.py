"""Minimal Razorpay Test Mode adapter for recovery payment links."""
import os
import razorpay


class RazorpayAdapterError(RuntimeError):
    pass


def create_recovery_payment_link(action_id: int, payment, customer=None, payment_methods: dict | None = None) -> dict:
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise RazorpayAdapterError("Razorpay API keys are not configured")

    client = razorpay.Client(auth=(key_id, key_secret))
    payload = {
        "amount": int(round(payment.amount * 100)),
        "currency": payment.currency or "INR",
        "reference_id": f"cr_{action_id}_{payment.id}"[:40],
        "description": f"Recovery for failed payment {payment.id}",
        "notify": {"sms": False, "email": False},
        "reminder_enable": False,
        "notes": {
            "causalrecover_action_id": str(action_id),
            "original_payment_id": payment.id,
        },
    }
    if customer and customer.email:
        payload["customer"] = {"email": customer.email}
    if payment_methods:
        payload["options"] = {"checkout": {"method": payment_methods}}

    try:
        link = client.payment_link.create(payload)
    except Exception as exc:
        raise RazorpayAdapterError(f"Razorpay payment link creation failed: {exc}") from exc

    return {"id": link["id"], "short_url": link.get("short_url")}


def fetch_recovery_link_outcome(link_id: str) -> dict:
    """Fetch the provider state for a dispatched recovery link.

    This is deliberately a reconciliation fallback, not a replacement for
    webhooks: a valid Razorpay webhook remains the fastest notification path.
    """
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise RazorpayAdapterError("Razorpay API keys are not configured")

    client = razorpay.Client(auth=(key_id, key_secret))
    try:
        link = client.payment_link.fetch(link_id)
        # Payment Link failure attempts belong to its Razorpay order. Querying
        # recent payments lets us identify a decline even while the link stays
        # open for the customer to retry.
        recent = client.payment.all({"count": 100}).get("items", [])
    except Exception as exc:
        raise RazorpayAdapterError(f"Razorpay reconciliation failed: {exc}") from exc

    order_id = link.get("order_id")
    attempts = [payment for payment in recent if order_id and payment.get("order_id") == order_id]
    latest_failure = next((payment for payment in attempts if payment.get("status") == "failed"), None)

    return {
        "link_status": link.get("status"),
        "amount_paid": link.get("amount_paid", 0) / 100.0,
        "latest_failure": latest_failure,
    }

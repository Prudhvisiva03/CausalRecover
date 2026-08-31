CONTACT_ACTIONS = {"CUSTOMER_NUDGE", "ALTERNATIVE_PAYMENT_METHOD", "PAYMENT_LINK", "UPDATE_PAYMENT_INSTRUMENT"}


def _as_bool(value, default: bool) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() == "true"


def _as_float(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_int(value, default: int) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def evaluate_policies(candidate: dict, customer: dict = None, policies: dict = None) -> tuple[str, str]:
    """
    Applies deterministic merchant policies to an action candidate.
    Returns (Status, Reason)
    Status: ALLOW, BLOCK, REQUIRE_APPROVAL
    """
    action = candidate['action_type']
    net_value = candidate['net_incremental_value']
    uplift = candidate['uplift']
    policies = policies or {}
    customer = customer or {}
    
    if action == 'NO_ACTION':
        return "ALLOW", "Baseline action"
        
    # Rule 1: economic viability — do not spend to recover less than the action costs.
    if net_value < 0:
        return "BLOCK", "NEGATIVE_INCREMENTAL_VALUE"
        
    # Rule 2: Do not execute actions with zero or negative uplift
    if uplift <= 0:
        return "BLOCK", "NEGATIVE_UPLIFT"
        
    if net_value < _as_float(policies.get("minimum_expected_incremental_value"), 10):
        return "BLOCK", "BELOW_MINIMUM_INCREMENTAL_VALUE"

    if candidate.get("action_cost", 0) > _as_float(policies.get("max_action_cost"), 50):
        return "BLOCK", "ACTION_COST_EXCEEDS_MERCHANT_LIMIT"

    # Rule 3: consent and contact-fatigue protections.
    if action in CONTACT_ACTIONS and _as_bool(policies.get("require_contact_consent"), True):
        if customer.get("contact_consent") is False:
            return "BLOCK", "NO_CUSTOMER_CONSENT"

    if action in CONTACT_ACTIONS:
        contacts = _as_int(customer.get("previous_recovery_contacts"), 0)
        contact_limit = _as_int(policies.get("max_contacts_per_7_days"), 3)
        if contacts >= contact_limit:
            return "BLOCK", "CONTACT_FREQUENCY_LIMIT_REACHED"

    attempts = _as_int(customer.get("attempt_count"), 0)
    if attempts >= _as_int(policies.get("max_recovery_attempts"), 5):
        return "BLOCK", "MAX_RECOVERY_ATTEMPTS_REACHED"

    if action == "PAYMENT_LINK" and not _as_bool(policies.get("allow_payment_links"), True):
        return "BLOCK", "PAYMENT_LINKS_DISABLED"
    if action == "ALTERNATIVE_PAYMENT_METHOD" and not _as_bool(policies.get("allow_alternative_method"), True):
        return "BLOCK", "ALTERNATIVE_METHODS_DISABLED"
            
    # Rule 4: large payment amounts are explicitly gated for human review.
    payment_amount = _as_float(customer.get("payment_amount"), 0)
    approval_threshold = _as_float(policies.get("human_approval_above_amount"), 25000)
    if payment_amount >= approval_threshold:
        return "REQUIRE_APPROVAL", "AMOUNT_REQUIRES_HUMAN_APPROVAL"
        
    return "ALLOW", "POLICY_CHECKS_PASSED"

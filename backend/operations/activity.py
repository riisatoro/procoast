from .models import ActivityLog


def log_activity(user, action, entity_type, entity_id, summary):
    if user is None or not getattr(user, "is_authenticated", False):
        return
    ActivityLog.objects.create(
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary[:400],
    )

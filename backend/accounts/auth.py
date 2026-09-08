def user_authentication_rule(user):
    return bool(user and user.is_active)

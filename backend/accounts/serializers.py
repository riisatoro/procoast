from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "name",
            "initials",
            "user_type",
            "role",
            "is_active",
            "password",
        )

    def get_role(self, obj):
        if obj.user_type == User.UserType.ADMIN or obj.is_superuser:
            return "ADMINISTRATORS"
        return "DARBINIEKS"

    def validate(self, attrs):
        request = self.context.get("request")
        is_create = self.instance is None
        password = attrs.get("password")
        if is_create and not password:
            raise serializers.ValidationError({"password": "Parole ir obligāta."})
        if (
            request
            and self.instance
            and attrs.get("is_active") is False
            and self.instance.pk == request.user.pk
        ):
            raise serializers.ValidationError(
                {"is_active": "Nevar deaktivizēt savu kontu."}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user_type = validated_data.get("user_type", User.UserType.WORKER)
        user = User(**validated_data)
        user.set_password(password)
        user.is_staff = user_type == User.UserType.ADMIN
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user_type = validated_data.get("user_type", instance.user_type)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        if not instance.is_superuser:
            instance.is_staff = user_type == User.UserType.ADMIN
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField()
    password = serializers.CharField(write_only=True)

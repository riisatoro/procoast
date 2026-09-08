from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import IsAdminType
from .serializers import LoginSerializer, UserSerializer

User = get_user_model()


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ident = serializer.validated_data["login"].strip()
        password = serializer.validated_data["password"]

        user = User.objects.filter(
            Q(username__iexact=ident) | Q(email__iexact=ident)
        ).first()

        if user is None or not user.check_password(password):
            return Response(
                {"detail": "Nepareizs lietotājvārds/e-pasts vai parole"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"detail": "Konts ir deaktivizēts"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListCreateView(ListCreateAPIView):
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminType()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = User.objects.all().order_by("id")
        user = self.request.user
        if not (user.user_type == User.UserType.ADMIN or user.is_superuser):
            qs = qs.filter(is_active=True)
        return qs


class UserDetailView(RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    http_method_names = ["get", "put", "patch", "head", "options"]

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsAuthenticated(), IsAdminType()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = User.objects.all()
        user = self.request.user
        if not (user.user_type == User.UserType.ADMIN or user.is_superuser):
            qs = qs.filter(is_active=True)
        return qs

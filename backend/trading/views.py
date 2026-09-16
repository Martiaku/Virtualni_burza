from decimal import Decimal, InvalidOperation

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from .market import get_quote, get_stock_detail, list_quotes, search_symbols
from .models import Account, Holding, Trade
from .serializers import HoldingSerializer, QuoteSerializer, TradeSerializer


def get_account(user):
    account, _ = Account.objects.get_or_create(user=user)
    return account


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie initialized."})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = str(request.data.get("password", ""))
        email = str(request.data.get("email", "")).strip()
        if len(username) < 3 or len(password) < 8:
            return Response({"detail": "Uživatelské jméno musí mít alespoň 3 znaky a heslo 8 znaků."}, status=400)
        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Toto uživatelské jméno již existuje."}, status=400)
        user = User.objects.create_user(username=username, email=email, password=password)
        Account.objects.create(user=user)
        login(request, user)
        return Response({"username": user.username}, status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        user = authenticate(request, username=username, password=request.data.get("password", ""))
        if not user:
            return Response({"detail": "Neplatné uživatelské jméno nebo heslo."}, status=400)
        login(request, user)
        get_account(user)
        return Response({"username": user.username})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=204)


class ResetPortfolioView(APIView):
    @transaction.atomic
    def post(self, request):
        account = Account.objects.select_for_update().get(pk=get_account(request.user).pk)
        account.holdings.all().delete()
        account.trades.all().delete()
        account.cash = Decimal("100000.00")
        account.save(update_fields=["cash"])
        return Response({"cash": account.cash})


class MeView(APIView):
    def get(self, request):
        return Response({"username": request.user.username, "email": request.user.email})


class MarketView(APIView):
    def get(self, request):
        return Response(QuoteSerializer(list_quotes(), many=True).data)


class MarketSearchView(APIView):
    def get(self, request):
        try:
            return Response(QuoteSerializer(search_symbols(request.query_params.get("q", "")), many=True).data)
        except ValueError:
            return Response({"detail": "Vyhledávání se nepodařilo načíst."}, status=status.HTTP_502_BAD_GATEWAY)


class QuoteView(APIView):
    def get(self, request, symbol):
        try:
            return Response(QuoteSerializer(get_quote(symbol), context={"request": request}).data)
        except (ValueError, InvalidOperation):
            return Response({"detail": "Kotaci se nepodařilo načíst."}, status=status.HTTP_404_NOT_FOUND)


class StockDetailView(APIView):
    def get(self, request, symbol):
        try:
            return Response(get_stock_detail(symbol))
        except (ValueError, InvalidOperation):
            return Response({"detail": "Detail akcie se nepodařilo načíst."}, status=status.HTTP_404_NOT_FOUND)


class PortfolioView(APIView):
    def get(self, request):
        account = get_account(request.user)
        holdings = list(account.holdings.all())
        invested = sum((holding.market_value for holding in holdings), Decimal("0"))
        return Response({
            "cash": account.cash,
            "invested_value": invested,
            "total_value": account.cash + invested,
            "holdings": HoldingSerializer(holdings, many=True).data,
            "trades": TradeSerializer(account.trades.all()[:10], many=True).data,
        })


class TradeView(APIView):
    @transaction.atomic
    def post(self, request):
        account = Account.objects.select_for_update().get(pk=get_account(request.user).pk)
        symbol = str(request.data.get("symbol", "")).upper().strip()
        side = str(request.data.get("side", "")).upper()
        try:
            quantity = Decimal(str(request.data.get("quantity", "")))
            if quantity <= 0 or side not in (Trade.BUY, Trade.SELL):
                raise InvalidOperation
            if side == Trade.SELL and quantity != quantity.to_integral_value():
                raise InvalidOperation
            quote = get_quote(symbol)
            price = quote["price"]
        except (InvalidOperation, ValueError, TypeError):
            return Response({"detail": "Zadejte platný symbol, směr a kladné množství."}, status=status.HTTP_400_BAD_REQUEST)

        holding = Holding.objects.select_for_update().filter(account=account, symbol=symbol).first()
        total = quantity * price
        if side == Trade.BUY:
            if account.cash < total:
                return Response({"detail": "Na tento nákup nemáte dostatek hotovosti."}, status=status.HTTP_400_BAD_REQUEST)
            if holding:
                holding.average_price = ((holding.quantity * holding.average_price) + total) / (holding.quantity + quantity)
                holding.quantity += quantity
                holding.save(update_fields=["quantity", "average_price"])
            else:
                holding = Holding.objects.create(account=account, symbol=symbol, company_name=quote["name"], quantity=quantity, average_price=price)
            account.cash -= total
        else:
            if not holding or holding.quantity < quantity or holding.quantity != holding.quantity.to_integral_value():
                return Response({"detail": "Nemáte dostatek kusů k prodeji."}, status=status.HTTP_400_BAD_REQUEST)
            holding.quantity -= quantity
            account.cash += total
            if holding.quantity == 0:
                holding.delete()
            else:
                holding.save(update_fields=["quantity"])

        account.save(update_fields=["cash"])
        trade = Trade.objects.create(account=account, symbol=symbol, company_name=quote["name"], side=side, quantity=quantity, price=price, total=total)
        return Response(TradeSerializer(trade).data, status=status.HTTP_201_CREATED)


class SellAllView(APIView):
    @transaction.atomic
    def post(self, request):
        account = Account.objects.select_for_update().get(pk=get_account(request.user).pk)
        holdings = list(account.holdings.select_for_update())
        trades = []
        for holding in holdings:
            quote = get_quote(holding.symbol)
            total = holding.quantity * quote["price"]
            account.cash += total
            trades.append(Trade(
                account=account,
                symbol=holding.symbol,
                company_name=holding.company_name,
                side=Trade.SELL,
                quantity=holding.quantity,
                price=quote["price"],
                total=total,
            ))
        if not trades:
            return Response({"detail": "Portfolio neobsahuje žádné pozice."}, status=status.HTTP_400_BAD_REQUEST)
        Trade.objects.bulk_create(trades)
        Holding.objects.filter(account=account).delete()
        account.save(update_fields=["cash"])
        return Response({"sold": len(trades), "cash": account.cash})

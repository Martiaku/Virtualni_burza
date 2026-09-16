from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Account, Holding, Trade


@override_settings(ROOT_URLCONF="config.urls")
class TradingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.quote = {
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "price": Decimal("229.61"),
            "change": Decimal("1.42"),
            "change_percent": Decimal("0.62"),
        }
        self.quote_patcher = patch("trading.market.get_quote", return_value=self.quote)
        self.quote_patcher.start()
        self.view_quote_patcher = patch("trading.views.get_quote", return_value=self.quote)
        self.view_quote_patcher.start()
        self.user = User.objects.create_user(
            username="alice",
            password="secure-password-123",
        )
        Account.objects.create(user=self.user)

    def tearDown(self):
        self.view_quote_patcher.stop()
        self.quote_patcher.stop()
        super().tearDown()

    def login(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "alice", "password": "secure-password-123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_registration_creates_account_and_session(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new-user",
                "email": "new@example.com",
                "password": "secure-password-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="new-user")
        self.assertTrue(self.client.session)
        self.assertEqual(user.account.cash, Decimal("100000.00"))

    def test_portfolio_requires_authentication(self):
        response = self.client.get("/api/portfolio/")

        self.assertEqual(response.status_code, 403)

    def test_buy_and_sell_respect_account_balance_and_holding_quantity(self):
        self.login()

        buy = self.client.post(
            "/api/trades/",
            {"symbol": "AAPL", "side": "BUY", "quantity": "2"},
            format="json",
        )
        self.assertEqual(buy.status_code, 201)
        account = Account.objects.get(user=self.user)
        self.assertEqual(account.cash, Decimal("99540.78"))
        self.assertEqual(account.holdings.get(symbol="AAPL").quantity, Decimal("2"))

        fractional_sell = self.client.post(
            "/api/trades/",
            {"symbol": "AAPL", "side": "SELL", "quantity": "0.5"},
            format="json",
        )
        self.assertEqual(fractional_sell.status_code, 400)

        excessive_sell = self.client.post(
            "/api/trades/",
            {"symbol": "AAPL", "side": "SELL", "quantity": "3"},
            format="json",
        )
        self.assertEqual(excessive_sell.status_code, 400)

        sell = self.client.post(
            "/api/trades/",
            {"symbol": "AAPL", "side": "SELL", "quantity": "1"},
            format="json",
        )
        self.assertEqual(sell.status_code, 201)
        self.assertEqual(
            Account.objects.get(user=self.user).holdings.get(symbol="AAPL").quantity,
            Decimal("1"),
        )

    def test_sell_all_clears_positions_and_restores_proceeds(self):
        self.login()
        account = Account.objects.get(user=self.user)
        Holding.objects.create(
            account=account,
            symbol="AAPL",
            company_name="Apple Inc.",
            quantity=Decimal("2"),
            average_price=Decimal("200.00"),
        )

        response = self.client.post("/api/trades/sell-all/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        account.refresh_from_db()
        self.assertFalse(account.holdings.exists())
        self.assertEqual(account.trades.count(), 1)
        self.assertEqual(account.trades.first().side, Trade.SELL)
        self.assertEqual(account.cash, Decimal("100459.22"))

    def test_reset_portfolio_removes_holdings_and_trades(self):
        self.login()
        account = Account.objects.get(user=self.user)
        Holding.objects.create(
            account=account,
            symbol="MSFT",
            company_name="Microsoft Corporation",
            quantity=Decimal("1"),
            average_price=Decimal("400.00"),
        )
        Trade.objects.create(
            account=account,
            symbol="MSFT",
            company_name="Microsoft Corporation",
            side=Trade.BUY,
            quantity=Decimal("1"),
            price=Decimal("400.00"),
            total=Decimal("400.00"),
        )
        account.cash = Decimal("25.00")
        account.save(update_fields=["cash"])

        response = self.client.post("/api/auth/reset-portfolio/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        account.refresh_from_db()
        self.assertEqual(account.cash, Decimal("100000.00"))
        self.assertFalse(account.holdings.exists())
        self.assertFalse(account.trades.exists())

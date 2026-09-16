from decimal import Decimal

from django.contrib.auth.models import User
from django.db import models


class Account(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="account")
    cash = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("100000.00"))

    @property
    def invested_value(self):
        return sum((holding.market_value for holding in self.holdings.all()), Decimal("0"))


class Holding(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="holdings")
    symbol = models.CharField(max_length=20)
    company_name = models.CharField(max_length=120)
    quantity = models.DecimalField(max_digits=18, decimal_places=6)
    average_price = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["account", "symbol"], name="unique_account_symbol")
        ]

    @property
    def market_value(self):
        from .market import get_quote

        return self.quantity * get_quote(self.symbol)["price"]


class Trade(models.Model):
    BUY = "BUY"
    SELL = "SELL"
    SIDE_CHOICES = [(BUY, "Nákup"), (SELL, "Prodej")]

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="trades")
    symbol = models.CharField(max_length=20)
    company_name = models.CharField(max_length=120)
    side = models.CharField(max_length=4, choices=SIDE_CHOICES)
    quantity = models.DecimalField(max_digits=18, decimal_places=6)
    price = models.DecimalField(max_digits=18, decimal_places=2)
    total = models.DecimalField(max_digits=18, decimal_places=2)
    executed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-executed_at"]

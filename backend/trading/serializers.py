from rest_framework import serializers

from .models import Holding, Trade


class QuoteSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    name = serializers.CharField()
    price = serializers.DecimalField(max_digits=18, decimal_places=2, allow_null=True)
    change = serializers.DecimalField(max_digits=18, decimal_places=2, allow_null=True)
    change_percent = serializers.DecimalField(max_digits=18, decimal_places=2, allow_null=True)


class HoldingSerializer(serializers.ModelSerializer):
    market_value = serializers.DecimalField(read_only=True, max_digits=18, decimal_places=2)
    current_price = serializers.SerializerMethodField()
    profit = serializers.SerializerMethodField()
    profit_percent = serializers.SerializerMethodField()

    class Meta:
        model = Holding
        fields = ["id", "symbol", "company_name", "quantity", "average_price", "current_price", "market_value", "profit", "profit_percent"]

    def get_current_price(self, obj):
        return obj.market_value / obj.quantity

    def get_profit(self, obj):
        return obj.market_value - (obj.quantity * obj.average_price)

    def get_profit_percent(self, obj):
        cost = obj.quantity * obj.average_price
        return ((obj.market_value - cost) / cost * 100) if cost else 0


class TradeSerializer(serializers.ModelSerializer):
    side_label = serializers.CharField(source="get_side_display", read_only=True)

    class Meta:
        model = Trade
        fields = ["id", "symbol", "company_name", "side", "side_label", "quantity", "price", "total", "executed_at"]

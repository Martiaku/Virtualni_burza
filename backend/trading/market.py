import os
import time
from decimal import Decimal

import requests
from requests import RequestException
from django.core.cache import cache

DEMO_QUOTES = {
    "AAPL": {"symbol": "AAPL", "name": "Apple Inc.", "price": Decimal("229.61"), "change": Decimal("1.42"), "change_percent": Decimal("0.62")},
    "MSFT": {"symbol": "MSFT", "name": "Microsoft Corporation", "price": Decimal("506.24"), "change": Decimal("-2.17"), "change_percent": Decimal("-0.43")},
    "NVDA": {"symbol": "NVDA", "name": "NVIDIA Corporation", "price": Decimal("178.14"), "change": Decimal("3.88"), "change_percent": Decimal("2.23")},
    "TSLA": {"symbol": "TSLA", "name": "Tesla, Inc.", "price": Decimal("395.01"), "change": Decimal("-6.42"), "change_percent": Decimal("-1.60")},
    "AMZN": {"symbol": "AMZN", "name": "Amazon.com, Inc.", "price": Decimal("231.48"), "change": Decimal("0.93"), "change_percent": Decimal("0.40")},
    "GOOGL": {"symbol": "GOOGL", "name": "Alphabet Inc.", "price": Decimal("253.42"), "change": Decimal("2.14"), "change_percent": Decimal("0.85")},
}


def get_quote(symbol):
    symbol = symbol.upper().strip()
    cached = cache.get(f"quote:{symbol}")
    if cached:
        return cached

    api_key = os.getenv("FINNHUB_API_KEY")
    if api_key:
        response = requests.get(
            "https://finnhub.io/api/v1/quote",
            params={"symbol": symbol, "token": api_key},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()
        price = Decimal(str(data.get("c", 0)))
        if price <= 0:
            raise ValueError(f"Symbol {symbol} nemá dostupnou kotaci.")
        result = {
            "symbol": symbol,
            "name": symbol,
            "price": price,
            "change": Decimal(str(data.get("d", 0))),
            "change_percent": Decimal(str(data.get("dp", 0))),
        }
    else:
        result = DEMO_QUOTES.get(symbol)
        if not result:
            raise ValueError(f"Symbol {symbol} není v demo datech.")

    cache.set(f"quote:{symbol}", result, 30)
    return result


def list_quotes():
    return [get_quote(symbol) for symbol in DEMO_QUOTES]


def search_symbols(query):
    query = query.strip().upper()
    api_key = os.getenv("FINNHUB_API_KEY")
    if api_key and query:
        response = requests.get(
            "https://finnhub.io/api/v1/search",
            params={"q": query, "token": api_key},
            timeout=5,
        )
        response.raise_for_status()
        return [
            {"symbol": item["symbol"], "name": item["description"], "price": None, "change": None, "change_percent": None}
            for item in response.json().get("result", [])
            if item.get("type") == "Common Stock"
        ][:25]
    return [
        {"symbol": quote["symbol"], "name": quote["name"], "price": quote["price"], "change": quote["change"], "change_percent": quote["change_percent"]}
        for quote in DEMO_QUOTES.values()
        if query in quote["symbol"] or query in quote["name"].upper()
    ]


def get_stock_detail(symbol):
    symbol = symbol.upper().strip()
    quote = get_quote(symbol)
    api_key = os.getenv("FINNHUB_API_KEY")
    candles = []
    if api_key:
        end = int(time.time())
        start = end - (30 * 24 * 60 * 60)
        response = requests.get(
            "https://finnhub.io/api/v1/stock/candle",
            params={"symbol": symbol, "resolution": "D", "from": start, "to": end, "token": api_key},
            timeout=5,
        )
        try:
            response.raise_for_status()
            data = response.json()
            if data.get("s") == "ok":
                candles = [{"time": date, "close": close} for date, close in zip(data["t"], data["c"])]
        except RequestException:
            # Some Finnhub free plans expose quotes but not historical candles.
            candles = []
    return {"quote": quote, "history": candles}

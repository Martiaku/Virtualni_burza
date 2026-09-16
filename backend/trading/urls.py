from django.urls import path

from .views import CsrfView, LoginView, LogoutView, MarketSearchView, MarketView, MeView, PortfolioView, QuoteView, RegisterView, ResetPortfolioView, SellAllView, StockDetailView, TradeView

urlpatterns = [
    path("auth/csrf/", CsrfView.as_view()),
    path("auth/register/", RegisterView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("auth/reset-portfolio/", ResetPortfolioView.as_view()),
    path("auth/me/", MeView.as_view()),
    path("market/", MarketView.as_view()),
    path("market/search/", MarketSearchView.as_view()),
    path("market/<str:symbol>/", QuoteView.as_view()),
    path("market/<str:symbol>/detail/", StockDetailView.as_view()),
    path("portfolio/", PortfolioView.as_view()),
    path("trades/", TradeView.as_view()),
    path("trades/sell-all/", SellAllView.as_view()),
]

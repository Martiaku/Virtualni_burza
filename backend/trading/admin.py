from django.contrib import admin

from .models import Account, Holding, Trade

admin.site.register(Account)
admin.site.register(Holding)
admin.site.register(Trade)

# Stripe invoices to Moneybird

A simple node script to copy your stripe invoices to moneybird as an external invoice. If you want your administration overview in one place.

## Run locally

1. Clone or download this repo
2. Create .env file: `cp .env.example .env`
3. Fill in the correct env values in the `.env` file (More info [here](#enviroment-variables-env))
4. Install dependencies `yarn`
5. Start with command `yarn run start`

## Enviroment Variables (.env)

- [Get stripe secret key](https://dashboard.stripe.com/apikeys)
- [Moneybird api key](https://moneybird.com/user/applications/new)
- Moneybird adminstration id, go to your administration, get the id from the URL
- Moneybird tax rate id, go to your administration settings, select the tax rates tab, click on the tax rate you want to apply, and get the id from the url `.../tax_rates/TAX_RATE_ID/...`

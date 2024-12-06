# Stripe invoices to Moneybird

A simple node script to copy your stripe invoices to moneybird as an external invoice. If you want your administration overview in one place.

## How it works

The script will fetch the invoices from Stripe, including customer information. Based on each payment it will add the customer to Moneybird (if non existing) and it will add an external invoice.

Locally it will store the datetime of the last invoice that was send to moneybird. So next time you run the script, it will only fetch the new invoices. If you want to get the older invoices again, make sure to delete the file `last_uploaded_timestamp.txt`.

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

## Troubleshooting

- You need more than 100 invoices. Stripe allowes a maximum of 100 invoices to be fetched at once. If you want more you need to add a pagination to the script. Please create an issue in Github if you need help.
- Redo previous import. You can't overwrite the import, so you need to remove the previous import(s) manually in the Moneybord dashboard.

Any other questions/reports please report it

## Contributers

- [@babettestam](https://github.com/Babettestam)

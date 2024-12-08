import Stripe from "stripe";

interface StripePayment {
  id: string;
  amount: number;
  created: number;
  description: string | null;
  customer: string | null;
}

interface StripeCustomer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: Stripe.Address | null;
}

interface MoneybirdContact {
  company_name?: string;
  firstname?: string | null;
  lastname?: string;
  email?: string;
  phone?: string | null;
  address1?: string;
  address2?: string;
  city?: string;
  country?: string;
  zipcode?: string;
}

interface StripeTransactionFee {
  id: string;
  amount: number;
  fee: number;
  currency: string;
  created: number;
}

interface PurchaseInvoice {
  contact_id: string;
  invoice_date: string;
  due_date: string;
  reference: string;
  details_attributes: Array<{
    description: string;
    price: number;
    amount: number;
    tax_rate_id: string;
  }>;
}

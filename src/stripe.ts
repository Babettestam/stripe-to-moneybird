import Stripe from "stripe";
import { StripeCustomer, StripePayment, StripeTransactionFee } from "./types";
import { PAYMENTS_LIMIT } from "./config";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Fetch Stripe payments since the last uploaded timestamp
export async function fetchStripePaymentsSince(
  lastTimestamp: number
): Promise<StripePayment[]> {
  try {
    const payments = await stripe.paymentIntents.list({
      created: { gte: lastTimestamp }, // Fetch payments created since the last timestamp
      limit: PAYMENTS_LIMIT, // Adjust if needed
    });
    console.log(payments);

    return payments.data.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      created: payment.created,
      description: payment.description,
      customer: payment.customer as string | null,
    }));
  } catch (error) {
    console.error("Error fetching Stripe payments:", error);
    throw error;
  }
}

export async function fetchStripeCustomer(
  customerId: string
): Promise<StripeCustomer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (typeof customer !== "object" || customer.deleted) return null;

    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || null,
    };
  } catch (error) {
    console.error(`Error fetching Stripe customer ${customerId}:`, error);
    return null;
  }
}

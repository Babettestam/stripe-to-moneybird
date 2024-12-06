import dotenv from "dotenv";
import Stripe from "stripe";
import axios from "axios";

dotenv.config();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const MONEYBIRD_API_TOKEN = process.env.MONEYBIRD_API_TOKEN || "";
const ADMINISTRATION_ID = process.env.MONEYBIRD_ADMINISTRATION_ID || "";
const MONEYBIRD_TAX_RATE_ID = process.env.MONEYBIRD_TAX_RATE_ID || "";

if (!STRIPE_SECRET_KEY || !MONEYBIRD_API_TOKEN || !ADMINISTRATION_ID) {
  throw new Error("Environment variables are missing. Check your .env file.");
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const MONEYBIRD_BASE_URL = "https://moneybird.com/api/v2";

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

async function fetchStripePayments(): Promise<StripePayment[]> {
  try {
    const payments = await stripe.paymentIntents.list({ limit: 10 });
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

async function fetchStripeCustomer(
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

async function findOrCreateContactInMoneybird(
  customer: StripeCustomer
): Promise<string> {
  const contact: MoneybirdContact = {
    firstname: customer.name,
    email: customer.email,
    phone: customer.phone,
    address1: customer.address?.line1 || "",
    address2: customer.address?.line2 || "",
    city: customer.address?.city || "",
    country: customer.address?.country || "",
    zipcode: customer.address?.postal_code || "",
  };

  try {
    // Search for existing contact
    const response = await axios.get(
      `${MONEYBIRD_BASE_URL}/${ADMINISTRATION_ID}/contacts.json?query=${encodeURIComponent(
        customer.email
      )}`,
      {
        headers: { Authorization: `Bearer ${MONEYBIRD_API_TOKEN}` },
      }
    );

    const existingContact = response.data.find(
      (c: any) => c.email === customer.email
    );
    if (existingContact) {
      console.log(
        `Found existing contact for ${customer.email}: ${existingContact.id}`
      );
      return existingContact.id;
    }

    // Create new contact
    const createResponse = await axios.post(
      `${MONEYBIRD_BASE_URL}/${ADMINISTRATION_ID}/contacts.json`,
      { contact },
      {
        headers: {
          Authorization: `Bearer ${MONEYBIRD_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      `Created new contact for ${customer.email}: ${createResponse.data.id}`
    );
    return createResponse.data.id;
  } catch (error: any) {
    console.error(
      "Error finding or creating Moneybird contact:",
      error.response?.data || error
    );
    throw error;
  }
}

async function uploadToMoneybird(
  payment: StripePayment,
  contactId: string
): Promise<void> {
  const documentDate = new Date(payment.created * 1000)
    .toISOString()
    .split("T")[0];

  const externalSalesInvoice = {
    external_sales_invoice: {
      contact_id: contactId,
      document_date: documentDate,
      // due_date: documentDate, // Ensure the due_date is not earlier than document_date
      reference: payment.id,
      description: payment.description || "Stripe Payment",
      details_attributes: [
        {
          description: payment.description || "Stripe Payment",
          price: payment.amount / 100, // Amounts in Stripe are in cents
          amount: 1,
          tax_rate_id: MONEYBIRD_TAX_RATE_ID,
        },
      ],
    },
  };

  try {
    const response = await axios.post(
      `${MONEYBIRD_BASE_URL}/${ADMINISTRATION_ID}/external_sales_invoices.json`,
      externalSalesInvoice,
      {
        headers: {
          Authorization: `Bearer ${MONEYBIRD_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(
      `Uploaded to Moneybird: External Sales Invoice ID ${response.data.id}`
    );
  } catch (error: any) {
    console.error(
      "Error uploading to Moneybird:",
      error.response?.data || error
    );
    throw error;
  }
}

async function main() {
  try {
    console.log("Fetching Stripe payments...");
    const payments = await fetchStripePayments();

    for (const payment of payments) {
      if (payment.customer) {
        console.log(`Fetching customer info for ${payment.customer}...`);
        const customer = await fetchStripeCustomer(payment.customer);
        if (customer) {
          console.log(`Processing customer ${customer.email}...`);
          const contactId = await findOrCreateContactInMoneybird(customer);
          console.log(`Uploading payment ${payment.id} to Moneybird...`);
          await uploadToMoneybird(payment, contactId);
        } else {
          console.warn(
            `No customer found for payment ${payment.id}. Skipping.`
          );
        }
      } else {
        console.warn(
          `Payment ${payment.id} has no associated customer. Skipping.`
        );
      }
    }

    console.log("All payments uploaded successfully.");
  } catch (error) {
    console.error("Error in main process:", error);
  }
}

main();

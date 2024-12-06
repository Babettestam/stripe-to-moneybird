import dotenv from "dotenv";
import Stripe from "stripe";
import axios from "axios";
import fs from "fs";

dotenv.config();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const MONEYBIRD_API_TOKEN = process.env.MONEYBIRD_API_TOKEN || "";
const MONEYBIRD_ADMINISTRATION_ID =
  process.env.MONEYBIRD_ADMINISTRATION_ID || "";
const MONEYBIRD_TAX_RATE_ID = process.env.MONEYBIRD_TAX_RATE_ID || "";
const LAST_UPLOADED_TIMESTAMP_FILE = "./last_uploaded_timestamp.txt";
const PAYMENTS_LIMIT = 100; // Stripe max is 100

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

// Retrieve the last uploaded timestamp
function getLastUploadedTimestamp(): number {
  if (fs.existsSync(LAST_UPLOADED_TIMESTAMP_FILE)) {
    const timestamp = fs.readFileSync(LAST_UPLOADED_TIMESTAMP_FILE, "utf-8");
    return parseInt(timestamp, 10);
  }
  return 0; // Default to 0 if no timestamp exists
}

// Update the last uploaded timestamp
function updateLastUploadedTimestamp(timestamp: number): void {
  console.log(`Updating the last uploaded timestamp to: ${timestamp}`);
  fs.writeFileSync(LAST_UPLOADED_TIMESTAMP_FILE, (timestamp + 1).toString());
}

// Fetch Stripe payments since the last uploaded timestamp
async function fetchStripePaymentsSince(
  lastTimestamp: number
): Promise<StripePayment[]> {
  try {
    const payments = await stripe.paymentIntents.list({
      created: { gte: lastTimestamp }, // Fetch payments created since the last timestamp
      limit: PAYMENTS_LIMIT, // Adjust if needed
    });

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
      `${MONEYBIRD_BASE_URL}/${MONEYBIRD_ADMINISTRATION_ID}/contacts.json?query=${encodeURIComponent(
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
      `${MONEYBIRD_BASE_URL}/${MONEYBIRD_ADMINISTRATION_ID}/contacts.json`,
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
      reference: payment.id,
      description: payment.description || `Stripe Payment ${payment.id}`,
      details_attributes: [
        {
          description: payment.description || `Stripe Payment ${payment.id}`,
          price: payment.amount / 100, // Amounts in Stripe are in cents
          amount: 1,
          tax_rate_id: MONEYBIRD_TAX_RATE_ID,
        },
      ],
    },
  };

  try {
    const response = await axios.post(
      `${MONEYBIRD_BASE_URL}/${MONEYBIRD_ADMINISTRATION_ID}/external_sales_invoices.json`,
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
    console.warn(
      "Error uploading to Moneybird:",
      error.response?.data || error
    );
  }
}

async function main() {
  try {
    console.log("Fetching Stripe payments...");
    const lastTimestamp = getLastUploadedTimestamp();

    const payments = await fetchStripePaymentsSince(lastTimestamp);

    if (payments.length === 0) {
      console.log("No new payments to upload.");
      return;
    }

    let latestTimestamp = lastTimestamp;

    for (const payment of payments) {
      if (payment.customer) {
        console.log(`Fetching customer info for ${payment.customer}...`);
        const customer = await fetchStripeCustomer(payment.customer);
        if (customer) {
          console.log(`Processing customer ${customer.email}...`);
          const contactId = await findOrCreateContactInMoneybird(customer);
          console.log(`Uploading payment ${payment.id} to Moneybird...`);
          await uploadToMoneybird(payment, contactId);

          // Update the latest timestamp
          latestTimestamp = Math.max(latestTimestamp, payment.created);
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

    updateLastUploadedTimestamp(latestTimestamp);

    console.log("All payments uploaded successfully.");
  } catch (error) {
    // console.error("Error in main process:", error);
  }
}

function validateEnvVariables(variables: string[]): void {
  variables.forEach((variable) => {
    if (!process.env[variable]) {
      throw new Error(`Environment variable ${variable} is missing.`);
    }
  });
}

validateEnvVariables([
  "STRIPE_SECRET_KEY",
  "MONEYBIRD_API_TOKEN",
  "MONEYBIRD_ADMINISTRATION_ID",
  "MONEYBIRD_TAX_RATE_ID",
]);

main();

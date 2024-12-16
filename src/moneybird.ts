import { MONEYBIRD_BASE_URL } from "./config";
import axios from "axios";
import { MoneybirdContact, StripeCustomer, StripePayment } from "./types";

const MONEYBIRD_API_TOKEN = process.env.MONEYBIRD_API_TOKEN || "";
const MONEYBIRD_ADMINISTRATION_ID =
  process.env.MONEYBIRD_ADMINISTRATION_ID || "";
const MONEYBIRD_TAX_RATE_ID = process.env.MONEYBIRD_TAX_RATE_ID || "";

export async function findOrCreateContactInMoneybird(
  contact: MoneybirdContact
): Promise<string> {
  const uniqueId = contact.tax_number || contact.company_name;

  try {
    // Search for existing contact
    const response = await axios.get(
      `${MONEYBIRD_BASE_URL}/${MONEYBIRD_ADMINISTRATION_ID}/contacts.json?query=${encodeURIComponent(
        uniqueId
      )}`,
      {
        headers: { Authorization: `Bearer ${MONEYBIRD_API_TOKEN}` },
      }
    );

    const existingContact = response.data.find(
      (c: any) => (c.tax_number || c.company_name) === uniqueId
    );

    if (existingContact) {
      console.log(
        `Found existing contact for ${contact.company_name}: ${existingContact.id}`
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
      `Created new contact for ${contact.company_name}: ${createResponse.data.id}`
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

export async function uploadToMoneybird(
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

import "dotenv/config";
import fs from "fs";
import { LAST_UPLOADED_TIMESTAMP_FILE } from "./config";

import { fetchStripeCustomer, fetchStripePaymentsSince } from "./stripe";
import { findOrCreateContactInMoneybird, uploadToMoneybird } from "./moneybird";

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

async function main() {
  try {
    console.log("Fetching Stripe payments...");
    const lastTimestamp = getLastUploadedTimestamp();

    const payments = await fetchStripePaymentsSince(lastTimestamp);
    console.log(payments);

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

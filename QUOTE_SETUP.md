# Quote Request Integrations

The quote form posts to `/api/quote`. The Vercel function sends the request to the configured email and WhatsApp notification channels. Provider credentials belong in Vercel environment variables, never in browser code or committed files.

## Email

1. Create a Resend API key.
2. Verify the sender domain in Resend.
3. Set `RESEND_API_KEY` and `QUOTE_EMAIL_FROM` in Vercel. `QUOTE_EMAIL_FROM` must use the verified domain.
4. `QUOTE_EMAIL_TO` defaults to `request@translinkmovers.id`; set it explicitly only if the receiving address changes.

## WhatsApp

1. Set up a Meta WhatsApp Cloud API sender and obtain its phone number ID and access token.
2. Create and get approval for an Indonesian message template named `quote_request_notification` with four body variables in this order: customer name, customer WhatsApp, selected service, and route.
3. Set `WHATSAPP_API_VERSION`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_NOTIFICATION_TO`, `WHATSAPP_QUOTE_TEMPLATE`, and `WHATSAPP_TEMPLATE_LANGUAGE` in Vercel. Use digits with country code and no plus sign for `WHATSAPP_NOTIFICATION_TO` (for example, `6285128031767`).
4. The notification recipient must be available on WhatsApp and opted in to receive these notifications. If Meta rejects delivery to the sender number itself, use a separate admin recipient number.

Add the variables under the Vercel project's Settings > Environment Variables for the Production environment, then redeploy. `.env.example` lists the variable names but contains no credentials.

The form reports complete, partial, and failed delivery separately. A partial result means one channel already received the request; check the status before asking the customer to submit again.

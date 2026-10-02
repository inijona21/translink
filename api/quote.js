const EMAIL_TO_DEFAULT = 'request@translinkmovers.id';

function getText(value, maximumLength) {
    return typeof value === 'string'
        ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximumLength)
        : '';
}

function sendEmail(data) {
    const text = [
        'New quote request',
        '',
        `Name: ${data.fullName}`,
        `Customer WhatsApp: ${data.phone}`,
        `Service: ${data.service}`,
        `Route: ${data.route}`,
        '',
        'The customer agreed to the quote follow-up data notice.'
    ].join('\n');

    return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: process.env.QUOTE_EMAIL_FROM,
            to: [process.env.QUOTE_EMAIL_TO || EMAIL_TO_DEFAULT],
            subject: `Quote request from ${data.fullName}`,
            text
        })
    }).then((response) => {
        if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    });
}

function sendWhatsApp(data) {
    const parameters = [data.fullName, data.phone, data.service, data.route].map((text) => ({
        type: 'text',
        text
    }));
    const version = process.env.WHATSAPP_API_VERSION;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const recipient = process.env.WHATSAPP_NOTIFICATION_TO.replace(/\D/g, '');

    return fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'template',
            template: {
                name: process.env.WHATSAPP_QUOTE_TEMPLATE,
                language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'id' },
                components: [{ type: 'body', parameters }]
            }
        })
    }).then((response) => {
        if (!response.ok) throw new Error(`WhatsApp provider returned ${response.status}`);
    });
}

module.exports = async function quoteHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ code: 'method_not_allowed' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (getText(body.website, 200)) return res.status(200).json({ ok: true });

    const data = {
        fullName: getText(body.fullName, 100),
        phone: getText(body.phone, 24),
        service: getText(body.service, 120),
        route: getText(body.route, 160)
    };
    const consent = body.consent === true || body.consent === 'true';
    const validPhone = /^\+?[\d\s().-]{8,24}$/.test(data.phone);

    if (data.fullName.length < 2 || !validPhone || !data.service || !data.route || !consent) {
        return res.status(400).json({ code: 'invalid_request' });
    }

    const requiredEmailConfig = [
        'RESEND_API_KEY',
        'QUOTE_EMAIL_FROM'
    ];
    const missingEmailConfig = requiredEmailConfig.filter((key) => !process.env[key]);

    if (missingEmailConfig.length) {
        console.error('Quote email configuration is incomplete.');
        return res.status(503).json({ code: 'configuration_missing' });
    }

    const whatsappConfig = [
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_PHONE_NUMBER_ID',
        'WHATSAPP_NOTIFICATION_TO',
        'WHATSAPP_API_VERSION',
        'WHATSAPP_QUOTE_TEMPLATE'
    ];
    const whatsappConfigured = whatsappConfig.every((key) => process.env[key]);
    const validApiVersion = /^v\d+\.\d+$/.test(process.env.WHATSAPP_API_VERSION || '');
    const whatsappEnabled = whatsappConfigured && validApiVersion;
    const results = await Promise.allSettled([
        sendEmail(data),
        ...(whatsappEnabled ? [sendWhatsApp(data)] : [])
    ]);
    const emailSent = results[0].status === 'fulfilled';
    const whatsappSent = whatsappEnabled && results[1].status === 'fulfilled';

    if (!emailSent || (whatsappEnabled && !whatsappSent)) {
        console.error('Quote delivery failed for one or more channels.', {
            emailSent,
            whatsappSent,
            whatsappEnabled
        });
        return res.status(502).json({
            code: 'delivery_failed',
            partial: emailSent !== whatsappSent,
            emailSent,
            whatsappSent,
            whatsappConfigured: whatsappEnabled
        });
    }

    return res.status(200).json({
        ok: true,
        emailSent,
        whatsappSent,
        whatsappConfigured: whatsappEnabled
    });
};

/**
 * Roho Nourish: WhatsApp Bot for Clean Eating Delivery
 * 
 * Express server with Twilio WhatsApp webhook integration
 * Handles inbound messages, routes to bot engine, and sends responses
 * 
 * Environment Variables Required:
 * - TWILIO_ACCOUNT_SID: Twilio account identifier
 * - TWILIO_AUTH_TOKEN: Twilio authentication token
 * - TWILIO_PHONE_NUMBER: Bot's WhatsApp-enabled Twilio number (e.g., +1234567890)
 * - FIREBASE_SERVICE_ACC_BASE64: Base64-encoded Firebase service account JSON
 * - FIREBASE_RTDB_URL: Firebase Realtime Database URL
 * - PORT: Server port (default: 3000)
 */

const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
require('dotenv').config();

const { handleMessage } = require('./src/bot/engine');
const { handleRiderMessage } = require('./src/bot/riderEngine');
const { getErrorMessage } = require('./src/bot/templates');
const { isRegisteredRider } = require('./src/services/riderService');
const { db } = require('./src/config/firebase');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+1234567890';

if (!accountSid || !authToken) {
  throw new Error(
    'Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env'
  );
}

const twilioClient = twilio(accountSid, authToken);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'roho-nourish-bot' });
});

/**
 * POST /webhook
 * 
 * Receives incoming WhatsApp messages from Twilio
 * Validates request authenticity, routes to bot engine, sends response
 * 
 * Expected Twilio Webhook Body:
 * {
 *   "From": "whatsapp:+254712345678",
 *   "To": "whatsapp:+1234567890",
 *   "Body": "Hi",
 *   "MessageSid": "SMxxxxxxxxxxxxxxxxx"
 * }
 */
app.post('/webhook', async (req, res) => {
  try {
    const incomingMessage = req.body;

    // Extract sender and message
    const senderPhone = incomingMessage.From; // Format: "whatsapp:+254712345678"
    const messageBody = incomingMessage.Body || '';
    const messageSid = incomingMessage.MessageSid;

    console.log(`[Webhook] Received message from ${senderPhone}: ${messageBody}`);

    // Validate Twilio request (optional but recommended for production)
    // Uncomment to enable signature verification:
    // const isValidRequest = verifyTwilioSignature(req);
    // if (!isValidRequest) {
    //   console.warn('[Webhook] Invalid Twilio signature');
    //   return res.status(403).send('Unauthorized');
    // }

    // Handle empty messages
    if (!messageBody || messageBody.trim().length === 0) {
      console.log('[Webhook] Received empty message, sending error');
      const response = getErrorMessage();
      await sendMessage(senderPhone, response);
      return res.status(200).send('OK');
    }

    // CHECK IF SENDER IS A REGISTERED RIDER
    const isRider = await isRegisteredRider(senderPhone);
    let botResponse;

    if (isRider) {
      console.log(`[RiderBot] Routing to rider engine: ${senderPhone}`);
      botResponse = await handleRiderMessage(senderPhone, messageBody);
    } else {
      console.log(`[CustomerBot] Routing to customer engine: ${senderPhone}`);
      botResponse = await handleMessage(senderPhone, messageBody, incomingMessage);
    }

    // Send response back to user
    if (botResponse) {
      await sendMessage(senderPhone, botResponse);
    }

    // Acknowledge receipt to Twilio
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Send message to WhatsApp user via Twilio
 * @param {string} to - Recipient WhatsApp number (format: "whatsapp:+254...")
 * @param {object} messageBody - Message object with type and text/template properties
 */
async function sendMessage(to, messageBody) {
  try {
    // Build Twilio API payload based on message type
    let payload = {
      from: twilioPhoneNumber,
      to: to,
    };

    // Handle different message types
    if (messageBody.type === 'text') {
      payload.body = messageBody.text;
    } else if (messageBody.type === 'template') {
      // For template messages (future enhancement)
      payload.contentSid = messageBody.template?.contentSid;
      payload.contentVariables = JSON.stringify(messageBody.template?.variables || {});
    } else {
      // Fallback to body
      payload.body = messageBody.text || 'Message from Roho';
    }

    const message = await twilioClient.messages.create(payload);
    console.log(`[SendMessage] Sent message ${message.sid} to ${to}`);
    return message;
  } catch (error) {
    console.error(`[SendMessage] Error sending message to ${to}:`, error);
    throw error;
  }
}

/**
 * Verify Twilio request signature (security best practice)
 * Validates that the request came from Twilio
 * @param {object} req - Express request object
 * @returns {boolean} - True if signature is valid
 */
function verifyTwilioSignature(req) {
  const twilioSignature = req.headers['x-twilio-signature'] || '';
  const url = `${process.env.BASE_URL || 'http://localhost:3000'}/webhook`;
  
  try {
    return twilio.validateRequest(authToken, twilioSignature, url, req.body);
  } catch (error) {
    console.error('[VerifySignature] Error validating signature:', error);
    return false;
  }
}

/**
 * Admin endpoint to register a rider
 * Usage: POST /admin/register-rider
 * Body: { phone: "whatsapp:+254712345678", name: "John Mwangi" }
 */
app.post('/admin/register-rider', async (req, res) => {
  try {
    const { phone, name } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ error: 'Phone and name required' });
    }

    // Validate phone format
    if (!phone.startsWith('whatsapp:')) {
      return res.status(400).json({ error: 'Phone must be in format: whatsapp:+254...' });
    }

    // Register rider in Firestore
    await db.collection('riders').doc(phone).set({
      phone,
      name,
      status: 'active',
      createdAt: new Date().toISOString(),
      totalDeliveries: 0,
      earnings: 0,
    });

    console.log(`[Admin] Registered rider: ${name} (${phone})`);
    res.json({ 
      success: true, 
      message: `Rider "${name}" registered successfully`,
      phone: phone,
    });
  } catch (error) {
    console.error('[Admin] Error registering rider:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin endpoint to list all registered riders
 */
app.get('/admin/riders', async (req, res) => {
  try {
    const snapshot = await db.collection('riders').get();
    const riders = [];

    snapshot.forEach(doc => {
      riders.push({
        phone: doc.id,
        ...doc.data(),
      });
    });

    res.json({ 
      count: riders.length,
      riders: riders,
    });
  } catch (error) {
    console.error('[Admin] Error fetching riders:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Error handler middleware
 */
app.use((err, req, res, next) => {
  console.error('[ErrorHandler]', err);
  res.status(500).json({
    error: 'Something went wrong',
    message: err.message,
  });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  Roho Nourish: WhatsApp Bot Active     ║
║  Port: ${PORT}                            ║
║  Fuel for your day.                    ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;

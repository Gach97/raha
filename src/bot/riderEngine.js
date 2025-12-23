/**
 * Rider Engine - WhatsApp Rider Bot
 * 
 * Wrapper around riderBot that handles command routing
 * Identifies riders by phone and processes their commands
 */

const { handleRiderCommand } = require('./riderBot');

/**
 * Main entry point for rider messages
 * @param {string} riderId - Rider's WhatsApp phone (e.g., "whatsapp:+254...")
 * @param {string} message - Message text from rider
 * @returns {Promise<object>} - Message response to send back
 */
async function handleRiderMessage(riderId, message) {
  try {
    console.log(`[RiderEngine] Processing message from ${riderId}: ${message}`);
    
    // Route to rider bot command handler
    const response = await handleRiderCommand(riderId, message);
    
    return response;
  } catch (error) {
    console.error(`[RiderEngine] Error processing rider message:`, error);
    return {
      type: 'text',
      text: 'Error processing command. Try again or send a command.',
    };
  }
}

module.exports = {
  handleRiderMessage,
};

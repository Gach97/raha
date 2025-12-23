/**
 * State Service
 * 
 * Manages ephemeral user session state in Firebase Realtime Database.
 * Tracks current user step, temporary cart data, and session metadata.
 * 
 * State Machine Stages:
 * - WELCOME: Initial contact, shown interactive buttons
 * - SELECTING_FOOD: Viewing menu list, making food selection
 * - CONFIRM_ORDER: Selected item shown, awaiting location input
 * - PAYMENT: Ready for M-PESA prompt, simulating payment
 * - ORDER_COMPLETE: Order placed, session cleanup
 */

const { rtdb } = require('../config/firebase');

/**
 * Get current user state from Realtime Database
 * @param {string} phone - User's phone number (WhatsApp format: +254...)
 * @returns {Promise<object>} - Current state object with step, data, timestamp
 */
async function getUserState(phone) {
  try {
    const ref = rtdb.ref(`sessions/${phone}`);
    const snapshot = await ref.once('value');
    
    if (!snapshot.exists()) {
      // New user: initialize fresh session
      return {
        step: 'WELCOME',
        data: {},
        createdAt: Date.now(),
      };
    }
    
    return snapshot.val();
  } catch (error) {
    console.error(`[StateService] Error getting state for ${phone}:`, error);
    return { step: 'WELCOME', data: {} };
  }
}

/**
 * Update user state in Realtime Database
 * Merges new state with existing session data
 * @param {string} phone - User's phone number
 * @param {string} newStep - New state/step (e.g., 'SELECTING_FOOD')
 * @param {object} data - Additional data to merge (cart, selection, location, etc.)
 * @returns {Promise<void>}
 */
async function updateUserState(phone, newStep, data = {}) {
  try {
    const ref = rtdb.ref(`sessions/${phone}`);
    
    const updates = {
      step: newStep,
      lastUpdated: Date.now(),
    };
    
    // Merge new data with existing session data
    if (Object.keys(data).length > 0) {
      updates.data = data;
    }
    
    await ref.update(updates);
    console.log(`[StateService] Updated state for ${phone} to ${newStep}`);
  } catch (error) {
    console.error(`[StateService] Error updating state for ${phone}:`, error);
  }
}

/**
 * Get existing session data (for cart, selections, etc.)
 * @param {string} phone - User's phone number
 * @returns {Promise<object>} - Session data object
 */
async function getSessionData(phone) {
  try {
    const state = await getUserState(phone);
    return state.data || {};
  } catch (error) {
    console.error(`[StateService] Error getting session data for ${phone}:`, error);
    return {};
  }
}

/**
 * Merge data into existing session (non-destructive update)
 * @param {string} phone - User's phone number
 * @param {object} newData - Data to merge
 * @returns {Promise<void>}
 */
async function mergeSessionData(phone, newData) {
  try {
    const currentData = await getSessionData(phone);
    const merged = { ...currentData, ...newData };
    const ref = rtdb.ref(`sessions/${phone}/data`);
    await ref.update(merged);
    console.log(`[StateService] Merged session data for ${phone}:`, newData);
  } catch (error) {
    console.error(`[StateService] Error merging session data for ${phone}:`, error);
  }
}

/**
 * Clear session (logout/reset)
 * @param {string} phone - User's phone number
 * @returns {Promise<void>}
 */
async function clearSession(phone) {
  try {
    const ref = rtdb.ref(`sessions/${phone}`);
    await ref.remove();
    console.log(`[StateService] Cleared session for ${phone}`);
  } catch (error) {
    console.error(`[StateService] Error clearing session for ${phone}:`, error);
  }
}

module.exports = {
  getUserState,
  updateUserState,
  getSessionData,
  mergeSessionData,
  clearSession,
};

/**
 * Firebase Configuration
 * 
 * Initializes Firebase Admin SDK with:
 * - Firestore for persistent data (Users, Orders, Menu, Kitchen Profiles)
 * - Realtime Database for ephemeral session state
 * 
 * Service account credentials are Base64 encoded in FIREBASE_SERVICE_ACC_BASE64 env var
 */

const admin = require('firebase-admin');

// Decode Base64 service account from environment
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACC_BASE64;

if (!serviceAccountBase64) {
  throw new Error('FIREBASE_SERVICE_ACC_BASE64 environment variable is not set');
}

// Decode from Base64 to JSON object
const serviceAccountJSON = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
const serviceAccount = JSON.parse(serviceAccountJSON);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_RTDB_URL || 'https://roho-nourish.firebaseio.com',
});

// Export Firestore (persistent data) and Realtime Database (session state)
const db = admin.firestore();
const rtdb = admin.database();

module.exports = {
  admin,
  db,           // Firestore instance
  rtdb,         // Realtime Database instance
};

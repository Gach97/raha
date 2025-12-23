const admin = require('firebase-admin');

let db = null;

/**
 * Initialize Firebase Admin SDK with base64 encoded service account key from .env
 * The SERVICE env variable should be a base64 encoded JSON service account key
 */
const initializeFirebase = () => {
  try {
    const serviceAccountBase64 = process.env.SERVICE;
    
    if (!serviceAccountBase64) {
      throw new Error('SERVICE environment variable is not set. Please provide base64 encoded Firebase service account key.');
    }

    // Decode base64 service account
    const serviceAccountJSON = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJSON);

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DB_URL // Optional: for Realtime Database
    });

    db = admin.firestore();
    
    console.log('✅ Firebase Admin initialized successfully');
    return db;
  } catch (err) {
    console.error('❌ Firebase initialization failed:', err.message);
    throw err;
  }
};

/**
 * Get Firestore instance
 */
const getFirestore = () => {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
};

/**
 * Get Firebase Admin SDK instance
 */
const getAdmin = () => admin;

module.exports = {
  initializeFirebase,
  getFirestore,
  getAdmin
};

import { Client, Databases, ID } from 'node-appwrite';

/**
 * Calculates the great-circle distance between two points on the Earth's surface.
 * Using the Haversine formula.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Environment variables
const DATABASE_ID = process.env.DATABASE_ID || 'attendance-db';
const SESSIONS_COLLECTION_ID = process.env.SESSIONS_COLLECTION_ID || 'sessions';
const RECORDS_COLLECTION_ID = process.env.RECORDS_COLLECTION_ID || 'records';
const MAX_DISTANCE_METERS = 100;

export default async ({ req, res, log, error }) => {
  // 1. Initialize Appwrite Client
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    // 2. Parse Input
    // Expecting JSON payload: { "sessionId": "...", "studentId": "...", "recordedLat": 1.0, "recordedLon": 1.0 }
    let payload = {};
    if (typeof req.body === 'string') {
      try {
        payload = JSON.parse(req.body);
      } catch (e) {
        payload = {};
      }
    } else {
      payload = req.body || {};
    }

    const { sessionId, studentId, recordedLat, recordedLon } = payload;

    if (!sessionId || !studentId || recordedLat === undefined || recordedLon === undefined) {
      return res.json({
        success: false,
        message: 'Missing required parameters: sessionId, studentId, recordedLat, recordedLon'
      }, 400);
    }

    // 3. Retrieve Session Data
    const sessionDoc = await databases.getDocument(
      DATABASE_ID,
      SESSIONS_COLLECTION_ID,
      sessionId
    );

    // 4. Validate Session Active Status & Time
    
    // Check 1: Manual "Active" Toggle
    if (!sessionDoc.isActive) {
      return res.json({
        success: false,
        message: 'Session is marked as closed by the lecturer.'
      }, 403);
    }

    // Check 2: Time Expiration
    // We expect sessionDoc.endTime to exist. If not, we assume indefinite or fallback to isActive.
    if (sessionDoc.endTime) {
        const now = new Date();
        const endTime = new Date(sessionDoc.endTime);
        
        if (now > endTime) {
            return res.json({
                success: false,
                message: 'Session time has expired.'
            }, 403);
        }
    }

    // 5. Calculate Distance (Geofence Check)
    const distance = getDistanceFromLatLonInMeters(
      parseFloat(recordedLat),
      parseFloat(recordedLon),
      sessionDoc.venueLat,
      sessionDoc.venueLon
    );

    log(`Distance calculated: ${distance} meters. Max allowed: ${MAX_DISTANCE_METERS}`);

    if (distance > MAX_DISTANCE_METERS) {
      return res.json({
        success: false,
        message: `You are too far from the venue. Distance: ${Math.round(distance)}m.`,
        error_code: 'OUT_OF_GEOFENCE'
      }, 403);
    }

    // 6. Check for duplicate record
    try {
        // Optimistic check. In production, use Query.equal to prevent duplicates.
    } catch (e) {
      // Ignore
    }

    // 7. Create Attendance Record
    const record = await databases.createDocument(
      DATABASE_ID,
      RECORDS_COLLECTION_ID,
      ID.unique(),
      {
        sessionId: sessionId,
        studentId: studentId,
        timestamp: new Date().toISOString(),
        status: 'present',
      },
    );

    return res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: record
    }, 200);

  } catch (err) {
    error(`Error marking attendance: ${err.message}`);
    return res.json({
      success: false,
      message: 'Internal server error processing attendance.',
      debug: err.message
    }, 500);
  }
};

import { Client, Databases, Users, ID, Query } from 'node-appwrite';

// Environment variables
const DATABASE_ID = process.env.DATABASE_ID || 'attendance-db';
const USERS_COLLECTION_ID = process.env.USERS_COLLECTION_ID || 'users';

export default async ({ req, res, log, error }) => {
  // 1. Initialize Appwrite Client with API Key (Admin Access)
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const users = new Users(client);

  try {
    // 2. Identify the Caller
    // The Client SDK sends the execution trigger user's ID in this header.
    const callerId = req.headers['x-appwrite-user-id'];

    if (!callerId) {
        return res.json({ success: false, message: 'Unauthorized execution.' }, 401);
    }

    // 3. Verify Caller is a Lecturer (Admin)
    try {
        const callerDoc = await databases.getDocument(
            DATABASE_ID, 
            USERS_COLLECTION_ID, 
            callerId
        );

        if (callerDoc.role !== 'lecturer') {
             return res.json({ success: false, message: 'Only lecturers can perform bulk imports.' }, 403);
        }
    } catch (e) {
        return res.json({ success: false, message: 'Caller profile not found.' }, 403);
    }

    // 4. Parse Input
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

    const { users: newUsers } = payload; // Expecting array of { name, email, password }

    if (!Array.isArray(newUsers) || newUsers.length === 0) {
        return res.json({ success: false, message: 'Invalid payload. Expected "users" array.' }, 400);
    }

    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    // 5. Iterate and Create Users
    for (const user of newUsers) {
        const { name, email, password } = user;
        
        if (!email || !password || !name) {
            results.failed++;
            results.errors.push(`Missing fields for ${email || 'unknown entry'}`);
            continue;
        }

        try {
            // A. Create Auth Account
            // Note: This creates the user in Appwrite Auth
            const userId = ID.unique();
            await users.create(userId, email, undefined, password, name);

            // B. Create Database Profile
            // This ensures the user exists in our 'users' collection with 'student' role
            await databases.createDocument(
                DATABASE_ID,
                USERS_COLLECTION_ID,
                userId, // Match Auth ID
                {
                    name: name,
                    email: email,
                    role: 'student' // Default role for imports
                }
            );

            results.success++;
        } catch (err) {
            results.failed++;
            // Handle "User already exists" gracefully
            if (err.code === 409) {
                results.errors.push(`User already exists: ${email}`);
            } else {
                results.errors.push(`Failed to create ${email}: ${err.message}`);
            }
        }
    }

    return res.json({
      success: true,
      message: 'Bulk import processed.',
      data: results
    }, 200);

  } catch (err) {
    error(`Error in bulk import: ${err.message}`);
    return res.json({
      success: false,
      message: 'Internal server error.',
      debug: err.message
    }, 500);
  }
};

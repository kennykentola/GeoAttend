import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { account, databases } from '../config/appwriteConfig';
import { ID, AppwriteException } from 'appwrite';
import { UserProfile, UserRole } from '../../types';
import { DATABASE_ID, USERS_COLLECTION_ID } from '../config/constants';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string, forceRole?: UserRole) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  checkUserStatus: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resetPassword: (userId: string, secret: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Key for persisting dev mode user
const DEV_USER_KEY = 'hia_dev_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleError = (error: any, action: string) => {
    console.error(`${action} failed:`, error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Connection failed. Please check your Appwrite Project ID in src/config/constants.ts and ensure the endpoint is reachable.`);
    }
    if (error instanceof AppwriteException) {
      throw new Error(error.message);
    }
    throw error;
  };

  const fetchUserProfile = useCallback(async (userId: string, name: string, email: string) => {
    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        userId
      );
      
      setUser({
        $id: doc.$id,
        name: doc.name,
        email: doc.email,
        role: doc.role as UserRole,
      });
    } catch (error) {
      console.warn("User profile not found in database. Ensure the 'users' collection exists and permissions are set.", error);
      // Fallback if profile doesn't exist but auth does (should not happen in normal flow)
      setUser({
        $id: userId,
        name: name,
        email: email,
        role: UserRole.STUDENT // Default fallback
      });
    }
  }, []);

  const checkUserStatus = useCallback(async () => {
    // 1. Check for Dev Mode User Bypass
    const devUserJson = localStorage.getItem(DEV_USER_KEY);
    if (devUserJson) {
      setUser(JSON.parse(devUserJson));
      setLoading(false);
      return;
    }

    // 2. Normal Appwrite Check
    try {
      const accountDetails = await account.get();
      await fetchUserProfile(accountDetails.$id, accountDetails.name, accountDetails.email);
    } catch (error) {
      // 401 Unauthorized is expected if no session exists
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    checkUserStatus();
  }, [checkUserStatus]);

  const login = async (email: string, password: string, forceRole?: UserRole) => {
    setLoading(true);

    // --- TEMPORARY BYPASS FOR SPECIFIC USER ---
    // Strictly checking email AND password as requested
    if (email === 'peterkehindeademola@gmail.com' && password === 'kehinde5@') {
        const role = forceRole || UserRole.LECTURER;
        const mockUser: UserProfile = {
            $id: role === UserRole.STUDENT ? 'dev-peter-student-id' : role === UserRole.ADMIN ? 'dev-admin-id' : 'dev-peter-id',
            name: role === UserRole.STUDENT ? 'Peter (Dev Student)' : role === UserRole.ADMIN ? 'System Administrator' : 'Peter (Dev)',
            email: email,
            role: role
        };
        setUser(mockUser);
        localStorage.setItem(DEV_USER_KEY, JSON.stringify(mockUser));
        setLoading(false);
        return;
    }
    // ------------------------------------------

    try {
      await account.createEmailPasswordSession(email, password);
      await checkUserStatus();
    } catch (error) {
      setLoading(false);
      handleError(error, 'Login');
    }
  };

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    setLoading(true);
    try {
      const userId = ID.unique();
      // 1. Create Account
      await account.create(userId, email, password, name);

      // 2. Login immediately
      await account.createEmailPasswordSession(email, password);

      // 3. Create User Profile
      await databases.createDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        userId,
        {
          name,
          email,
          role
        }
      );

      await checkUserStatus();
    } catch (error) {
      setLoading(false);
      handleError(error, 'Registration');
    }
  };

  const logout = async () => {
    // Clear dev user if exists
    localStorage.removeItem(DEV_USER_KEY);
    
    try {
      await account.deleteSession('current');
    } catch (error) {
      console.warn("Logout warning (possibly dev mode):", error);
    }
    setUser(null);
  };

  const sendPasswordReset = async (email: string) => {
    try {
      // Construct the redirect URL to the reset-password route
      const redirectUrl = `${window.location.origin}/#/reset-password`;
      await account.createRecovery(email, redirectUrl);
    } catch (error) {
      handleError(error, 'Password Reset Request');
    }
  };

  const resetPassword = async (userId: string, secret: string, password: string) => {
    try {
      await account.updateRecovery(userId, secret, password);
    } catch (error) {
      handleError(error, 'Password Reset Confirmation');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkUserStatus, sendPasswordReset, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
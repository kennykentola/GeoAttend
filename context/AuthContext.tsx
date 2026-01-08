
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Models, ID } from 'appwrite';
import { account, databases } from '../config/appwriteConfig';
import { DATABASE_ID, USERS_COLLECTION_ID } from '../config/constants';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string, devRole?: UserRole) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resetPassword: (userId: string, secret: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ensureArray = (val: any): string[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val) return [val];
  return [];
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!userId || userId === 'dev-bypass-node') return null;
    try {
      const doc = await databases.getDocument(DATABASE_ID, USERS_COLLECTION_ID, userId);
      return {
        $id: doc.$id,
        name: doc.name,
        email: doc.email,
        roles: ensureArray(doc.roles || doc.role),
        lastLogin: doc.lastLogin,
      };
    } catch (error) {
      console.warn('Profile record not found in database for user:', userId);
      return null;
    }
  };

  const refreshUser = async () => {
    try {
      const session = await account.get();
      const profile = await fetchUserProfile(session.$id);
      if (profile) {
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string, devRole?: UserRole) => {
    setLoading(true);
    const isDev = email === 'peterkehindeademola@gmail.com' && password === 'kehinde5@';
    
    try {
      try {
        await account.createEmailPasswordSession(email, password);
      } catch (authError: any) {
        const isNetworkError = 
          authError.message?.toLowerCase().includes('fetch') || 
          authError.name === 'FetchError' || 
          authError.code === 0 ||
          authError.message?.toLowerCase().includes('network error') ||
          authError.message?.toLowerCase().includes('blocked');

        // CRITICAL BYPASS: If developer credentials and network fails/blocked, allow access via local simulation
        if (isDev && isNetworkError) {
          console.warn("Handshake Failed: Developer Bypass active. Domain likely not whitelisted.");
          setUser({
            $id: 'dev-bypass-node',
            name: 'Developer Identity',
            email: email,
            roles: devRole ? [devRole] : [UserRole.ADMIN],
            lastLogin: new Date().toISOString()
          });
          setLoading(false);
          return;
        }

        if (isNetworkError) {
          throw new Error('Network Handshake Failed: The request was blocked. Ensure your Appwrite Project ID is correct and your domain is added as a Web Platform in the Appwrite Console.');
        }
        throw authError;
      }

      const session = await account.get();
      const profile = await fetchUserProfile(session.$id);
      
      const identity = profile || { 
        $id: session.$id, 
        name: session.name, 
        email: session.email, 
        roles: devRole ? [devRole] : [] 
      };
      
      setUser(identity);
    } catch (error: any) {
      console.error("Authentication Error Details:", error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    setLoading(true);
    try {
      const userId = ID.unique();
      await account.create(userId, email, password, name);
      await account.createEmailPasswordSession(email, password);
      
      await databases.createDocument(DATABASE_ID, USERS_COLLECTION_ID, userId, {
        name,
        email,
        roles: [role],
        lastLogin: new Date().toISOString(),
      });
      
      setUser({
        $id: userId,
        name,
        email,
        roles: [role],
        lastLogin: new Date().toISOString(),
      });
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await account.deleteSession('current');
    } catch (error) {
      console.warn('Session termination handled locally.');
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await account.createRecovery(email, `${window.location.origin}/#/reset-password`);
  };

  const resetPassword = async (userId: string, secret: string, password: string) => {
    await account.updateRecovery(userId, secret, password);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, sendPasswordReset, resetPassword, refreshUser }}>
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

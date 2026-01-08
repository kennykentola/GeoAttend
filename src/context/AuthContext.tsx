import React, { createContext, useContext, useState, useEffect } from 'react';
import { Models, ID } from 'appwrite';
import { account, databases } from '../config/appwriteConfig';
import { DATABASE_ID, USERS_COLLECTION_ID } from '../config/constants';
// @ts-ignore
import { UserProfile, UserRole } from '../../types';

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
    try {
      const doc = await databases.getDocument(DATABASE_ID, USERS_COLLECTION_ID, userId);
      return {
        $id: doc.$id,
        name: doc.name,
        email: doc.email,
        roles: ensureArray(doc.roles || doc.role),
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
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
    try {
      await account.createEmailPasswordSession(email, password);
      const session = await account.get();
      let profile = await fetchUserProfile(session.$id);
      
      if (!profile && devRole) {
        // Create profile on the fly for dev/bypass if it doesn't exist
        const newDoc = await databases.createDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          session.$id,
          {
            name: session.name || 'Bypass User',
            email: session.email,
            roles: [devRole],
          }
        );
        profile = {
          $id: newDoc.$id,
          name: newDoc.name,
          email: newDoc.email,
          roles: [devRole],
        };
      }
      
      setUser(profile);
    } catch (error) {
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
      
      await databases.createDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        userId,
        {
          name,
          email,
          roles: [role],
        }
      );
      
      setUser({
        $id: userId,
        name,
        email,
        roles: [role],
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
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    // Note: This requires a properly configured hostname in Appwrite
    await account.createRecovery(email, `${window.location.origin}/#/reset-password`);
  };

  // Fixed: account.updateRecovery expects 3 arguments in this SDK version
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
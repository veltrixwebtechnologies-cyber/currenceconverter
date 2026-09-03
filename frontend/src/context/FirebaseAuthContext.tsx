import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  firebaseSignOut,
  onAuthStateChanged,
  type User
} from '../firebase';

interface FirebaseAuthContextType {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType>({
  user: null,
  isLoaded: false,
  isSignedIn: false,
  signInWithGoogle: async () => null,
  signOut: async () => { },
  getIdToken: async () => null,
});

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: any) {
      if (err?.code === 'auth/configuration-not-found') {
        const errorMsg = 'Google Sign-in is not enabled in Firebase Console. Please go to Firebase Console -> Authentication -> Sign-in method and enable Google.';
        console.error('[HoverConvert]', errorMsg, err);
        alert(errorMsg);
        throw new Error(errorMsg);
      }

      console.warn('[HoverConvert] Popup sign-in warning, trying redirect:', err?.message || err);
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectErr: any) {
        console.error('[HoverConvert] Firebase Google sign-in failed:', redirectErr);
        if (redirectErr?.code === 'auth/configuration-not-found') {
          alert('Google Sign-in is not enabled in Firebase Console. Please go to Firebase Console -> Authentication -> Sign-in method and enable Google.');
        }
        throw redirectErr;
      }
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('[HoverConvert] Sign out error:', err);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch (err) {
      console.error('[HoverConvert] Failed to get Firebase ID token:', err);
      return null;
    }
  };

  return (
    <FirebaseAuthContext.Provider
      value={{
        user,
        isLoaded,
        isSignedIn: !!user,
        signInWithGoogle,
        signOut,
        getIdToken
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
};

export const useFirebaseAuth = () => useContext(FirebaseAuthContext);

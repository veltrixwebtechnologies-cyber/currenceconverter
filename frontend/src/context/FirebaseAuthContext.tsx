import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
    // Process pending redirect auth result on mount
    getRedirectResult(auth)
      .then((result: any) => {
        if (result?.user) {
          setUser(result.user);
        }
      })
      .catch((err: any) => {
        console.error('[HoverConvert] Firebase redirect sign-in error:', err);
        if (err?.code === 'auth/unauthorized-domain') {
          alert(`Domain "${window.location.hostname}" is not authorized for Google Sign-In in Firebase Console. Please add "${window.location.hostname}" under Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
        } else if (err?.code === 'auth/configuration-not-found' || err?.code === 'auth/operation-not-allowed') {
          alert('Google Sign-in is not enabled in Firebase Console. Please go to Firebase Console -> Authentication -> Sign-in method and enable Google.');
        }
      });

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
      console.warn('[HoverConvert] Popup sign-in notice:', err?.code, err?.message);

      // User closed popup or cancelled request — do not attempt redirect fallback
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log('[HoverConvert] Google Sign-In cancelled by user.');
        return null;
      }

      // Provider missing in Firebase Console
      if (err?.code === 'auth/configuration-not-found' || err?.code === 'auth/operation-not-allowed') {
        const errorMsg = 'Google Sign-in is not enabled in Firebase Console. Please go to Firebase Console -> Authentication -> Sign-in method and enable Google.';
        console.error('[HoverConvert]', errorMsg, err);
        alert(errorMsg);
        throw new Error(errorMsg);
      }

      // Domain unauthorized in Firebase Console
      if (err?.code === 'auth/unauthorized-domain') {
        const errorMsg = `Domain "${window.location.hostname}" is not authorized for Google Sign-In in Firebase Console. Please add "${window.location.hostname}" under Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
        console.error('[HoverConvert]', errorMsg, err);
        alert(errorMsg);
        throw new Error(errorMsg);
      }

      // Popup blocked by browser — fallback to redirect
      if (err?.code === 'auth/popup-blocked') {
        console.warn('[HoverConvert] Popup blocked by browser, attempting redirect fallback...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectErr: any) {
          console.error('[HoverConvert] Firebase Google sign-in redirect failed:', redirectErr);
          throw redirectErr;
        }
      }

      // Catch-all
      const errorMsg = err?.message || 'Google Sign-In failed. Please try again.';
      alert(`Google Sign-In Error: ${errorMsg}`);
      throw err;
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

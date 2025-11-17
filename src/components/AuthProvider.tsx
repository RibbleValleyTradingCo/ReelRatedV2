import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Separate contexts for each piece of auth state
// This allows components to subscribe only to what they need

interface AuthUserContextType {
  user: User | null;
}

interface AuthLoadingContextType {
  loading: boolean;
}

interface AuthSessionContextType {
  session: Session | null;
}

// Legacy combined context type for backwards compatibility
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthReady: boolean;
  signOut: () => Promise<{ error: AuthError | null }>;
}

const AuthUserContext = createContext<AuthUserContextType>({ user: null });
const AuthLoadingContext = createContext<AuthLoadingContextType>({ loading: true });
const AuthSessionContext = createContext<AuthSessionContextType>({ session: null });

// Legacy combined context for backwards compatibility
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAuthReady: false,
  signOut: async () => ({ error: null }),
});

// Optimized hooks - components should use these to subscribe only to what they need
export const useAuthUser = () => useContext(AuthUserContext);
export const useAuthLoading = () => useContext(AuthLoadingContext);
export const useAuthSession = () => useContext(AuthSessionContext);

// Legacy hook for backwards compatibility - avoid using this in new code
// as it causes re-renders when any auth state changes
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initialiseAuth = async () => {
      try {
        const [{ data: userData, error: userError }, { data: sessionData, error: sessionError }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);

        if (!mounted) return;

        if (userError) {
          console.error("Failed to fetch auth user", userError);
        }
        if (sessionError) {
          console.error("Failed to fetch auth session", sessionError);
        }

        setUser(userData?.user ?? null);
        setSession(sessionData?.session ?? null);
      } catch (error) {
        if (mounted) {
          console.error("Failed to initialise auth", error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setIsAuthReady(true);
        }
      }
    };

    void initialiseAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (!mounted) return;
      setSession(authSession);
      setUser(authSession?.user ?? null);
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async (): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Failed to sign out", error);
      return { error };
    }
    setUser(null);
    setSession(null);
    return { error: null };
  }, []);

  // Memoize context values to prevent unnecessary re-renders
  const userValue = useMemo(() => ({ user }), [user]);
  const loadingValue = useMemo(() => ({ loading }), [loading]);
  const sessionValue = useMemo(() => ({ session }), [session]);
  const combinedValue = useMemo(
    () => ({ user, session, loading, isAuthReady, signOut }),
    [user, session, loading, isAuthReady, signOut],
  );

  return (
    <AuthUserContext.Provider value={userValue}>
      <AuthLoadingContext.Provider value={loadingValue}>
        <AuthSessionContext.Provider value={sessionValue}>
          <AuthContext.Provider value={combinedValue}>
            {children}
          </AuthContext.Provider>
        </AuthSessionContext.Provider>
      </AuthLoadingContext.Provider>
    </AuthUserContext.Provider>
  );
};

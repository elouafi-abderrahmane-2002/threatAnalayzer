import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
}

class AuthService {
  private static instance: AuthService;
  private listeners: ((state: AuthState) => void)[] = [];
  private currentState: AuthState = {
    user: null,
    session: null,
    loading: true
  };

  private constructor() {
    this.initializeAuth();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async initializeAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      this.updateState({
        user: session?.user ? this.mapUser(session.user) : null,
        session,
        loading: false
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        this.updateState({
          user: session?.user ? this.mapUser(session.user) : null,
          session,
          loading: false
        });
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      this.updateState({
        user: null,
        session: null,
        loading: false
      });
    }
  }

  private mapUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0]
    };
  }

  async getUserProfile(): Promise<any> {
    if (!this.currentState.user) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, clients(name)')
        .eq('user_id', this.currentState.user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  async isTenantAdmin(): Promise<boolean> {
    const profile = await this.getUserProfile();
    return profile?.tenant_level === 'tenant_admin';
  }

  async isSuperAdmin(): Promise<boolean> {
    if (!this.currentState.user) return false;
    
    try {
      const { data } = await supabase.rpc('is_super_admin', {
        user_uuid: this.currentState.user.id
      });
      return data || false;
    } catch (error) {
      console.error('Error checking super admin status:', error);
      return false;
    }
  }

  private updateState(newState: Partial<AuthState>) {
    this.currentState = { ...this.currentState, ...newState };
    this.listeners.forEach(listener => listener(this.currentState));
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    // Immediately call with current state
    listener(this.currentState);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState(): AuthState {
    return this.currentState;
  }

  async signIn(email: string, password: string): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  }

  async signUp(email: string, password: string, name?: string): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0]
          }
        }
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async resetPassword(email: string): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  }
}

export const authService = AuthService.getInstance();
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { useAuth } from '@/hooks/useAuth';

type AuthMode = 'login' | 'signup' | 'forgot-password';

const Login = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const { isAuthenticated, loading } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-soc-surface to-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 animate-pulse text-primary" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const renderForm = () => {
    switch (mode) {
      case 'signup':
        return <SignUpForm onToggleMode={() => setMode('login')} />;
      case 'forgot-password':
        return <ForgotPasswordForm onBack={() => setMode('login')} />;
      default:
        return (
          <LoginForm
            onToggleMode={() => setMode('signup')}
            onForgotPassword={() => setMode('forgot-password')}
          />
        );
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup':
        return 'Create Account';
      case 'forgot-password':
        return 'Reset Password';
      default:
        return 'Welcome Back';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signup':
        return 'Join our security operations platform';
      case 'forgot-password':
        return 'Recover your account access';
      default:
        return 'Sign in to your SOC dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-soc-surface to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <img 
              src="/LOGO_ND_WHITE.png" 
              alt="NextDefense Logo" 
              className="h-16 w-auto mx-auto"
            />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            SOC Command Center
          </h1>
          <p className="text-muted-foreground mt-2">
            Security Operations Dashboard
          </p>
        </div>

        {/* Auth Card */}
        <Card className="shadow-elevated border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="text-center space-y-2">
            <h2 className="text-2xl font-bold">{getTitle()}</h2>
            <p className="text-muted-foreground">{getSubtitle()}</p>
          </CardHeader>
          <CardContent>
            {renderForm()}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>© 2025 NextDefense. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
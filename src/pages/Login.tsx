import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Loader2, ArrowRight, Shield } from "lucide-react";
import { safeLogger } from '@/lib/safe-logger';
import { ErrorMessage, FieldError } from "@/components/ui/error-message";
import { errorHandler, handleApiError } from "@/lib/error-handler";
import { useNavigate, Link } from "react-router-dom";
import { logger } from "@/lib/logger";
import { safeQuery } from '@/lib/database-safety';
import type { CreatedUserResult } from '@/types/database';
import { ENV_CONFIG } from '@/lib/env-config';
import { TEXT_CONTENT } from '@/config/text-content';
import { logUserActivity, ACTIVITY_TYPES } from '@/lib/activity-logger';
import { LiveChatWidget } from '@/components/LiveChatWidget';
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const {
    toast
  } = useToast();
  const {
    refreshUser
  } = useAuth();
  const navigate = useNavigate();

  // Redirect to reset-password page if this is a password recovery flow
  useEffect(() => {
    // Check hash params for recovery token (legacy format)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    
    if (type === 'recovery' && accessToken) {
      // Preserve the hash and redirect to reset-password
      navigate('/reset-password' + window.location.hash, { replace: true });
      return;
    }

    // Also listen for PASSWORD_RECOVERY auth event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show a message when the account was auto-suspended for screen capture
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('suspended') === 'capture') {
      setLoginError('Your account has been suspended: screen recording or downloader activity was detected. Please contact support to restore access.');
    }
  }, []);


  // Check for suspension error on mount (persisted from previous login attempt)
  useEffect(() => {
    const suspensionError = sessionStorage.getItem('suspension_error');
    if (suspensionError) {
      setLoginError(suspensionError);

      // Keep the flag for 60 seconds so other components can check it
      // This prevents payment error toasts during suspension flow
      const timeout = setTimeout(() => {
        sessionStorage.removeItem('suspension_error');
        setLoginError("");
      }, 60000);
      return () => clearTimeout(timeout);
    }
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startAll = performance.now();

    // Clear previous errors
    setLoginError("");
    setEmailError("");
    setPasswordError("");

    // Basic validation
    if (!email) {
      setEmailError("Email is required");
      return;
    }
    if (!password) {
      setPasswordError("Password is required");
      return;
    }
    setIsLoading(true);
    try {
      safeLogger.info('Login attempt for:', {
        email
      });

      // First authenticate with Supabase Auth
      const tAuthStart = performance.now();
      const {
        data: authData,
        error: authError
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      logger.performance('auth.signInWithPassword', performance.now() - tAuthStart, {
        email
      });
      if (authError) {
        console.error('Auth error:', authError);

        // Handle invalid login credentials
        if (authError.message.includes('Invalid login credentials')) {
          setLoginError("Invalid email or password. Please check your credentials and try again.");
          return;
        }

        // Use centralized error handling for auth errors
        const userError = handleApiError(authError, 'login');
        setLoginError(userError.message);
        return;
      }
      safeLogger.info('Auth successful, checking user data...');

      // Check if user exists in our users table
      const tUserFetchStart = performance.now();
      const {
        data: userData,
        error: userError
      } = await supabase.from('users').select('*').eq('id', authData.user.id).maybeSingle();
      logger.performance('db.users.fetch_by_id', performance.now() - tUserFetchStart, {
        id: authData.user.id
      });
      if (userError || !userData) {
        safeLogger.info('User not found in users table, creating...', {
          userError
        });

        // Default role for new users
        const userRole = 'student';
        const fullName = authData.user.user_metadata?.full_name || null;

        // Create user if they don't exist
        const tInsertStart = performance.now();
        const result = await safeQuery<CreatedUserResult>(supabase.from('users').insert({
          id: authData.user.id,
          email: authData.user.email || email,
          role: userRole,
          full_name: fullName,
          password_display: 'temp_password',
          password_hash: 'temp_hash',
          created_at: new Date().toISOString()
        }).select().single(), 'create user profile');
        logger.performance('db.users.insert_profile', performance.now() - tInsertStart, {
          id: authData.user.id,
          role: userRole
        });
        if (!result.success) {
          console.error('Error creating user:', result.error);
          const userError = handleApiError(result.error, 'user_creation');
          setLoginError(`Failed to set up your account. ${userError.message}`);
          return;
        }
        const newUser = result.data;
        toast({
          title: "Welcome!",
          description: `Hello ${newUser?.full_name || newUser?.email || email}, you've successfully logged in.`
        });
      } else {
        safeLogger.info('User found', {
          userId: userData.id,
          role: userData.role
        });

        // Block users banned from logging in
        if ((userData as any).login_blocked === true) {
          safeLogger.warn('User login is blocked', { userId: userData.id });
          const errorMessage = `Login Blocked|Your login access has been disabled by an administrator. Please contact support if you believe this is a mistake.`;
          sessionStorage.setItem('suspension_error', errorMessage);
          await supabase.auth.signOut();
          return;
        }

        // Only block suspended students from signing in
        if (userData.role === 'student' && userData.lms_status === 'suspended') {
          safeLogger.warn('Student LMS access is suspended', {
            userId: userData.id
          });

          // Fetch company settings to get contact email
          const {
            data: companySettings
          } = await supabase.from('company_settings').select('contact_email, company_name').eq('id', 1).maybeSingle();
          const contactEmail = companySettings?.contact_email || ENV_CONFIG.SUPPORT_EMAIL;
          const companyName = companySettings?.company_name || 'Support';

          // Store error in sessionStorage before signing out (to persist across component remount)
          const errorMessage = `Account Suspended|Your account has been temporarily suspended. Please contact ${companyName} at ${contactEmail} to resolve this issue and regain access.`;
          sessionStorage.setItem('suspension_error', errorMessage);

          // Sign out the user immediately
          await supabase.auth.signOut();
          return;
        }
        toast({
          title: "Welcome!",
          description: `Hello ${userData.full_name || userData.email}, you've successfully logged in.`
        });
      }

      // Clear any stored suspension errors on successful login
      sessionStorage.removeItem('suspension_error');

      // Log login activity
      logUserActivity({
        user_id: authData.user.id,
        activity_type: ACTIVITY_TYPES.LOGIN,
        metadata: { email: authData.user.email, timestamp: new Date().toISOString() }
      });

      // Refresh the user data in our auth hook and navigate to dashboard
      const tRefreshStart = performance.now();
      await refreshUser();
      logger.performance('auth.refresh_user', performance.now() - tRefreshStart);
      logger.performance('auth.login_total', performance.now() - startAll, {
        email,
        result: 'success'
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      const userError = errorHandler.handleError(error, 'login', false);
      setLoginError(userError.message);
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-md overflow-hidden border-border bg-card shadow-elevated animate-fade-in">
        <div className="h-1 bg-primary" />
        <CardHeader className="text-center pb-6 pt-8">
          <CardTitle className="text-3xl font-semibold text-foreground mb-2">
            {TEXT_CONTENT.WELCOME_MESSAGE}
          </CardTitle>
          <p className="text-sm text-muted-foreground">AI-powered learning for your success</p>
        </CardHeader>
        
        <CardContent className="px-6 pb-8 sm:px-8">
          {loginError && (() => {
          const [title, message] = loginError.includes('|') ? loginError.split('|') : ['Error', loginError];
          return <div className={`mb-6 p-4 rounded-lg border-2 ${loginError.includes('suspended') || loginError.includes('Suspended') ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{title}</h3>
                    <p className="text-sm leading-relaxed">{message}</p>
                  </div>
                </div>
              </div>;
        })()}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </Label>
              <div className="relative">
                <Input id="email" type="email" value={email} onChange={e => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
                // Clear suspension error when user starts typing
                if (loginError.includes('Suspended')) {
                  setLoginError("");
                  sessionStorage.removeItem('suspension_error');
                }
              }} className={`h-11 px-4 ${emailError ? 'border-destructive focus:border-destructive' : ''}`} placeholder="your@email.com" required />
              </div>
              <FieldError error={emailError} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError("");
              }} className={`h-11 pl-4 pr-12 ${passwordError ? 'border-destructive focus:border-destructive' : ''}`} placeholder="••••••••" required />
                <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                </Button>
              </div>
              <FieldError error={passwordError} />
            </div>
            
            <Button type="submit" className="w-full h-11 group" disabled={isLoading}>
              {isLoading ? <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </div> : <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>{TEXT_CONTENT.SIGN_IN_BUTTON}</span>
                   <ArrowRight className="w-4 h-4" />
                </div>}
            </Button>
            
            <div className="text-center mt-4 my-[6px]">
              <Link to="/reset-password" className="text-sm text-primary hover:underline transition-colors">
                Forgot Password?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <LiveChatWidget userRole="login" />
    </div>;
};
export default Login;
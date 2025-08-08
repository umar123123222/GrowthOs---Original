import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Loader2, ArrowRight, Shield, Sparkles } from "lucide-react";

import { ErrorMessage, FieldError } from "@/components/ui/error-message";
import { errorHandler, handleApiError } from "@/lib/error-handler";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      console.log('Login attempt for:', email);

      // First authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
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
      
      console.log('Auth successful, checking user data...');

      // Check if user exists in our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();
        
      if (userError || !userData) {
        console.log('User not found in users table, creating...', { userError });

        // Default role for new users
        const userRole = 'student';
        const fullName = authData.user.user_metadata?.full_name || null;

        // Create user if they don't exist
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email || email,
            role: userRole,
            full_name: fullName,
            password_display: 'temp_password',
            password_hash: 'temp_hash',
            created_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (createError) {
          console.error('Error creating user:', createError);
          const userError = handleApiError(createError, 'user_creation');
          setLoginError(`Failed to set up your account. ${userError.message}`);
          return;
        }
        
        toast({
          title: "Welcome!",
          description: `Hello ${newUser.full_name || newUser.email}, you've successfully logged in.`
        });
      } else {
        console.log('User found:', userData);
        
        // Only block suspended students from signing in
        if (userData.role === 'student' && userData.lms_status === 'suspended') {
          console.log('Student LMS access is suspended');
          
          // Fetch company settings to get contact email
          const { data: companySettings } = await supabase
            .from('company_settings')
            .select('contact_email')
            .eq('id', 1)
            .maybeSingle();
          
          const contactEmail = companySettings?.contact_email || 'support@growthos.com';
          
          // Sign out the user immediately
          await supabase.auth.signOut();
          setLoginError(`Your LMS access is currently suspended. Please contact support at ${contactEmail} for assistance.`);
          return;
        }
        
        toast({
          title: "Welcome!",
          description: `Hello ${userData.full_name || userData.email}, you've successfully logged in.`
        });
      }

      // Refresh the user data in our auth hook and navigate to dashboard
      await refreshUser();
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      const userError = errorHandler.handleError(error, 'login', false);
      setLoginError(userError.message);
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-emerald-600 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJtIDEwIDAgbCAwIDEwIG0gMCAwIGwgMTAgMCBtIDAgMTAgbCAxMCAwIG0gMTAgMCBsIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
      
      <Card className="w-full max-w-lg relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur-xl overflow-hidden animate-fade-in">
        {/* Decorative header gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>
        
        <CardHeader className="text-center pb-8 pt-8">
          
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent mb-2">
            Welcome to Growth OS
          </CardTitle>
          
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-sm">AI-powered learning for your success</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
        </CardHeader>
        
        <CardContent className="px-8 pb-8">
          {loginError && (
            <ErrorMessage 
              error={loginError} 
              className="mb-6"
              onDismiss={() => setLoginError("")}
            />
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <div className="relative">
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  className={`h-12 pl-4 pr-4 border-2 transition-all duration-200 rounded-lg ${
                    emailError 
                      ? 'border-destructive focus:border-destructive' 
                      : 'border-gray-200 focus:border-blue-500'
                  }`}
                  placeholder="your@email.com" 
                  required 
                />
              </div>
              <FieldError error={emailError} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  className={`h-12 pl-4 pr-12 border-2 transition-all duration-200 rounded-lg ${
                    passwordError 
                      ? 'border-destructive focus:border-destructive' 
                      : 'border-gray-200 focus:border-blue-500'
                  }`}
                  placeholder="••••••••" 
                  required 
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                </Button>
              </div>
              <FieldError error={passwordError} />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg group" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 group-hover:gap-3 transition-all duration-200">
                  <Shield className="w-4 h-4" />
                  <span>Sign In to Growth OS</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              )}
            </Button>
          </form>
          
          <div className="mt-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="">
                  <a href="https://enrollment.growthOS.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 transition-colors duration-200 font-medium underline">
                    Enroll Now
                  </a>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>;
};
export default Login;
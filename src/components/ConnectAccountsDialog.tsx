import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Edit, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ConnectAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onConnectionUpdate?: () => void;
}

export const ConnectAccountsDialog = ({ open, onOpenChange, userId, onConnectionUpdate }: ConnectAccountsDialogProps) => {
  const { toast } = useToast();
  const [metaConnected, setMetaConnected] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editingShopify, setEditingShopify] = useState(false);
  const [metaKey, setMetaKey] = useState("");
  const [shopifyKey, setShopifyKey] = useState("");
  const [shopifyDomain, setShopifyDomain] = useState("");

  // Load existing credentials when dialog opens and reset editing states
  useEffect(() => {
    const loadExistingCredentials = async () => {
      if (userId && open) {
        // Reset editing states and clear input fields when dialog opens
        setEditingMeta(false);
        setEditingShopify(false);
        setMetaKey("");
        setShopifyKey("");
        
        try {
          const { data, error } = await supabase
            .from('users')
            .select('meta_ads_credentials, shopify_credentials')
            .eq('id', userId)
            .single();

          if (error) throw error;

          if (data?.meta_ads_credentials) {
            setMetaConnected(true);
          } else {
            setMetaConnected(false);
          }
          if (data?.shopify_credentials) {
            setShopifyConnected(true);
          } else {
            setShopifyConnected(false);
          }
        } catch (error) {
          console.error('Error loading existing credentials:', error);
        }
      }
    };

    loadExistingCredentials();
  }, [userId, open]);

  const handleMetaConnect = async () => {
    if (!metaKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid Meta API access token.",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "User not authenticated. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ meta_ads_credentials: metaKey })
        .eq('id', userId);

      if (error) throw error;

      setMetaConnected(true);
      setEditingMeta(false);
      setMetaKey(""); // Clear the input for security
      
      // Trigger navigation update
      if (onConnectionUpdate) {
        onConnectionUpdate();
      }
      
      toast({
        title: "Meta API Connected",
        description: "Your Meta Ads account has been successfully connected.",
      });
    } catch (error) {
      console.error('Error saving Meta credentials:', error);
      toast({
        title: "Error",
        description: "Failed to save Meta credentials. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShopifyConnect = async () => {
    if (!shopifyKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid Shopify API key.",
        variant: "destructive",
      });
      return;
    }

    if (!shopifyDomain.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Shopify store domain (e.g., your-store.myshopify.com).",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "User not authenticated. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate Shopify connection using Edge Function
      const { data: validationResult, error: validationError } = await supabase.functions.invoke('validate-shopify', {
        body: {
          shopifyDomain: shopifyDomain,
          apiKey: shopifyKey
        }
      });

      if (validationError || !validationResult?.valid) {
        throw new Error(validationError?.message || validationResult?.error || 'Failed to validate Shopify connection');
      }

      // Update user record with validated credentials
      const { error } = await supabase
        .from('users')
        .update({ 
          shopify_credentials: shopifyKey
        })
        .eq('id', userId);

      if (error) throw error;

      setShopifyConnected(true);
      setEditingShopify(false);
      setShopifyKey(""); // Clear the input for security
      setShopifyDomain("");
      
      // Trigger navigation update
      if (onConnectionUpdate) {
        onConnectionUpdate();
      }
      
      toast({
        title: "Shopify Connected ✅",
        description: `Your Shopify store "${validationResult.shopName}" has been successfully connected.`,
      });
    } catch (error) {
      console.error('Error connecting to Shopify:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Shopify. Please check your API key and store domain.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Connect Your Accounts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Meta API Connection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                Meta Ads API
                {metaConnected && !editingMeta && (
                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Connected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(!metaConnected || editingMeta) && (
                <>
                  <div>
                    <Label htmlFor="meta-key" className="text-xs">
                      Meta API Access Token
                    </Label>
                    <Input
                      id="meta-key"
                      type="password"
                      placeholder="Enter your Meta API access token"
                      value={metaKey}
                      onChange={(e) => setMetaKey(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleMetaConnect} 
                    size="sm" 
                    className="w-full"
                    disabled={!metaKey.trim()}
                  >
                    {editingMeta ? "Update Connection" : "Connect Meta API"}
                  </Button>
                </>
              )}
              {metaConnected && !editingMeta && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEditingMeta(true)}
                  className="w-full"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Connection
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Shopify Connection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                Shopify Store
                {shopifyConnected && !editingShopify && (
                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Connected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(!shopifyConnected || editingShopify) && (
                <>
                  <div>
                    <Label htmlFor="shopify-domain" className="text-xs">
                      Shopify Store Domain
                    </Label>
                    <Input
                      id="shopify-domain"
                      placeholder="your-store.myshopify.com"
                      value={shopifyDomain}
                      onChange={(e) => {
                        let value = e.target.value.trim();
                        // Auto-format if user just enters store name
                        if (value && !value.includes('.') && !value.includes('://')) {
                          value = `${value}.myshopify.com`;
                        }
                        setShopifyDomain(value);
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter your full Shopify domain (e.g., your-store.myshopify.com)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="shopify-key" className="text-xs">
                      Shopify API Access Token
                    </Label>
                    <Input
                      id="shopify-key"
                      type="password"
                      placeholder="Enter your Shopify API access token"
                      value={shopifyKey}
                      onChange={(e) => setShopifyKey(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleShopifyConnect} 
                    size="sm" 
                    className="w-full"
                    disabled={!shopifyKey.trim() || !shopifyDomain.trim()}
                  >
                    {editingShopify ? "Update Connection" : "Connect Shopify"}
                  </Button>
                </>
              )}
              {shopifyConnected && !editingShopify && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEditingShopify(true)}
                  className="w-full"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Connection
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
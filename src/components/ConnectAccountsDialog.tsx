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
  const [myshopifyDomain, setMyshopifyDomain] = useState("");

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
    if (!shopifyKey.trim() || !shopifyDomain.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all Shopify credentials",
        variant: "destructive",
      });
      return;
    }

    try {
      /* 1 ▸ normalise the domain */
      let dom = shopifyDomain.trim();
      if (!dom.includes('.')) dom += '.myshopify.com';

      /* 2 ▸ basic checks */
      const tok = shopifyKey.trim();
      if (!tok.startsWith('shpat_')) {
        toast({
          title: "Invalid Token",
          description: "Paste the *Admin access‑token* (starts with shpat_…).",
          variant: "destructive",
        });
        return;
      }
      if (!/^[a-z0-9-]+\.myshopify\.com$/.test(dom)) {
        toast({
          title: "Invalid Domain",
          description: "Domain must be like yourstore.myshopify.com",
          variant: "destructive",
        });
        return;
      }

      /* 3 ▸ live test against /shop.json */
      const res = await fetch(`https://${dom}/admin/api/2024-07/shop.json`, {
        headers: { 'X-Shopify-Access-Token': tok }
      });

      if (!res.ok) {
        toast({
          title: "Connection Failed",
          description: res.status === 401 ? 'Token invalid or expired (401).' :
            res.status === 403 ? 'Token lacks required scopes (403).' :
            res.status === 404 ? 'Store domain not found (404).' :
            `Shopify error ${res.status}.`,
          variant: "destructive",
        });
        return;
      }

      /* 4 ▸ persist & flip the flag */
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          shopify_credentials: tok + '|' + dom 
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error saving Shopify credentials:', updateError);
        toast({
          title: "Error",
          description: "Failed to save credentials",
          variant: "destructive",
        });
        return;
      }

      setShopifyConnected(true);
      setEditingShopify(false);
      setShopifyKey("");
      setShopifyDomain("");
      setMyshopifyDomain("");
      
      // Call the connection update callback if provided
      if (onConnectionUpdate) {
        onConnectionUpdate();
      }
      
      toast({
        title: "Shopify connected 🎉",
        description: "Your Shopify store has been successfully connected.",
      });
    } catch (error) {
      console.error('Error connecting Shopify:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect Shopify account",
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
                      placeholder="elyscents.pk or your-store.myshopify.com"
                      value={shopifyDomain}
                      onChange={(e) => setShopifyDomain(e.target.value.trim())}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      For custom domains like elyscents.pk, please also provide your myshopify.com domain below
                    </p>
                  </div>
                  {shopifyDomain && !shopifyDomain.includes('myshopify.com') && (
                    <div>
                      <Label htmlFor="myshopify-domain" className="text-xs">
                        Your myshopify.com Domain (Required for API)
                      </Label>
                      <Input
                        id="myshopify-domain"
                        placeholder="your-store.myshopify.com"
                        value={myshopifyDomain}
                        onChange={(e) => {
                          const value = e.target.value.trim();
                          setMyshopifyDomain(value);
                          if (value.includes('myshopify.com')) {
                            setShopifyDomain(value);
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Even with custom domains, Shopify's API requires your myshopify.com domain
                      </p>
                    </div>
                  )}
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
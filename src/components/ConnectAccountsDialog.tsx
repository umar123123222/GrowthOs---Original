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
import { Check, Edit, Settings, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AskShopDomainDialog } from "./AskShopDomainDialog";
import { StudentIntegrations, encryptToken } from "@/lib/student-integrations";
import { supabase } from "@/integrations/supabase/client";
import { syncShopifyMetrics } from "@/lib/metrics-sync";

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
  const [metaAccountId, setMetaAccountId] = useState("");
  const [shopTokenInput, setShopTokenInput] = useState("");
  const [askDomainOpen, setAskDomainOpen] = useState(false);
  const [currentToken, setCurrentToken] = useState("");
  const [integration, setIntegration] = useState<any>(null);

  // Load existing integration settings
  useEffect(() => {
    const loadIntegrations = async () => {
      if (userId && open) {
        // Reset editing states and clear input fields when dialog opens
        setEditingMeta(false);
        setEditingShopify(false);
        setMetaKey("");
        setShopTokenInput("");
        
        try {
          const integrationData = await StudentIntegrations.get(userId);
          setIntegration(integrationData);
          
          if (integrationData) {
            setShopifyConnected(integrationData.is_shopify_connected);
            setMetaConnected(integrationData.is_meta_connected);
          } else {
            setShopifyConnected(false);
            setMetaConnected(false);
          }
        } catch (error) {
          console.error('Error loading integrations:', error);
        }
      }
    };

    loadIntegrations();
  }, [userId, open]);

  const handleShopifyToken = async () => {
    const token = shopTokenInput.trim();
    
    if (!token.startsWith('shpat_')) {
      toast({
        title: "Invalid Token",
        description: "Please enter a valid Shopify API access token (starts with shpat_).",
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

    // Check if user already has a shop domain
    if (integration?.shop_domain) {
      await completeShopifyConnection(token, integration.shop_domain);
    } else {
      // Need to ask for domain
      setCurrentToken(token);
      setAskDomainOpen(true);
    }
  };

  const handleShopDomainSave = async (domain: string) => {
    await completeShopifyConnection(currentToken, domain);
    setCurrentToken("");
  };

  const completeShopifyConnection = async (token: string, domain: string) => {
    try {
      // Test the token by calling Shopify API
      const response = await fetch(`https://${domain}/admin/api/2024-07/access_scopes.json`, {
        headers: {
          'X-Shopify-Access-Token': token
        }
      });

      if (response.status === 401) {
        toast({
          title: "Invalid Token",
          description: "The Shopify API token is invalid or expired.",
          variant: "destructive",
        });
        return;
      }

      if (response.status === 403) {
        toast({
          title: "Missing Scopes",
          description: "The token doesn't have required permissions.",
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        toast({
          title: "Connection Failed",
          description: `Failed to connect to Shopify (${response.status}).`,
          variant: "destructive",
        });
        return;
      }

      // Encrypt token and save
      const encryptedToken = await encryptToken(token);
      
      await StudentIntegrations.upsert({
        userId,
        shopify_api_token: encryptedToken,
        shop_domain: domain,
        is_shopify_connected: true
      });

      // Mirror into normalized integrations table for analytics/sync
      try {
        const { data: existing } = await supabase
          .from('integrations')
          .select('id')
          .eq('user_id', userId)
          .eq('source', 'shopify')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('integrations')
            .update({
              access_token: encryptedToken,
              external_id: domain,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('integrations')
            .insert({
              user_id: userId,
              source: 'shopify',
              access_token: encryptedToken,
              external_id: domain,
            });
        }
      } catch (e) {
        console.error('Failed to persist to integrations table:', e);
      }

      setShopifyConnected(true);
      setEditingShopify(false);
      setShopTokenInput("");

      // Kick off a background sync for last 7 days (non-blocking)
      try {
        syncShopifyMetrics().catch((err) => console.warn('syncShopifyMetrics failed', err));
      } catch (_) {}
      
      
      // Update navigation
      if (onConnectionUpdate) {
        onConnectionUpdate();
      }
      
      // Call global checkIntegrations
      if (window.checkIntegrations) {
        window.checkIntegrations();
      }
      
      toast({
        title: "Shopify connected 🎉",
        description: "Your Shopify store has been successfully connected.",
      });
      
    } catch (error) {
      console.error('Error connecting Shopify:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect Shopify account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShopifyDisconnect = async () => {
    try {
      await StudentIntegrations.disconnect(userId!, 'shopify');

      // Also remove from normalized integrations table
      try {
        await supabase
          .from('integrations')
          .delete()
          .eq('user_id', userId!)
          .eq('source', 'shopify');
      } catch (e) {
        console.error('Failed to clean integrations row for Shopify:', e);
      }

      setShopifyConnected(false);
      
      if (onConnectionUpdate) {
        onConnectionUpdate();
      }
      
      if (window.checkIntegrations) {
        window.checkIntegrations();
      }
      
      toast({
        title: "Shopify Disconnected",
        description: "Your Shopify store has been disconnected.",
      });
    } catch (error) {
      console.error('Error disconnecting Shopify:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Shopify. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMetaConnect = async () => {
    if (!metaKey.trim() || !metaAccountId.trim()) {
      toast({
        title: "Missing Info",
        description: "Please enter both the Meta API token and Ad Account ID.",
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
      const encryptedToken = await encryptToken(metaKey);

      await StudentIntegrations.upsert({
        userId,
        meta_api_token: encryptedToken,
        is_meta_connected: true
      });

      // Mirror into normalized integrations table
      try {
        const accountId = metaAccountId.trim().startsWith('act_')
          ? metaAccountId.trim().slice(4)
          : metaAccountId.trim();

        const { data: existing } = await supabase
          .from('integrations')
          .select('id')
          .eq('user_id', userId)
          .eq('source', 'meta_ads')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('integrations')
            .update({
              access_token: encryptedToken,
              external_id: accountId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('integrations')
            .insert({
              user_id: userId,
              source: 'meta_ads',
              access_token: encryptedToken,
              external_id: accountId,
            });
        }
      } catch (e) {
        console.error('Failed to persist Meta integration:', e);
      }

      setMetaConnected(true);
      setEditingMeta(false);
      setMetaKey("");

      if (onConnectionUpdate) {
        onConnectionUpdate();
      }

      if (window.checkIntegrations) {
        window.checkIntegrations();
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
                  <div>
                    <Label htmlFor="meta-account" className="text-xs">
                      Meta Ad Account ID
                    </Label>
                    <Input
                      id="meta-account"
                      type="text"
                      placeholder="act_1234567890 or 1234567890"
                      value={metaAccountId}
                      onChange={(e) => setMetaAccountId(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleMetaConnect} 
                    size="sm" 
                    className="w-full"
                    disabled={!metaKey.trim() || !metaAccountId.trim()}
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
                    <Label htmlFor="shopify-token" className="text-xs">
                      Shopify API Access Token
                    </Label>
                    <Input
                      id="shopify-token"
                      type="password"
                      placeholder="shpat_"
                      value={shopTokenInput}
                      onChange={(e) => setShopTokenInput(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleShopifyToken} 
                    size="sm" 
                    className="w-full"
                    disabled={!shopTokenInput.trim()}
                  >
                    {editingShopify ? "Update Connection" : "Connect Shopify"}
                  </Button>
                </>
              )}
              {shopifyConnected && !editingShopify && (
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setEditingShopify(true)}
                    className="w-full"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Connection
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleShopifyDisconnect}
                    className="w-full text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ask Shop Domain Dialog */}
        <AskShopDomainDialog
          open={askDomainOpen}
          onOpenChange={setAskDomainOpen}
          onDomainSave={handleShopDomainSave}
        />
      </DialogContent>
    </Dialog>
  );
};
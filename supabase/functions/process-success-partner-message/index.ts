import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessContext {
  shopify?: any;
  metaAds?: any;
  currency?: string;
  dateRangeDays?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      message, 
      conversationHistory, 
      businessContext,
      studentName,
      dateRangeDays 
    } = await req.json();

    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing message for user:', user.id);

    // Check if there's already a response being processed (prevent duplicates)
    const { data: recentMessages } = await supabaseClient
      .from('success_partner_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'user')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (recentMessages && recentMessages.length > 0) {
      const lastUserMessage = recentMessages[0];
      const timeDiff = Date.now() - new Date(lastUserMessage.timestamp).getTime();
      
      // If the last user message was within 2 seconds and matches content, it might be a duplicate
      if (timeDiff < 2000 && lastUserMessage.content === message.trim()) {
        console.log('Duplicate message detected, skipping processing');
        return new Response(
          JSON.stringify({ status: 'duplicate', message: 'Message already being processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Start background processing with enhanced error handling
    const processInBackground = async () => {
      const MAX_RETRIES = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Processing attempt ${attempt + 1}/${MAX_RETRIES + 1}...`);
          
          const webhookUrl = Deno.env.get('SUCCESS_PARTNER_WEBHOOK_URL');
          if (!webhookUrl) {
            throw new Error('SUCCESS_PARTNER_WEBHOOK_URL not configured');
          }

          // Validate input data
          if (!message || typeof message !== 'string') {
            throw new Error('Invalid message format');
          }

          const payload = {
            message: message.trim(),
            studentId: user.id,
            studentName: studentName || user.email?.split('@')[0] || 'Student',
            timestamp: new Date().toISOString(),
            conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
            businessContext: typeof businessContext === 'object' ? businessContext : {}
          };

          console.log('Calling webhook with payload size:', JSON.stringify(payload).length);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Webhook error ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          console.log('Webhook response received, type:', typeof data);

          // Enhanced AI response parsing with validation
          let aiResponse = "";
          
          if (!data) {
            throw new Error('Empty webhook response');
          }

          if (typeof data === 'object') {
            // Try different response formats
            if (data.reply) {
              if (Array.isArray(data.reply) && data.reply.length > 0) {
                const firstReply = data.reply[0];
                aiResponse = firstReply?.output || firstReply?.message || firstReply?.content || String(firstReply);
              } else if (typeof data.reply === 'object') {
                aiResponse = data.reply.output || data.reply.message || data.reply.content || String(data.reply);
              } else if (typeof data.reply === 'string') {
                aiResponse = data.reply;
              }
            } else if (data.output) {
              aiResponse = String(data.output);
            } else if (data.message) {
              aiResponse = data.message;
            } else if (data.text || data.content) {
              aiResponse = data.text || data.content;
            } else {
              // Fallback: stringify the whole response
              aiResponse = JSON.stringify(data);
            }
          } else if (typeof data === 'string') {
            aiResponse = data;
          }

          // Final validation
          aiResponse = String(aiResponse).trim();
          if (!aiResponse || aiResponse === 'undefined' || aiResponse === 'null') {
            throw new Error('Invalid AI response format');
          }

          console.log('Parsed AI response length:', aiResponse.length);

          // Save AI response to database
          const { error: insertError } = await supabaseClient
            .from('success_partner_messages')
            .insert({
              user_id: user.id,
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date().toISOString(),
              date: new Date().toISOString().split('T')[0]
            });

          if (insertError) {
            console.error('Failed to save AI response:', insertError);
            throw insertError;
          }

          console.log('AI response saved successfully');

          // Update credits
          try {
            const today = new Date().toISOString().split('T')[0];
            const { data: creditData, error: creditFetchError } = await supabaseClient
              .from('success_partner_credits')
              .select('*')
              .eq('user_id', user.id)
              .eq('date', today)
              .single();

            if (creditFetchError && creditFetchError.code !== 'PGRST116') {
              console.error('Error fetching credits:', creditFetchError);
            } else if (creditData) {
              const { error: updateError } = await supabaseClient
                .from('success_partner_credits')
                .update({ credits_used: creditData.credits_used + 1 })
                .eq('id', creditData.id);

              if (updateError) {
                console.error('Error updating credits:', updateError);
              } else {
                console.log('Credits updated successfully');
              }
            }
          } catch (creditError) {
            console.error('Credit update failed:', creditError);
            // Don't fail the whole operation if credit update fails
          }

          // Success - break retry loop
          console.log('Message processing completed successfully');
          return;

        } catch (error) {
          lastError = error as Error;
          console.error(`Attempt ${attempt + 1} failed:`, error);
          
          // If this was the last attempt, save error message
          if (attempt === MAX_RETRIES) {
            console.error('All retry attempts failed');
            break;
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      // All attempts failed - save error message to database
      console.error('Background processing failed after all retries:', lastError);
      try {
        await supabaseClient
          .from('success_partner_messages')
          .insert({
            user_id: user.id,
            role: 'assistant',
            content: "⚠️ I'm having trouble connecting to my services right now. Please try asking again in a moment.",
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0]
          });
      } catch (fallbackError) {
        console.error('Failed to save fallback message:', fallbackError);
      }
    };

    // Start processing in background
    EdgeRuntime.waitUntil(processInBackground());

    // Return immediately to client
    return new Response(
      JSON.stringify({ 
        status: 'processing', 
        message: 'Your message is being processed. The response will appear shortly.' 
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Request handling error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

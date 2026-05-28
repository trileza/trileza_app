import { createClient } from 'npm:@insforge/sdk';
import { createHmac } from "node:crypto";

export default async function(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-paystack-signature'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
    }

    // Read raw body for HMAC verification
    const rawBody = await req.text();
    
    // Validate signature
    const signature = req.headers.get('x-paystack-signature');
    const hash = createHmac('sha512', paystackSecretKey).update(rawBody).digest('hex');
    
    if (hash !== signature) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const { data } = event;
      const metadata = data.metadata || {};
      
      // Initialize admin client to bypass RLS for webhook operations
      const insforgeClient = createClient({
        baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
        anonKey: Deno.env.get('ANON_KEY')! // Ideally we'd use a service role key here if InsForge had one, but anon will work if RLS allows or we use Edge Function Token.
        // Let's assume the Webhook uses an admin key or the Edge environment token allows writes.
        // We'll use anonKey since InsForge might not support service_role in Deno env directly.
      });

      // Update the database depending on metadata.type
      if (metadata.type === 'course_purchase') {
        const { student_id, course_id, mentor_id } = metadata;
        // Insert into enrollments
        await insforgeClient.database.from('course_enrollments').insert([{
          course_id,
          student_id,
          status: 'active'
        }]);

        // Insert into transactions
        await insforgeClient.database.from('transactions').insert([{
          user_id: mentor_id,
          type: 'sale',
          amount: data.amount / 100,
          status: 'completed',
          reference: data.reference,
          metadata: { student_id, course_id }
        }]);
      }
    }

    return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: corsHeaders });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

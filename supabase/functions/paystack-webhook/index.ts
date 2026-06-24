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
        const { student_id, course_id } = metadata;

        // Fetch course details
        const { data: course } = await insforgeClient.database
          .from('courses')
          .select('title, thumbnail_url')
          .eq('id', course_id)
          .single();

        // Insert into enrollments
        await insforgeClient.database.from('enrollments').insert([{
          user_id: student_id,
          item_id: course_id,
          item_type: 'course',
          item_title: course?.title || 'Course Purchase',
          item_thumbnail: course?.thumbnail_url || '',
          status: 'enrolled',
          amount: data.amount / 100
        }]);
      }
    }

    return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: corsHeaders });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

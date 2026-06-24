import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, x-user-token'
};

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  try {
    const { action, title, meetingId, participant } = await req.json();
    
    // Retrieve Dyte Credentials from environment variables
    const dyteOrgId = Deno.env.get('DYTE_ORG_ID') || Deno.env.get('DYTE_ORGANIZATION_ID');
    const dyteApiKey = Deno.env.get('DYTE_API_KEY');
    
    if (!dyteOrgId || !dyteApiKey) {
      throw new Error('Dyte API credentials (DYTE_ORG_ID/DYTE_API_KEY) are not configured in the backend environment.');
    }
    
    const authHeader = `Basic ${btoa(`${dyteOrgId}:${dyteApiKey}`)}`;
    
    // ─── ACTION: CREATE MEETING ───
    if (action === 'create_meeting') {
      console.log(`[Dyte Service] Creating meeting: ${title}`);
      const response = await fetch('https://api.dyte.io/v2/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          title: title || 'Live Class',
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(`Dyte API error: ${result.message || response.statusText}`);
      }
      
      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // ─── ACTION: ADD PARTICIPANT ───
    if (action === 'add_participant') {
      if (!meetingId || !participant) {
        throw new Error('meetingId and participant details are required.');
      }
      
      console.log(`[Dyte Service] Adding participant ${participant.name} to meeting ${meetingId}`);
      
      // Determine the preset name based on user role
      // Dyte presets default to: 'group_call_host' for hosts/tutors/mentors, 'group_call_participant' for others
      const presetName = (participant.role === 'tutor' || participant.role === 'mentor' || participant.role === 'management') 
        ? 'group_call_host' 
        : 'group_call_participant';
        
      const response = await fetch(`https://api.dyte.io/v2/meetings/${meetingId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          name: participant.name || 'Anonymous User',
          picture: participant.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.name}`,
          preset_name: presetName,
          client_specific_id: participant.id
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(`Dyte API error: ${result.message || response.statusText}`);
      }
      
      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    throw new Error(`Invalid action: ${action}`);
  } catch (err: any) {
    console.error(`[Dyte Service Error] ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

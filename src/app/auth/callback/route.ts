import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Auto-link owner by email if not already linked
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("owner_id")
            .eq("id", user.id)
            .maybeSingle();
          
          if (profile && !profile.owner_id) {
            const serviceClient = createServiceClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            const { data: matchingOwner } = await serviceClient
              .from("owners")
              .select("id")
              .eq("email", user.email.toLowerCase())
              .limit(1)
              .maybeSingle();
            
            if (matchingOwner) {
              await serviceClient
                .from("profiles")
                .update({ owner_id: matchingOwner.id })
                .eq("id", user.id);
            }
          }
        }
      } catch {} // Best effort — don't block login

      // If this is a recovery (password reset), redirect to reset page
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
      }
      // Otherwise redirect to the next page or home
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', requestUrl.origin));
}

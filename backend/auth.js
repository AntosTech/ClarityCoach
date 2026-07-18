import { createClient } from "@supabase/supabase-js";

// Creates a Supabase client scoped to the caller's own access token, so
// RLS policies (auth.uid() = user_id) apply exactly as they would from
// the browser. We never use a service-role key here on purpose.
//
// process.env is read here (inside the function) rather than at module
// load time, since this module can be imported before dotenv.config()
// runs (import statements are hoisted). Reading lazily means it always
// sees whatever is in process.env by the time a request actually comes
// in, regardless of import order.
export function getSupabaseForRequest(accessToken) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

// Resolves the authenticated user (if any) from a request's Authorization
// header. Shared by any route that needs to know who's calling.
export async function getAuthedUser(req) {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    return { userId: null, supabaseForUser: null };
  }

  const supabaseForUser = getSupabaseForRequest(accessToken);
  const {
    data: { user },
    error: userError
  } = await supabaseForUser.auth.getUser(accessToken);

  if (userError || !user) {
    return { userId: null, supabaseForUser: null };
  }

  return { userId: user.id, supabaseForUser };
}

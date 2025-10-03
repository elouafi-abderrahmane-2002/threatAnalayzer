// Deno Deploy Edge Function to create users (tenant admins and tenant users)
// Uses service_role key available to Edge Functions runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type CreateUserRequest = {
  email: string;
  password?: string;
  display_name?: string;
  client_id?: string | null;
  tenant_level?: 'tenant_admin' | 'user';
  role_names?: string[]; // e.g., ['Tenant Admin'] or ['SOC Analyst']
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function getCaller(ctxSupabase: ReturnType<typeof createClient>) {
  const { data } = await ctxSupabase.auth.getUser();
  return data.user;
}

async function isSuperAdmin(db: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data, error } = await db.rpc('is_super_admin', { user_uuid: userId });
  if (error) return false;
  return Boolean(data);
}

async function canAccessClient(db: ReturnType<typeof createClient>, userId: string, clientId: string | null | undefined): Promise<boolean> {
  if (!clientId) return false;
  const { data, error } = await db.rpc('can_access_client', { user_uuid: userId, client_uuid: clientId });
  if (error) return false;
  return Boolean(data);
}

export async function handler(req: Request) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    return jsonResponse({ error: 'Server not configured' }, { status: 500 });
  }

  // Supabase client with service role for privileged operations
  const supabaseAdmin = createClient(url, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });

  // Authed client for caller identity
  const supabaseCaller = createClient(url, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });

  let payload: CreateUserRequest;
  try {
    payload = await req.json();
  } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, password, display_name, client_id, tenant_level = 'user', role_names = [] } = payload;
  if (!email) return jsonResponse({ error: 'email is required' }, { status: 400 });

  // Authorization: caller must be super admin or be able to access the target client
  const caller = await getCaller(supabaseCaller);
  if (!caller) return jsonResponse({ error: 'Unauthorized' }, { status: 401 });

  const callerIsSuper = await isSuperAdmin(supabaseCaller, caller.id);
  if (!callerIsSuper) {
    const allowed = await canAccessClient(supabaseCaller, caller.id, client_id);
    if (!allowed) {
      return jsonResponse({ error: 'User not allowed' }, { status: 403 });
    }
  }

  // Create auth user
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: password || crypto.randomUUID().replace(/-/g, '').slice(0, 16) + '!',
    email_confirm: true,
    user_metadata: {
      name: display_name || email.split('@')[0],
      tenant_level,
    },
  });
  if (createErr || !created?.user) {
    return jsonResponse({ error: createErr?.message || 'Failed to create user' }, { status: 400 });
  }

  const newUserId = created.user.id;

  // Ensure profile updated
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .update({
      display_name: display_name || email.split('@')[0],
      client_id: client_id ?? null,
      tenant_level,
      email,
    })
    .eq('user_id', newUserId);
  if (profileErr) {
    return jsonResponse({ error: profileErr.message }, { status: 400 });
  }

  // Assign roles by name
  if (role_names.length > 0) {
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from('roles')
      .select('id,name')
      .in('name', role_names);
    if (rolesErr) return jsonResponse({ error: rolesErr.message }, { status: 400 });

    const assignments = (roles || []).map((r) => ({ user_id: newUserId, role_id: r.id }));
    if (assignments.length > 0) {
      const { error: assignErr } = await supabaseAdmin.from('user_roles').insert(assignments);
      if (assignErr) return jsonResponse({ error: assignErr.message }, { status: 400 });
    }
  }

  return jsonResponse({
    user_id: newUserId,
    email,
  });
}

// Serve handler
Deno.serve(handler);



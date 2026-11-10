// Supabase Edge Function (Deno): إرسال تقرير آخر اليوم بالإيميل عبر Resend
// تُستدعى إما عبر pg_cron (باستخدام الهيدر x-cron-secret) أو يدوياً من المستخدم (باستخدام JWT)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildReport, renderReportEmailHtml } from '../_shared/run.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret'
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
    const reportFrom = Deno.env.get('REPORT_FROM') ?? 'Mukhattati <onboarding@resend.dev>';

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required secrets (RESEND_API_KEY or SUPABASE_SERVICE_ROLE_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const reqCronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization');

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date().toISOString().slice(0, 10);

    let targetUsers: Array<{ id: string; email: string; name?: string }> = [];

    if (cronSecret && reqCronSecret === cronSecret) {
      // استدعاء مجدول من pg_cron: نفحص المستخدمين المفعّلين لإيميل التقرير
      const { data: settingsRows } = await admin
        .from('records')
        .select('user_id, data')
        .eq('kind', 'setting')
        .eq('id', 'main')
        .eq('deleted', false);

      for (const row of settingsRows || []) {
        if (row.data?.emailReport) {
          const { data: uData } = await admin.auth.admin.getUserById(row.user_id);
          if (uData?.user?.email) {
            targetUsers.push({
              id: row.user_id,
              email: uData.user.email,
              name: row.data.name || ''
            });
          }
        }
      }
    } else if (authHeader?.startsWith('Bearer ')) {
      // استدعاء تجريبي مباشر من المستخدم المسجل
      const jwt = authHeader.replace('Bearer ', '');
      const { data: uData, error: uErr } = await admin.auth.getUser(jwt);
      if (uErr || !uData?.user?.email) {
        return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      targetUsers.push({
        id: uData.user.id,
        email: uData.user.email
      });
    } else {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const u of targetUsers) {
      const { data: rows } = await admin
        .from('records')
        .select('kind, id, data, deleted')
        .eq('user_id', u.id)
        .in('kind', ['task', 'prayer', 'setting'])
        .eq('deleted', false);

      const tasks = [];
      const prayers: Record<string, unknown> = {};
      let userName = u.name || '';

      for (const r of rows || []) {
        if (r.kind === 'task') tasks.push({ id: r.id, ...r.data });
        else if (r.kind === 'prayer') prayers[r.id] = r.data;
        else if (r.kind === 'setting' && r.id === 'main' && r.data?.name) {
          userName = r.data.name;
        }
      }

      const report = buildReport({ date: targetDate, tasks, prayers });
      const htmlContent = renderReportEmailHtml(report, userName);

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: reportFrom,
          to: [u.email],
          subject: `تقرير يومك من مُخطّطي (${targetDate}) — ${report.pct}%`,
          html: htmlContent
        })
      });

      const resendData = await resendRes.json().catch(() => ({}));
      results.push({ email: u.email, status: resendRes.status, resendData });
    }

    return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

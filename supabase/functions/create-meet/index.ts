// @ts-nocheck
// supabase/functions/create-google-meet/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ⚠️ Estos vienen de Supabase Secrets (los configuramos abajo)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN") ?? "";
const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") ?? "";

// Cliente admin para actualizar la BD
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !GOOGLE_CALENDAR_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Faltan variables de entorno en Supabase Secrets" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { appointmentId, datetime } = await req.json();

    if (!appointmentId || !datetime) {
      return new Response(
        JSON.stringify({ error: "Faltan appointmentId o datetime en el body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const startDate = new Date(datetime);
    if (Number.isNaN(startDate.getTime())) {
      return new Response(
        JSON.stringify({ error: "datetime no tiene un formato válido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Duración de 30 minutos
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    // 1️⃣ Obtener access_token con el refresh token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Error al obtener token de Google:", text);
      return new Response(
        JSON.stringify({ error: "No se pudo obtener access_token de Google" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: "Respuesta de Google sin access_token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2️⃣ Crear evento en Google Calendar con Meet
    const eventRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${GOOGLE_CALENDAR_ID}/events?conferenceDataVersion=1`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: `Cita #${appointmentId}`,
          start: {
            dateTime: startDate.toISOString(),
            timeZone: "America/Bogota",
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: "America/Bogota",
          },
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );

    const eventBodyText = await eventRes.text();

    if (!eventRes.ok) {
      console.error("Error al crear evento de Google Calendar:", eventBodyText);
      return new Response(
        JSON.stringify({ error: "Error creando evento en Google Calendar" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const eventData = JSON.parse(eventBodyText);

    const meetLink =
      eventData.hangoutLink ||
      eventData.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri;

    if (!meetLink) {
      console.error("No se encontró hangoutLink en el evento:", eventData);
      return new Response(
        JSON.stringify({ error: "No se pudo obtener el link de Google Meet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3️⃣ Actualizar la cita en Supabase con el enlace
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        teleconference_url: meetLink,
        // si quieres también actualizar la hora (por si cambió algo):
        scheduled_for: startDate.toISOString(),
      })
      .eq("id", appointmentId);

    if (updateError) {
      console.error("Error actualizando appointments:", updateError);
      return new Response(
        JSON.stringify({ error: "Se creó el evento, pero falló la actualización de la cita" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4️⃣ Respuesta al frontend
    return new Response(
      JSON.stringify({
        eventId: eventData.id,
        meetLink,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
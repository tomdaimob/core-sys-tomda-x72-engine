import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", userId)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ ok: false, error: "Apenas administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const padrao = body.padrao || "R8-N";

    let cub_valor_m2: number | null = null;
    let cub_ref_mes_ano: string | null = null;
    let cub_fonte_url = "";
    let cub_padrao = padrao;

    // === Source 1: Sinduscon-PA ===
    try {
      const url1 = "https://www.sindusconpa.org.br/cub";
      const resp1 = await fetch(url1, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (resp1.ok) {
        const html = await resp1.text();
        // Try to find CUB value patterns like R$ 2.345,67 or similar
        // Look for patterns near "CUB" or "R$" 
        const valuePatterns = [
          /CUB[^R]*R\$\s*([\d.,]+)/i,
          /R\$\s*([\d.]+,\d{2})\s*\/?\s*m/i,
          /valor[^R]*R\$\s*([\d.]+,\d{2})/i,
          /([\d.]+,\d{2})\s*R\$?\s*\/?\s*m²/i,
        ];

        for (const pat of valuePatterns) {
          const m = html.match(pat);
          if (m) {
            const raw = m[1].replace(/\./g, "").replace(",", ".");
            const val = parseFloat(raw);
            if (val > 100 && val < 99999) {
              cub_valor_m2 = val;
              break;
            }
          }
        }

        // Try to find month/year
        const mesAnoPatterns = [
          /(?:referência|ref\.?|mês)[:\s]*(\d{1,2})\s*[\/\-]\s*(\d{4})/i,
          /(\w+)\s*(?:de\s*)?(\d{4})/i,
        ];

        const meses: Record<string, string> = {
          janeiro: "01", fevereiro: "02", março: "03", marco: "03",
          abril: "04", maio: "05", junho: "06", julho: "07",
          agosto: "08", setembro: "09", outubro: "10",
          novembro: "11", dezembro: "12",
        };

        for (const pat of mesAnoPatterns) {
          const m = html.match(pat);
          if (m) {
            if (/^\d+$/.test(m[1])) {
              cub_ref_mes_ano = `${m[1].padStart(2, "0")}/${m[2]}`;
              break;
            } else {
              const mesNum = meses[m[1].toLowerCase()];
              if (mesNum) {
                cub_ref_mes_ano = `${mesNum}/${m[2]}`;
                break;
              }
            }
          }
        }

        if (cub_valor_m2) {
          cub_fonte_url = url1;
        }
      }
    } catch (e) {
      console.log("Sinduscon-PA fetch failed:", e);
    }

    // === Source 2: cub.org.br (fallback) ===
    if (!cub_valor_m2) {
      try {
        const url2 = "https://www.cub.org.br/cub-m2-estadual/PA/";
        const resp2 = await fetch(url2, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (resp2.ok) {
          const html2 = await resp2.text();
          const valMatch = html2.match(/R\$\s*([\d.]+,\d{2})/);
          if (valMatch) {
            const raw = valMatch[1].replace(/\./g, "").replace(",", ".");
            const val = parseFloat(raw);
            if (val > 100 && val < 99999) {
              cub_valor_m2 = val;
              cub_fonte_url = url2;
            }
          }
          const mesMatch = html2.match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/);
          if (mesMatch) {
            cub_ref_mes_ano = `${mesMatch[1].padStart(2, "0")}/${mesMatch[2]}`;
          }
        }
      } catch (e) {
        console.log("cub.org.br fetch failed:", e);
      }
    }

    // Validation
    if (!cub_valor_m2 || cub_valor_m2 <= 0 || cub_valor_m2 >= 99999) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Não foi possível extrair o CUB-PA automaticamente. Verifique manualmente o site do Sinduscon-PA.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cub_ref_mes_ano) {
      // fallback to current month
      const now = new Date();
      cub_ref_mes_ano = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    }

    // Use service role for upsert
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert
    const { data: existing } = await supabaseAdmin
      .from("indicadores_custo")
      .select("id")
      .eq("uf", "PA")
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("indicadores_custo")
        .update({
          cub_ref_mes_ano,
          cub_valor_m2,
          cub_padrao,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("indicadores_custo").insert({
        uf: "PA",
        cub_ref_mes_ano,
        cub_valor_m2,
        cub_padrao,
        updated_by: userId,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        cub_ref_mes_ano,
        cub_valor_m2,
        cub_padrao,
        cub_fonte_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("update-cub-pa error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

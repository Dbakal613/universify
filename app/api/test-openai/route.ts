import {
  calculateOpenAICost,
  OPENAI_PRICING,
} from "@/lib/openai-cost";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Creamos un cliente de Supabase solo para el servidor.
// La SERVICE_ROLE_KEY nunca debe ir en código del navegador.
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL en las variables de entorno"
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET() {
  try {
    // -----------------------------------------
    // 1. Modelo que estamos usando
    // -----------------------------------------
    const model = "gpt-5-mini" as const;

    // -----------------------------------------
    // 2. Llamada de prueba a OpenAI
    // -----------------------------------------
    const response = await openai.responses.create({
      model,
      input: "Responde únicamente con la palabra: conectado",
    });

    // -----------------------------------------
    // 3. Obtener consumo de tokens
    // -----------------------------------------
    const usage = response.usage;

    const inputTokens =
      usage?.input_tokens ?? 0;

    const cachedInputTokens =
      usage?.input_tokens_details?.cached_tokens ?? 0;

    const outputTokens =
      usage?.output_tokens ?? 0;

    const reasoningTokens =
      usage?.output_tokens_details?.reasoning_tokens ?? 0;

    const totalTokens =
      usage?.total_tokens ?? 0;

    // -----------------------------------------
    // 4. Calcular costo
    // -----------------------------------------
    const cost = calculateOpenAICost({
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
    });

    // -----------------------------------------
    // 5. Mostrar información en consola
    // -----------------------------------------
    console.log("===== OPENAI USAGE =====");

    console.log({
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      totalCostUsd: cost.totalCost,
    });

    // -----------------------------------------
    // 6. Guardar gasto automáticamente
    //    en Supabase
    // -----------------------------------------
    const supabase = getSupabaseAdmin();

    const { error: usageError } = await supabase
      .from("ai_usage")
      .insert({
        // Por ahora es una prueba, así que no tenemos
        // un usuario ni curso real asociados.
        user_id: null,
        course_id: null,

        // Identificamos claramente que fue una prueba.
        document_id: `test-${response.id}`,
        document_name: "TEST - conexión OpenAI",

        model,
        openai_response_id: response.id,

        input_tokens: inputTokens,
        cached_input_tokens: cachedInputTokens,
        output_tokens: outputTokens,
        reasoning_tokens: reasoningTokens,
        total_tokens: totalTokens,

        input_price_per_million:
          OPENAI_PRICING[model].input,

        cached_input_price_per_million:
          OPENAI_PRICING[model].cachedInput,

        output_price_per_million:
          OPENAI_PRICING[model].output,

        cost_usd: cost.totalCost,
      });

    if (usageError) {
      throw new Error(
        `Error guardando uso de OpenAI en Supabase: ${usageError.message}`
      );
    }

    // -----------------------------------------
    // 7. Devolver resultado
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Conexión con OpenAI exitosa",
      response: response.output_text,

      usage: {
        model,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
        totalTokens,
        costUsd: cost.totalCost,
      },

      savedToSupabase: true,
    });
  } catch (error) {
    console.error("ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
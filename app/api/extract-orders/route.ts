import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeUnit } from "@/lib/utils";

function fallbackExtractOrders(emailText: string, defaultStore: string, referenceDate: string) {
  const orders: Array<{
    orderId: string;
    store: string;
    itemDescription: string;
    quantity: number;
    unit: string;
    priority: string;
    productionDate: string;
    notes: string;
  }> = [];

  const lines = emailText.split('\n');
  let currentOrderId = '';
  let currentStore = defaultStore || 'Loja A';

  const isHighPriorityAll = /urgente|alta prioridade|hoje|imediato/i.test(emailText);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: "5376 GRANSUZANO - 1 BL3052 VENEZ.6F 100X150 C/GR BL"
    // 1: OP/Pedido digits (e.g., 5376)
    // 2: Store name (e.g., GRANSUZANO)
    // 3: Quantity (e.g., 1)
    // 4: Item description (e.g., BL3052 VENEZ.6F 100X150 C/GR BL)
    const structuredMatch = trimmed.match(/^(?:#|OP\s*#?|PEDIDO\s*#?)?\s*(\d{2,8})\s+([A-Za-z0-9À-ÿ\.\s]+?)\s*[-:]\s*(\d+)\s+(.+)$/i);
    if (structuredMatch) {
      const opNum = structuredMatch[1].trim();
      const storeName = structuredMatch[2].trim();
      const qty = parseInt(structuredMatch[3], 10);
      const desc = structuredMatch[4].trim();

      orders.push({
        orderId: `#${opNum}`,
        store: storeName,
        itemDescription: desc,
        quantity: qty > 0 ? qty : 1,
        unit: 'un',
        priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
        productionDate: referenceDate || 'Hoje',
        notes: 'Extraído no formato padrão (OP Loja - Qtd Descrição)',
      });
      continue;
    }

    // Detect Order ID in line like #9980 or Pedido #9980
    const orderMatch = trimmed.match(/(?:#|pedido\s*#?|ref\s*#?)\s*([a-z0-9\-]+)/i);
    if (orderMatch) {
      currentOrderId = `#${orderMatch[1].toUpperCase()}`;
    }

    // Detect store in line
    const storeMatch = trimmed.match(/(?:loja|boutique|matriz|filial|cliente)\s+[a-z0-9\s]+/i);
    if (storeMatch) {
      currentStore = storeMatch[0].trim();
    }

    // Pattern: e.g. "25x Blazers Alfaiataria", "40x Calças", "100 un Camisetas"
    const itemMatches = Array.from(
      trimmed.matchAll(/(\d+)\s*(?:x|un|unidades|peças|pcs|cx|caixas)?\s*([a-zA-ZÀ-ÿ0-9\s\-\/\(\)]{3,50})/gi)
    );

    if (itemMatches.length > 0) {
      for (const m of itemMatches) {
        const qty = parseInt(m[1], 10);
        let rawDesc = m[2].trim();
        rawDesc = rawDesc.replace(/^(de|da|do|dos|das)\s+/i, '');
        rawDesc = rawDesc.replace(/\s*(?:e|com|para)\s*$/i, '');

        if (qty > 0 && rawDesc.length >= 3 && !/^(pedido|loja|ref|data|atenciosamente|olá|assunto|favor|gostaríamos)/i.test(rawDesc)) {
          const isItemHighPriority = isHighPriorityAll || /urgente|alta/i.test(trimmed);
          orders.push({
            orderId: currentOrderId || `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
            store: currentStore,
            itemDescription: rawDesc,
            quantity: qty,
            unit: 'un',
            priority: isItemHighPriority ? 'ALTA PRIORIDADE' : 'NORMAL',
            productionDate: referenceDate || 'Hoje',
            notes: 'Extraído do e-mail de pedidos',
          });
        }
      }
    }
  }

  if (orders.length === 0) {
    const validLines = lines
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 5 &&
          !/^(olá|assunto|gostaríamos|atenciosamente|obrigado|favor|equipe)/i.test(l)
      );

    validLines.forEach((l, idx) => {
      orders.push({
        orderId: `#ORD-${Math.floor(1000 + idx)}`,
        store: defaultStore || 'Loja A',
        itemDescription: l.substring(0, 60),
        quantity: 10,
        unit: 'un',
        priority: isHighPriorityAll ? 'ALTA PRIORIDADE' : 'NORMAL',
        productionDate: referenceDate || 'Hoje',
        notes: 'Extraído do texto do e-mail',
      });
    });
  }

  return {
    orders,
    summary: `Foram identificados ${orders.length} item(ns) de produção no e-mail informado.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { emailText, storeName, referenceDate } = await req.json();

    if (!emailText || typeof emailText !== "string") {
      return NextResponse.json(
        { error: "Por favor, insira o conteúdo do e-mail ou mensagem para processar." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const prompt = `Analise a seguinte mensagem/e-mail de entrada de pedido industrial da fábrica.
Loja padrão (caso não seja especificada no texto): ${storeName || "Matriz"}
Data de referência: ${referenceDate || "Hoje"}

Estrutura de entrada frequente da fábrica:
Formato por linha: <NÚMERO DA OP/PEDIDO> <NOME DA LOJA> - <QUANTIDADE> <DESCRIÇÃO DA PEÇA>
Exemplo 1: "5376 GRANSUZANO - 1 BL3052 VENEZ.6F 100X150 C/GR BL"
  => orderId: "5376" (ou "#5376")
  => store: "GRANSUZANO"
  => quantity: 1
  => itemDescription: "BL3052 VENEZ.6F 100X150 C/GR BL"
Exemplo 2: "5377 MATRIZ - 3 JANELA 4F 120X120 INCOLOR"
  => orderId: "5377"
  => store: "MATRIZ"
  => quantity: 3
  => itemDescription: "JANELA 4F 120X120 INCOLOR"

Conteúdo a extrair:
"""
${emailText}
"""

Extraia todos os itens de pedido contidos no texto. Para cada item encontrado, identifique:
- ID do Pedido (extrair do número da OP, ou gerar um no formato #ORD-XXXX se não houver)
- Nome da Loja (extrair o nome da loja presente na linha, ou usar a loja padrão se omitida)
- Descrição/Item da produção
- Quantidade numérica
- Unidade (ex: "un", "peças", "lotes")
- Prioridade ("ALTA PRIORIDADE" ou "NORMAL")
- Data sugerida de produção (formato "YYYY-MM-DD" ou texto "Hoje", "Amanhã")
- Observações relevantes extraídas do texto`;

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            systemInstruction:
              "Você é a IA assistente do FactoryOps - Production Command. Seu objetivo é extrair pedidos industriais com altíssima precisão de textos de e-mail, WhatsApp ou planilhas CSV em português. Retorne estritamente o JSON configurado no esquema.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                orders: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      orderId: { type: Type.STRING },
                      store: { type: Type.STRING },
                      itemDescription: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      priority: { type: Type.STRING },
                      productionDate: { type: Type.STRING },
                      notes: { type: Type.STRING }
                    },
                    required: ["orderId", "store", "itemDescription", "quantity"]
                  }
                },
                summary: { type: Type.STRING }
              },
              required: ["orders", "summary"]
            }
          }
        });

        const jsonText = response.text || "{}";
        const parsedData = JSON.parse(jsonText);

        if (parsedData.orders && parsedData.orders.length > 0) {
          const cleanedOrders = parsedData.orders.map((o: any) => ({
            ...o,
            unit: sanitizeUnit(o.unit),
          }));
          return NextResponse.json({
            success: true,
            orders: cleanedOrders,
            summary: parsedData.summary || "Processamento de pedidos concluído com sucesso."
          });
        }
      } catch (geminiError) {
        console.warn("Gemini API fallthrough to fallback parser:", geminiError);
      }
    }

    const fallbackResult = fallbackExtractOrders(emailText, storeName, referenceDate);
    const cleanedFallbackOrders = fallbackResult.orders.map((o: any) => ({
      ...o,
      unit: sanitizeUnit(o.unit),
    }));
    return NextResponse.json({
      success: true,
      orders: cleanedFallbackOrders,
      summary: fallbackResult.summary,
    });
  } catch (error: any) {
    console.error("Erro no servidor ao processar pedidos:", error);
    return NextResponse.json(
      {
        error: "Ocorreu um erro ao processar o e-mail.",
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}


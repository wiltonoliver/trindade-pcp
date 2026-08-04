import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeUnit } from "@/lib/utils";

function fallbackExtractOrders(
  rawEmailText: string,
  defaultStore: string,
  referenceDate: string,
  defaultDeliveryDate?: string
) {
  const orders: Array<{
    orderId: string;
    store: string;
    itemDescription: string;
    quantity: number;
    unit: string;
    priority: string;
    productionDate: string;
    deliveryDate?: string;
    notes: string;
  }> = [];

  // Normalize text: convert all dash variations to standard ASCII hyphen, replace non-breaking spaces
  const normalizedText = rawEmailText
    .replace(/[\u2010-\u2015\u2212\u2013\u2014\u2010\u2011]/g, '-')
    .replace(/\u00A0/g, ' ');

  const lines = normalizedText.split(/\r?\n/);
  const isHighPriorityAll = /urgente|alta prioridade|hoje|imediato/i.test(normalizedText);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern 1: OP STORE - QTY DESC
    // Example: "34581 RAGUEB - 1 PTA PIVOLT. C/FRISO..."
    // Example: "34576 RAGUEB - 1 PORTA LAMBRIL..."
    // Example: "5376 GRANSUZANO - 1 BL3052 VENEZ.6F 100X150 C/GR BL"
    const p1 = trimmed.match(/^(?:#|OP\s*#?|PEDIDO\s*#?)?\s*(\d{2,8})\s+([A-Za-z0-9À-ÿ\.\s_]+?)\s*[-:\–\—\|]\s*(\d+)\s*x?\s+(.+)$/i);
    if (p1) {
      const opNum = p1[1].trim();
      const storeName = p1[2].trim();
      const qty = parseInt(p1[3], 10);
      const desc = p1[4].trim();

      orders.push({
        orderId: `#${opNum}`,
        store: storeName || defaultStore || 'Matriz',
        itemDescription: desc,
        quantity: qty > 0 ? qty : 1,
        unit: 'un',
        priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
        productionDate: referenceDate || 'Hoje',
        deliveryDate: defaultDeliveryDate || '',
        notes: 'Extraído no formato padrão (OP Loja - Qtd Descrição)',
      });
      continue;
    }

    // Pattern 2: OP - QTY DESC (store omitted)
    // Example: "34581 - 1 PORTA LAMBRIL..."
    const p2 = trimmed.match(/^(?:#|OP\s*#?|PEDIDO\s*#?)?\s*(\d{2,8})\s*[-:\–\—\|]\s*(\d+)\s*x?\s+(.+)$/i);
    if (p2) {
      const opNum = p2[1].trim();
      const qty = parseInt(p2[2], 10);
      const desc = p2[3].trim();

      orders.push({
        orderId: `#${opNum}`,
        store: defaultStore || 'Matriz',
        itemDescription: desc,
        quantity: qty > 0 ? qty : 1,
        unit: 'un',
        priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
        productionDate: referenceDate || 'Hoje',
        deliveryDate: defaultDeliveryDate || '',
        notes: 'Extraído no formato (OP - Qtd Descrição)',
      });
      continue;
    }

    // Pattern 3: Line starting with OP number + text (e.g., "34576 RAGUEB 1 PORTA...")
    const p3 = trimmed.match(/^(?:#|OP\s*#?|PEDIDO\s*#?)?\s*(\d{2,8})\s+(.+)$/i);
    if (p3) {
      const opNum = p3[1].trim();
      let rest = p3[2].trim();

      // Check if store name is at start of rest
      let storeName = defaultStore || 'Matriz';
      const storePrefixMatch = rest.match(/^([A-Za-z0-9À-ÿ\._]+)\s*[-:\–\—\|]?\s*(.+)$/);
      if (storePrefixMatch && storePrefixMatch[1].length >= 3 && !/^\d+$/.test(storePrefixMatch[1])) {
        // Check if first word looks like a store name
        const potentialStore = storePrefixMatch[1];
        if (!/^(porta|janela|bl3052|pt|pva|pvc|esquadria|box|vidro|aluminio|portao)/i.test(potentialStore)) {
          storeName = potentialStore;
          rest = storePrefixMatch[2];
        }
      }

      // Extract quantity if available (e.g. "1 PORTA LAMBRIL...")
      let qty = 1;
      const qtyMatch = rest.match(/^(\d+)\s*x?\s+(.+)$/i);
      let desc = rest;
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10);
        desc = qtyMatch[2].trim();
      }

      orders.push({
        orderId: `#${opNum}`,
        store: storeName,
        itemDescription: desc,
        quantity: qty > 0 ? qty : 1,
        unit: 'un',
        priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
        productionDate: referenceDate || 'Hoje',
        deliveryDate: defaultDeliveryDate || '',
        notes: 'Extraído por identificador de OP por linha',
      });
      continue;
    }

    // Pattern 4: Qty x Description (e.g., "2x Porta de Alumínio")
    const p4 = trimmed.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (p4 && p4[2].length >= 3 && !/^(pedido|loja|ref|data|atenciosamente|olá|assunto|favor|gostaríamos)/i.test(p4[2])) {
      orders.push({
        orderId: `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        store: defaultStore || 'Matriz',
        itemDescription: p4[2].trim(),
        quantity: parseInt(p4[1], 10),
        unit: 'un',
        priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
        productionDate: referenceDate || 'Hoje',
        deliveryDate: defaultDeliveryDate || '',
        notes: 'Extraído por quantidade x item',
      });
      continue;
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
        store: defaultStore || 'Matriz',
        itemDescription: l.substring(0, 100),
        quantity: 1,
        unit: 'un',
        priority: isHighPriorityAll ? 'ALTA PRIORIDADE' : 'NORMAL',
        productionDate: referenceDate || 'Hoje',
        deliveryDate: defaultDeliveryDate || '',
        notes: 'Extraído do texto por linha',
      });
    });
  }

  return {
    orders,
    summary: `Foram identificados ${orders.length} item(ns) de produção no texto informado.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { emailText, storeName, referenceDate, deliveryDate } = await req.json();

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
Data prevista de entrega padrão: ${deliveryDate || ""}

Estrutura de entrada frequente da fábrica:
Formato por linha: <NÚMERO DA OP/PEDIDO> <NOME DA LOJA> - <QUANTIDADE> <DESCRIÇÃO DA PEÇA>
Exemplo 1: "34581 RAGUEB - 1 PTA PIVOLT. C/FRISO PUX. REDONDO 210X100 BCA ESQ. (VIDR. INTERIÇO E FECH. ELETRO.)"
  => orderId: "#34581"
  => store: "RAGUEB"
  => quantity: 1
  => itemDescription: "PTA PIVOLT. C/FRISO PUX. REDONDO 210X100 BCA ESQ. (VIDR. INTERIÇO E FECH. ELETRO.)"
Exemplo 2: "34576 RAGUEB - 1 PORTA LAMBRIL PUXADOR 210X80 ESQ"
  => orderId: "#34576"
  => store: "RAGUEB"
  => quantity: 1
  => itemDescription: "PORTA LAMBRIL PUXADOR 210X80 ESQ"

REGRA CRÍTICA DE EXTRAÇÃO:
- Extraia CADA LINHA do texto como um item de pedido individual no array "orders".
- Se houver N linhas de pedidos no texto, você DEVE retornar EXATAMENTE N itens no array "orders".
- NUNCA agrupe ou omita linhas.
- Se o campo "deliveryDate" não for citado no texto, atribua o valor "${deliveryDate || ""}".`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            systemInstruction:
              "Você é a IA assistente do FactoryOps - Production Command. Seu objetivo é extrair pedidos industriais com altíssima precisão de textos de e-mail, WhatsApp ou planilhas CSV em português. Retorne estritamente o JSON configurado no esquema com TODOS os pedidos encontrados.",
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
                      deliveryDate: { type: Type.STRING },
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
            orderId: o.orderId ? (o.orderId.startsWith('#') ? o.orderId : `#${o.orderId}`) : `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
            unit: sanitizeUnit(o.unit),
            deliveryDate: o.deliveryDate || deliveryDate || '',
          }));
          return NextResponse.json({
            success: true,
            orders: cleanedOrders,
            summary: parsedData.summary || `Foram identificados ${cleanedOrders.length} pedidos com sucesso.`
          });
        }
      } catch (geminiError) {
        console.warn("Gemini API fallthrough to fallback parser:", geminiError);
      }
    }

    const fallbackResult = fallbackExtractOrders(emailText, storeName, referenceDate, deliveryDate);
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

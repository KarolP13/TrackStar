import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are Bolt, an AI assistant built into TrackStar, a promo tracking app for Twitter/X music promotion. You help the user understand their promo data, analytics, and business performance.

You have access to the user's current promo data summary which is provided below. Use this data to answer questions accurately. Be concise, conversational, and helpful. Use specific numbers from the data when answering. If you don't have enough data to answer a question, say so honestly.

You can help with:
- Summarizing promo performance over time periods
- Identifying top promoters, artists, accounts, and labels
- Breaking down revenue and payment status
- Answering questions like "how much did I make last month" or "who owes me the most" or "what's my most promoted artist"
- Spotting trends or patterns in the data
- Giving business insights and suggestions based on the data

Keep responses short and to the point — 2-4 sentences for simple questions, a short paragraph for summaries. Use dollar amounts and specific names from the data. Don't make up data that isn't provided. If asked something outside of promo data, politely redirect: "I'm best with your promo data — try asking me about your revenue, promoters, or artists!"`;

export async function POST(req: NextRequest) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: "api_key_missing", message: "Bolt isn't set up yet. Add your Anthropic API key in Vercel environment variables and redeploy." },
            { status: 500 }
        );
    }

    try {
        const body = await req.json();
        const { messages, dataContext } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "invalid_request", message: "No messages provided." },
                { status: 400 }
            );
        }

        // Build system prompt with data context
        const systemPrompt = `${SYSTEM_PROMPT}

--- USER'S CURRENT PROMO DATA ---
${JSON.stringify(dataContext, null, 2)}
--- END DATA ---`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                system: systemPrompt,
                messages: messages.map((m: { role: string; content: string }) => ({
                    role: m.role,
                    content: m.content,
                })),
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Anthropic API error:", response.status, errorText);
            return NextResponse.json(
                { error: "api_error", message: "Couldn't process that — try again in a moment." },
                { status: response.status }
            );
        }

        const data = await response.json();

        if (!data.content || !data.content[0]?.text) {
            return NextResponse.json(
                { error: "empty_response", message: "Something went wrong. Try rephrasing your question." },
                { status: 500 }
            );
        }

        return NextResponse.json({ reply: data.content[0].text });
    } catch (error) {
        console.error("Bolt API route error:", error);
        return NextResponse.json(
            { error: "server_error", message: "Couldn't process that — try again in a moment." },
            { status: 500 }
        );
    }
}

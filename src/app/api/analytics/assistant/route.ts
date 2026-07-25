import { NextResponse } from "next/server";
import { askOpsAssistant, listConversations } from "@/lib/analytics/assistant";

export const dynamic = "force-dynamic";

export async function GET() {
  const conversations = await listConversations();
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string;
      conversationId?: string;
    };
    if (!body.question?.trim()) {
      return NextResponse.json({ error: "question 필요" }, { status: 400 });
    }
    const result = await askOpsAssistant({
      question: body.question.trim(),
      conversationId: body.conversationId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "비서 응답 실패" },
      { status: 400 },
    );
  }
}

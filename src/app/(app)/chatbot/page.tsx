import { requireUser } from "@/lib/auth";
import { chatbotEnabled } from "@/lib/chatbot/anthropic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatUI } from "./chat-ui";

export default async function ChatbotPage() {
  await requireUser();
  const enabled = chatbotEnabled();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">세무 챗봇</h1>
      <Card>
        <CardHeader>
          <CardTitle>한국세무사회 전문세무상담 기반 질의응답</CardTitle>
        </CardHeader>
        <CardContent>
          <ChatUI enabled={enabled} />
        </CardContent>
      </Card>
    </div>
  );
}

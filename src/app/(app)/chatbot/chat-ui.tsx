"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { id: string; category: string; title: string }[];
  error?: boolean;
}

export function ChatUI({ enabled }: { enabled: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: data.error ?? "오류가 발생했습니다.", error: true }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.answer, sources: data.sources }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "네트워크 오류가 발생했습니다.", error: true }]);
    } finally {
      setPending(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!enabled) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          챗봇이 아직 설정되지 않았습니다. 관리자에게 문의해주세요.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-md border bg-muted/20 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            세무 관련 질문을 입력해보세요. 한국세무사회 전문세무상담 사례를 참고해 답변합니다.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-left " +
                (m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : m.error
                    ? "bg-destructive/10 text-destructive"
                    : "bg-background border")
              }
            >
              {m.content}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                  참고 사례: {m.sources.map((s) => `[${s.category}] ${s.title}`).join(" · ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="text-sm text-muted-foreground">답변 작성 중…</p>}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="질문을 입력하세요 (Shift+Enter로 줄바꿈)"
          rows={2}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button onClick={send} disabled={pending || !input.trim()}>
          전송
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        답변은 참고용이며, 최종 판단은 반드시 담당 세무사가 법령/예규를 재확인해야 합니다.
      </p>
    </div>
  );
}

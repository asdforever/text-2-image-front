import type { ConversationMessage } from "../../api/planning-conversations";
export function PlanningConversationMessages({ messages, generating, sending }: { messages: ConversationMessage[]; generating: boolean; sending?: boolean }) {
  return <div className="planning-messages" role="log" aria-label="规划对话记录" aria-live="polite">
    {!messages.length && <p className="planning-chat-intro">可以询问规划理由、比较方案，也可以提出修改要求。提问只回复文字；明确要求修改时先展示预览，确认应用后更新当前规划。</p>}
    {messages.map(message => <article key={message.id} className={`planning-message is-${message.role}`}><strong>{message.role === "user" ? "你" : "规划大师"}</strong><p>{message.text}</p></article>)}
    {generating && <p role="status" className="planning-thinking">{sending ? "正在发送…" : "正在按当前资料和规则规划…可以关闭窗口，稍后继续查看。"}</p>}
  </div>;
}

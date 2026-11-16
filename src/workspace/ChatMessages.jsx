// Lời chào khi chưa có hội thoại, hoặc danh sách tin nhắn của phiên AI Chat/Work.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import MessageActions from '../components/MessageActions';

export default function ChatMessages({ isLoading, messages, messagesEndRef, userData }) {
  return (
    <>
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="w-12 h-12 rounded-xl bg-card border-line border flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xl mb-4">
            <Sparkles size={24} />
          </div>
          <h3 className="text-base font-bold text-fg mb-1">Chào {userData.userName}!</h3>
          <p className="text-sm text-fg-subtle max-w-md leading-relaxed">Hãy nhập nội dung câu hỏi hoặc gõ dấu `/` để dùng các phím điều hướng nhanh.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-2">
          {messages.map((msg, i) => {
            const isAsst = msg.role === 'assistant';
            // Câu trả lời đang được stream (hoặc chưa có nội dung) thì chưa hiện nút Sao chép / Lưu DOCX
            const isComplete = !!msg.content?.trim() && !(isLoading && i === messages.length - 1);
            const bodyId = `chat-message-body-${i}`;
            return (
              <div key={i} className={`w-full flex gap-3 ${isAsst ? 'justify-start' : 'justify-end'}`}>
                <div className={`min-w-0 rounded-2xl p-4 text-sm leading-relaxed border shadow-sm ${isAsst ? 'w-full bg-card border-line text-fg' : 'max-w-[85%] bg-blue-600 border-blue-500 text-white'}`}>
                  <div className={`font-bold text-[12px] uppercase mb-1 ${isAsst ? 'text-fg-muted' : 'text-blue-100'}`}>{isAsst ? 'iThunder AI' : 'Bạn'}</div>
                  {/* Bong bóng AI đổi màu chữ theo theme; bong bóng người dùng luôn nền xanh chữ sáng */}
                  <div id={bodyId} className={`prose max-w-none break-words ${isAsst ? 'dark:prose-invert' : 'prose-invert'}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {isComplete && (
                    <MessageActions content={msg.content} isAsst={isAsst}
                      prompt={isAsst && messages[i - 1]?.role === 'user' ? messages[i - 1].content : ''}
                      getHtml={() => document.getElementById(bodyId)?.innerHTML} />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </>
  );
}

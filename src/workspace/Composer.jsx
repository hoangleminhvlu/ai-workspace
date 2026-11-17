// Ô nhập câu hỏi của AI Chat/Work: lệnh nhanh (/), đính kèm tài liệu RAG, nút Gửi.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  Send, Paperclip
} from 'lucide-react';

export default function Composer({ canManageActive, fileInputRef, filteredCommands, handleFileUpload, handleInputChange, handleInputKeyDown, handleSendPrompt, inputPrompt, promptInputRef, selectCommand, selectedCmdIndex, showSlashMenu }) {
  return (
    <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-line bg-app flex flex-col items-center shrink-0">
      <div className="w-full min-w-0 relative">

        {showSlashMenu && (
          <div className="absolute bottom-full left-0 w-full bg-panel border border-line rounded-xl p-1.5 shadow-2xl mb-2 z-20 flex flex-col max-h-48 overflow-y-auto">
            <div className="text-[10px] font-bold text-fg-subtle px-2.5 py-1 uppercase tracking-wider border-b border-line mb-1">Phím lệnh nhanh iThunder AI</div>
            {filteredCommands.map((item, idx) => (
              <button
                key={item.cmd}
                onClick={() => selectCommand(item.cmd)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-sm transition-all ${idx === selectedCmdIndex ? 'bg-blue-600 text-white font-medium' : 'hover:bg-hover text-fg'}`}
              >
                <span className="font-mono">{item.cmd}</span>
                <span className={idx === selectedCmdIndex ? 'text-blue-100 text-[12px]' : 'text-fg-subtle text-[12px]'}>{item.desc}</span>
              </button>
            ))}
          </div>
        )}

        <div className="w-full bg-panel border border-line rounded-2xl p-2.5 flex flex-col gap-2 shadow-lg">
          <textarea
            ref={promptInputRef}
            value={inputPrompt}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Nhập tin nhắn của bạn ở đây... (Gõ / để dùng lệnh nhanh)"
            rows={1}
            className="w-full bg-transparent resize-none text-[15px] text-fg placeholder-fg-subtle focus:outline-none px-2 py-1 leading-relaxed custom-scrollbar overflow-y-auto"
          />
          <div className="flex items-center justify-between px-2 pt-1 border-t border-line">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                disabled={!canManageActive}
                className={`p-1.5 rounded-lg transition-all ${canManageActive ? 'text-fg-muted hover:text-fg-strong hover:bg-hover' : 'text-fg-subtle opacity-40 cursor-not-allowed'}`}
                title={canManageActive ? "Đính kèm tài liệu RAG" : "Bạn chỉ có quyền khai thác (không được nạp tài liệu) ở kho này"}
              >
                <Paperclip size={14} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.md,.docx" className="hidden" />
              <span className="hidden sm:inline text-[12px] text-fg-subtle font-medium">Enter để gửi · Shift+Enter để xuống hàng</span>
            </div>

            <button 
              onClick={handleSendPrompt}
              disabled={!inputPrompt.trim()} 
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${inputPrompt.trim() ? 'bg-blue-600 text-white shadow-md' : 'bg-elevated text-fg-subtle cursor-not-allowed'}`}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

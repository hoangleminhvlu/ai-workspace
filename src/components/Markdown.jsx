/**
 * Hiển thị Markdown dùng chung (AI Chat/Work, Trao đổi trực tuyến, Lịch sử Làm việc, trình xem tệp .md):
 * - remark-gfm: bảng, gạch ngang chữ, danh sách việc (- [ ]), liên kết tự động theo cú pháp GitHub Flavored Markdown
 * - bảng rộng cuộn ngang trong khung thay vì làm vỡ bố cục
 * - liên kết mở ở tab mới (không rời khỏi AI Workspace); không nhận HTML thô (mặc định của react-markdown)
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const REMARK_PLUGINS = [remarkGfm];
const BASE_COMPONENTS = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node, ...props }) => <div className="overflow-x-auto max-w-full"><table {...props} /></div>,
};

export default function Markdown({ children, components }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components ? { ...BASE_COMPONENTS, ...components } : BASE_COMPONENTS}>
      {children}
    </ReactMarkdown>
  );
}

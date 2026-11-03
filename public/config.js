/**
 * TARA AI Workspace - Cấu hình runtime độc lập cho máy trạm
 * Kết nối AI Gateway
 */
window.TARA_CONFIG = {
  // ---------------------------------------------------------------------
  // AI GATEWAY — Policy Enforcement Point
  // ---------------------------------------------------------------------
  API_GATEWAY_URL: "https://aigate.is-tech.vn",
  WS_GATEWAY_URL: "wss://aigate.is-tech.vn",
  // ---------------------------------------------------------------------
  // AI PLATFORM — API nghiệp vụ (chat/rag) phía sau AI Gateway
  // ---------------------------------------------------------------------
  DEFAULT_MODEL: "gemma4:latest",
  ORG_ID: "AI-TECH",
  LOCATION: "FITLAB-03",

  MODEL_LIST: {
    "gemma4:latest": "Mô hình Gemma4 của Google DeepMind (9.6GB On-Premise)",
    "gpt-oss:latest": "Mô hình GPT-OSS của OpenAI (13GB On-Premise)",
    "llama3:latest": "Mô hình LLama3 cũa Meta (13GB On-Premise)",
    "qwen2.5-coder:latest": "Mô hình Qwen 2.5 Coder của Meta (4.7GB On-Premise)",
    "deepseek-r1:latest": "Mô hình R1 của DeepSeek (5.2GB On-Premise)",
    "deepseek-coder:latest": "Mô hình Coder của DeepSeek (776MB On-Premise)",
    "deepseek-coder-v2:latest": "Mô hình Coder V2 của DeepSeek (8.9GB On-Premise)"
  },

  DOMAINS: {
    "TARA": "Kiến trúc Nền tảng Trí tuệ Nhân tạo Tin cậy",
    "EDU": "Giáo dục, Học tập và Đào tạo 4.0",
    "TECH": "Kỹ thuật, Mã nguồn & Cơ sở dữ liệu",
    "PERSONAL": "Không gian cá nhân riêng tư"
  },

  STORAGE: {
    "Public":"Công khai:public_knowledge",
    "Admin":"Hành chính:admin_knowledge",
    "Projects":"Dự án:project_knowledge",
    "Finance":"Tài chính:finance_knowledge",
    "Human":"Nhân sự:human_knowledge",
    "Tech":"Kỹ thuật:tech_knowledge",
    "Personal":"Cá nhân:personal_knowledge"
  }
};

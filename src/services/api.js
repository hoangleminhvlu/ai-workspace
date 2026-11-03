/**
 * iThunder AI OS - React SPA Service Layer (api.js)
 * Managed by: AI-TECH Center - Vanlang University
 * Version 6.09.27
 */

// Tự động nhận diện cấu hình tĩnh nhúng từ window.TARA_CONFIG của index.html
export const getGatewayConfig = () => {
  const config = window.TARA_CONFIG || {
    API_GATEWAY_URL: "https://aigate.is-tech.vn",
    WS_GATEWAY_URL: "wss://aigate.is-tech.vn"
  };
  return {
    httpUrl: config.API_GATEWAY_URL.replace(/\/$/, ""),
    wsUrl: config.WS_GATEWAY_URL.replace(/\/$/, "")
  };
};

const { httpUrl } = getGatewayConfig();

/**
 * Hàm phụ trợ đính kèm mã định danh JWT vào Header bảo mật
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem("tara_token") || "";
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
};

/**
 * Phiên làm việc hết hạn / token không hợp lệ (HTTP 401): xóa phiên cục bộ và đưa người dùng về màn hình đăng nhập.
 * App.jsx lắng nghe sự kiện "tara:session-expired" để chuyển phân cảnh LOGIN mà không cần tải lại trang.
 */
export const handleUnauthorized = (message = "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!") => {
  localStorage.removeItem("tara_token");
  localStorage.removeItem("tara_user");
  if (window.location.pathname !== "/") {
    try { sessionStorage.setItem("tara_logout_reason", message); } catch { /* bỏ qua */ }
    window.location.assign("/");
  } else {
    window.dispatchEvent(new CustomEvent("tara:session-expired", { detail: message }));
  }
};

/**
 * Chuẩn hóa thông điệp lỗi của FastAPI: `detail` có thể là chuỗi hoặc mảng lỗi kiểm tra dữ liệu (HTTP 422)
 */
export const describeError = (errData, httpStatus) => {
  const detail = errData?.detail ?? errData?.message;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join("; ");
  if (detail && typeof detail === "object") return detail.message || JSON.stringify(detail);  // vd. { code, message }
  return detail || `Lỗi phản hồi hệ thống (Mã ${httpStatus})`;
};

/**
 * Bóc tách phản hồi chung: 401 => hủy phiên; các lỗi HTTP khác => { status: "FAIL", detail } để giao diện hiển thị
 */
const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    handleUnauthorized(describeError(data, 401));
    return { status: "FAIL", detail: describeError(data, 401), httpStatus: 401 };
  }
  if (!response.ok) {
    return { status: "FAIL", detail: describeError(data, response.status), httpStatus: response.status };
  }
  return data;
};

export const iThunderAPI = {

  // --- CHUẨN HÓA LẠI ĐỊNH DẠNG JSON BODY ĐỂ TRÁNH LỖI 422 ---
  getCode: async (email) => {
    try {
      const response = await fetch(`${httpUrl}/api/auth/get-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json" // Chuyển đổi định dạng nhận dữ liệu JSON
        },
        body: JSON.stringify({ email: email }) // Đóng gói chuỗi JSON Object chuẩn
      });

      return await response.json();
    } catch (error) {
      console.error("[iThunder API] Thất bại trong tiến trình yêu cầu cấp lại PassCode:", error);
      return { status: "FAIL", message: "Không thể kết nối cổng Gateway xử lý Email." };
    }
  },

  // GỬI YÊU CẦU ĐĂNG KÝ THÀNH VIÊN MỚI (CHUẨN HÓA CẤU TRÚC JSON BODY) ---
  registerUser: async (email, fullName) => {
    try {
      const response = await fetch(`${httpUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json" // Chuyển sang JSON để triệt tiêu lỗi 422
        },
        body: JSON.stringify({
          email: email.trim(),
          name: fullName.trim() // Trường 'name' ánh xạ khớp chính xác với RegisterRequest Pydantic ở Backend
        })
      });

      if (!response.ok) {
        // Trích xuất thông tin chi tiết từ hệ thống phản hồi nếu có lỗi HTTP phát sinh
        const errData = await response.json().catch(() => ({}));
        return { status: "FAIL", message: describeError(errData, response.status) };
      }

      return await response.json();
    } catch (error) {
      console.error("[iThunder API] Lỗi gửi yêu cầu đăng ký tài khoản mới:", error);
      return { status: "FAIL", message: "Có lỗi kết nối Gateway đăng ký tài khoản mới." };
    }
  },

  // --- QUẢN LÝ PHIÊN LÀM VIỆC VÀ LỊCH SỬ CHAT ---
  // Định danh người dùng do Backend lấy từ JWT; không cần (và không nên) gửi user_id

  // Thông tin phiên + chính sách theo vai trò do Backend khai báo trong config.py
  // (vd. chat_history_enabled, chat_history_roles) để giao diện không phải tự khai báo lại
  getCurrentUser: async () => {
    try {
      const response = await fetch(`${httpUrl}/api/auth/me`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi truy vấn thông tin phiên làm việc:", error);
      throw error;
    }
  },

  // Lấy danh sách các luồng hội thoại cũ của user theo domain phân vùng
  getChatThreads: async (domain = "Personal") => {
    try {
      const response = await fetch(`${httpUrl}/api/chat/threads?domain=${encodeURIComponent(domain)}`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi trích xuất danh sách luồng chat:", error);
      throw error;
    }
  },

  // Trích xuất chi tiết nội dung tin nhắn cũ bên trong một Thread
  getChatHistory: async (threadId) => {
    try {
      const response = await fetch(`${httpUrl}/api/chat/history?thread_id=${encodeURIComponent(threadId)}`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi truy vấn lịch sử hội thoại:", error);
      throw error;
    }
  },

  // Xóa vĩnh viễn một luồng chat và các tin nhắn liên quan ( PostgreSQL Transaction )
  deleteThread: async (threadId) => {
    try {
      const response = await fetch(`${httpUrl}/api/chat/delete-thread?thread_id=${encodeURIComponent(threadId)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Thao tác hủy bỏ luồng chat thất bại:", error);
      throw error;
    }
  },

  // Đăng xuất an toàn: Backend xác định chính chủ phiên qua JWT để hủy PassTime trên OpenLDAP
  logout: async () => {
    try {
      const response = await fetch(`${httpUrl}/api/logout`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error("[iThunder API] Lỗi đăng xuất hệ thống:", error);
      return { status: "FAIL" };
    } finally {
      localStorage.removeItem("tara_token");
      localStorage.removeItem("tara_user");
    }
  },

  // --- QUẢN TRỊ KHO DỮ LIỆU - TRI THỨC (RAG DATA) ---

  // Thống kê dashboard các kho tri thức được phân quyền (RBAC).
  // Vai trò được Backend đọc từ JWT; mỗi kho trả về kèm trường permission: 'manage' | 'read'
  // Kèm các phân vùng (Public) người dùng tự mở: Backend kiểm tra lại quyền, khóa không còn hợp lệ bị bỏ qua và được gỡ ở đây
  getCollections: async () => {
    try {
      const opened = getOpenedClouds();
      const qs = opened.length ? `?open=${encodeURIComponent(opened.join(","))}` : "";
      const response = await fetch(`${httpUrl}/api/rag/collections${qs}`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      const data = await parseResponse(response);
      if (Array.isArray(data) && opened.length) {
        const valid = new Set(data.filter(c => c.opened).map(c => c.storage_key));
        saveOpenedClouds(opened.filter(key => valid.has(key)));
      }
      return data;
    } catch (error) {
      console.error("[iThunder API] Lỗi lấy danh mục kho tri thức pgvector:", error);
      throw error;
    }
  },

  // Phân vùng Public người dùng không tham gia nhưng được khai thác: { clouds: [{ storage_key, display_name, cloud, permission }], max_opened }
  listPublicClouds: async (q = "") => {
    const response = await fetch(`${httpUrl}/api/rag/public-clouds${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
      method: "GET",
      headers: getAuthHeaders()
    });
    return await parseResponse(response);
  },

  // Trích xuất danh sách file độc bản trong một phân vùng cụ thể
  getCollectionFiles: async (collectionName) => {
    try {
      const response = await fetch(`${httpUrl}/api/rag/collection/files?collection_name=${encodeURIComponent(collectionName)}`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi trích xuất danh sách file:", error);
      throw error;
    }
  },

  // Tải tài liệu trực tuyến (Multipart Upload)
  uploadDocument: async (file, domain = "Personal") => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("domain", domain);

      const token = localStorage.getItem("tara_token") || "";
      const response = await fetch(`${httpUrl}/api/rag/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
          // Lưu ý: Không set Content-Type để trình duyệt tự nhận diện Multipart boundary
        },
        body: formData
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi đẩy tệp tài liệu RAG lên Server:", error);
      throw error;
    }
  },

  // Xóa vĩnh viễn tệp tin và giải phóng các đoạn vector đặc trưng
  deleteFile: async (collectionName, fileName) => {
    try {
      const response = await fetch(`${httpUrl}/api/rag/collection/delete-file?collection_name=${encodeURIComponent(collectionName)}&file_name=${encodeURIComponent(fileName)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi gỡ bỏ tệp tri thức:", error);
      throw error;
    }
  },

  // Gửi lệnh đồng bộ thư mục vật lý tại máy chủ Backend
  syncDirectory: async (domain) => {
    try {
      const token = localStorage.getItem("tara_token") || "";

      // MẤU CHỐT: Sử dụng URLSearchParams để ép định dạng gửi đi thành application/x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append("domain", domain);

      const response = await fetch(`${httpUrl}/api/rag/sync-directory`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded" // Khớp với Form(...) của FastAPI
        },
        body: formData // Truyền payload dạng form-urlencoded
      });

      // Lỗi 401/403/422/500 được chuẩn hóa thành { status: "FAIL", detail } để không làm sập luồng catch
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Kiệt quệ đường truyền đồng bộ:", error);
      throw error; // Ném ra để khối catch ở App.jsx bắt được nếu rớt mạng thật
    }
  },

  // --- QUẢN TRỊ KHO DỮ LIỆU (TẬP TIN TRÊN MÁY CHỦ BACKEND) ---

  // Danh sách tập tin của kho kèm trạng thái đồng bộ vào Kho Tri thức (synced | outdated | not_synced)
  listDataFiles: async (domain) => {
    try {
      const response = await fetch(`${httpUrl}/api/data/files?domain=${encodeURIComponent(domain)}`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi đọc danh sách tập tin Kho Dữ liệu:", error);
      throw error;
    }
  },

  // Nội dung văn bản của tập tin (PDF/DOCX được bóc tách văn bản tại Backend)
  getDataFileText: async (domain, path) => {
    try {
      const response = await fetch(`${httpUrl}/api/data/file/text?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(path)}`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi đọc nội dung tập tin:", error);
      throw error;
    }
  },

  // Tệp gốc dạng Blob (hiển thị PDF trong khung xem hoặc tải về máy)
  getDataFileBlob: async (domain, path) => {
    try {
      const response = await fetch(`${httpUrl}/api/data/file/raw?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(path)}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${localStorage.getItem("tara_token") || ""}` }
      });
      if (!response.ok) return await parseResponse(response);
      return { status: "SUCCESS", blob: await response.blob() };
    } catch (error) {
      console.error("[iThunder API] Lỗi tải tập tin gốc:", error);
      throw error;
    }
  },

  // Tải tập tin mới vào Kho Dữ liệu; sync=true để RAG ngay; HTTP 409 (trùng tên) => hỏi người dùng rồi gửi lại với overwrite=true
  uploadDataFile: async (file, domain, { subdir = "", overwrite = false, sync = true } = {}) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("domain", domain);
      formData.append("subdir", subdir);
      formData.append("overwrite", overwrite ? "true" : "false");
      formData.append("sync", sync ? "true" : "false");
      const response = await fetch(`${httpUrl}/api/data/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("tara_token") || ""}` },
        body: formData
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi tải tập tin lên Kho Dữ liệu:", error);
      throw error;
    }
  },

  // Xóa tập tin: Backend chuyển vào thùng rác .Trash của Kho và gỡ tri thức liên quan
  deleteDataFile: async (domain, path) => {
    try {
      const response = await fetch(`${httpUrl}/api/data/file?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(path)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi xóa tập tin Kho Dữ liệu:", error);
      throw error;
    }
  },

  // Đồng bộ (RAG) một tập tin vào Kho Tri thức
  syncDataFile: async (domain, path) => {
    try {
      const formData = new URLSearchParams();
      formData.append("domain", domain);
      formData.append("path", path);
      const response = await fetch(`${httpUrl}/api/data/sync-file`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("tara_token") || ""}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi đồng bộ tập tin vào Kho Tri thức:", error);
      throw error;
    }
  },

  // Mô hình LLM chọn được trong khung AI Chat/Work, đọc động từ Máy chủ AI (Ollama /api/tags)
  // { models: [{ name, runtime, runtime_name, family, parameter_size, quantization, context_length, size_gb, capabilities, loaded }],
  //   runtimes, default_model, default_runtime } - gửi lại aimodel + runtime cho /api/chat/rag-stream
  getModels: async () => {
    try {
      const response = await fetch(`${httpUrl}/api/models`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi truy vấn danh mục mô hình AI:", error);
      return { status: "FAIL", detail: "Không thể kết nối AI Gateway. Hãy thử lại!" };
    }
  },

  // Thống kê nhanh số lượng tài liệu phục vụ kết xuất Sidebar
  getSidebarSummary: async () => {
    try {
      const response = await fetch(`${httpUrl}/api/sidebar/rag-summary`, {
        method: "GET",
        headers: getAuthHeaders()
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi trích xuất tóm tắt tri thức hệ thống:", error);
      throw error;
    }
  }
};

/**
 * Quản trị Định danh (OpenLDAP) - /api/identity/...
 * Backend đọc lại vai trò của người gọi trên OpenLDAP ở mỗi yêu cầu; giao diện dùng getMyPermissions()
 * để bật/tắt chức năng, còn việc chặn quyền luôn do Backend thực hiện (HTTP 403).
 */
const identityGet = async (path, label) => {
  try {
    const response = await fetch(`${httpUrl}/api/identity${path}`, {
      method: "GET",
      headers: getAuthHeaders()
    });
    return await parseResponse(response);
  } catch (error) {
    console.error(`[iThunder API] Lỗi ${label}:`, error);
    throw error;
  }
};

/**
 * Xác thực bổ sung (step-up): thao tác nhạy cảm trả HTTP 428 { detail: { code: "STEP_UP_REQUIRED" } }.
 * Trang Quản trị Định danh đăng ký một handler (hộp thoại nhập lại PassCode) qua setStepUpHandler; khi người dùng
 * xác nhận, mã step-up ngắn hạn được giữ trong bộ nhớ (không lưu localStorage) và thao tác được gửi lại một lần.
 */
const STEP_UP_HEADER = "X-Identity-Step-Up";
let stepUpToken = null;          // { token, expiresAt (ms) }
let stepUpHandler = null;        // async (message) => boolean

export const setStepUpHandler = (handler) => { stepUpHandler = handler; };
export const clearStepUp = () => { stepUpToken = null; };
const currentStepUp = () => (stepUpToken && stepUpToken.expiresAt > Date.now() ? stepUpToken.token : null);

// Thao tác ghi: trả { status: "SUCCESS", message, changes, user } hoặc { status: "FAIL", detail, httpStatus }.
// options.form: gửi FormData (multipart); options.raw: trả về Response gốc (tải tệp) khi thành công.
const identitySend = async (method, path, body, label, options = {}) => {
  const send = () => {
    const headers = getAuthHeaders();
    if (options.form) delete headers["Content-Type"];   // để trình duyệt tự đặt multipart boundary
    const token = currentStepUp();
    if (token) headers[STEP_UP_HEADER] = token;
    return fetch(`${httpUrl}/api/identity${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : (options.form ? body : JSON.stringify(body))
    });
  };
  try {
    let response = await send();
    if (response.status === 428 && stepUpHandler) {
      const data = await response.json().catch(() => ({}));
      stepUpToken = null;
      if (!(await stepUpHandler(data?.detail?.message || "Hãy nhập lại PassCode để xác nhận thao tác."))) {
        return { status: "FAIL", detail: "Thao tác đã hủy: chưa xác nhận PassCode.", httpStatus: 428 };
      }
      response = await send();
    }
    if (options.raw && response.ok) return response;
    return await parseResponse(response);
  } catch (error) {
    console.error(`[iThunder API] Lỗi ${label}:`, error);
    return { status: "FAIL", detail: "Không thể kết nối AI Gateway. Hãy thử lại!" };
  }
};

const uidPath = (uidNumber) => `/users/${encodeURIComponent(uidNumber)}`;
const cloudPath = (branch, gid) => `/clouds/${encodeURIComponent(branch)}/${encodeURIComponent(gid)}`;

export const identityAPI = {
  // Vai trò, danh sách quyền mới nhất của người đăng nhập (vd. "identity.users.read")
  getMyPermissions: () => identityGet("/me/permissions", "truy vấn quyền Quản trị Định danh"),

  // Hồ sơ định danh của chính người đăng nhập
  getMyProfile: () => identityGet("/me/profile", "truy vấn hồ sơ định danh cá nhân"),

  // Danh mục vai trò Workspace, nhóm/đơn vị (ou) và số thành viên
  getRoles: () => identityGet("/roles", "truy vấn danh mục vai trò"),

  // Danh sách người dùng: { q, role, status: active|inactive|template, sort: name|owner_id|uid|role, page, size }
  listUsers: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") query.set(key, value);
    });
    const qs = query.toString();
    return identityGet(`/users${qs ? `?${qs}` : ""}`, "truy vấn danh sách người dùng");
  },

  // Hồ sơ chi tiết một người dùng theo uidNumber
  getUser: (uidNumber) => identityGet(`/users/${encodeURIComponent(uidNumber)}`, "truy vấn hồ sơ người dùng"),

  // Số tài khoản trống (template) còn cấp phát được
  getAccountPool: () => identityGet("/pool", "truy vấn kho tài khoản trống"),

  // --- Đơn vị: phần thứ ba của ou "<ORGID>:<vai trò>:<đơn vị>" (bộ môn, khóa học...), chỉ đọc ---
  // { units: [{ unit, member_count, role_counts }], can_manage: false }
  listUnits: () => identityGet("/units", "truy vấn danh mục đơn vị"),

  // --- Phân vùng làm việc iDragonCloud: cn=<gid>,ou=<Nhánh>,ou=<ORGID> (Dự án, Thực tập, Hội đồng) ---
  // params: { branch, q, lifecycle, include_templates }
  // => { clouds: [{ dn, branch, gid_number, name, description, type, status: { raw, visibility, lifecycle, schedule },
  //      primary_member, supervisors, member_uids, legacy_member_uids, folder, collection, template }],
  //      templates_free, branches, types, lifecycle, visibility, can_manage }
  listClouds: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && value !== false) query.set(key, value);
    });
    const qs = query.toString();
    return identityGet(`/clouds${qs ? `?${qs}` : ""}`, "truy vấn danh mục phân vùng");
  },
  getCloud: (branch, gid) => identityGet(cloudPath(branch, gid), "truy vấn phân vùng"),
  // data: { branch, name, description, type, status, primary_member, supervisors: [uid], members: [uid] }
  allocateCloud: (data) => identitySend("POST", "/clouds", data, "cấp phát phân vùng"),
  // patch: { name, description, type, status, provider_uri, cost_rule, primary_member, supervisors }
  updateCloud: (branch, gid, patch) => identitySend("PATCH", cloudPath(branch, gid), patch, "cập nhật phân vùng"),
  changeCloudMembers: (branch, gid, add = [], remove = []) =>
    identitySend("POST", `${cloudPath(branch, gid)}/members`, { add, remove }, "cập nhật thành viên phân vùng"),
  // Thu hồi về Template (cần xác nhận PassCode): confirmName = iDCloudName hiện tại
  recycleCloud: (branch, gid, confirmName) =>
    identitySend("POST", `${cloudPath(branch, gid)}/recycle`, { confirm_name: confirmName }, "thu hồi phân vùng"),
  // Kho Tri thức đã lưu trữ khi thu hồi phân vùng: { archives: [{ collection, key, cloud_name, archived_at, chunks, files, synced_chunks }] }
  listKnowledgeArchives: (q = "") =>
    identityGet(`/knowledge/archives${q ? `?q=${encodeURIComponent(q)}` : ""}`, "truy vấn Kho Tri thức đã lưu trữ"),
  // Khôi phục vào Kho của một phân vùng đã cấp phát (cần xác nhận PassCode) => { mode: rename | merge, chunks, message }
  restoreKnowledgeArchive: (collection, branch, gid) =>
    identitySend("POST", `/knowledge/archives/${encodeURIComponent(collection)}/restore`, { branch, gid_number: Number(gid) },
      "khôi phục Kho Tri thức"),

  // --- Tự phục vụ: hồ sơ và email của chính người đăng nhập ---
  updateMyProfile: (patch) => identitySend("PATCH", "/me/profile", patch, "cập nhật hồ sơ cá nhân"),
  addMyEmail: (email) => identitySend("POST", "/me/emails", { email }, "thêm email"),
  removeMyEmail: (email) => identitySend("DELETE", `/me/emails?email=${encodeURIComponent(email)}`, undefined, "xóa email"),

  // --- Quản trị người dùng ---
  // data: { owner_id, full_name, email, roles: ["member", "member:PROJ1"], title, send_passcode }
  provisionUser: (data) => identitySend("POST", "/users", data, "cấp tài khoản"),
  updateUser: (uidNumber, patch) => identitySend("PATCH", uidPath(uidNumber), patch, "cập nhật hồ sơ người dùng"),
  changeRoles: (uidNumber, add = [], remove = []) => identitySend("POST", `${uidPath(uidNumber)}/roles`, { add, remove }, "cập nhật vai trò"),
  addUserEmail: (uidNumber, email) => identitySend("POST", `${uidPath(uidNumber)}/emails`, { email }, "thêm email người dùng"),
  removeUserEmail: (uidNumber, email) => identitySend("DELETE", `${uidPath(uidNumber)}/emails?email=${encodeURIComponent(email)}`, undefined, "xóa email người dùng"),
  resetPasscode: (uidNumber) => identitySend("POST", `${uidPath(uidNumber)}/passcode/reset`, undefined, "cấp lại PassCode"),
  deactivateUser: (uidNumber) => identitySend("POST", `${uidPath(uidNumber)}/deactivate`, undefined, "vô hiệu hóa tài khoản"),
  setPassTime: (uidNumber, passtimeMs) => identitySend("PUT", `${uidPath(uidNumber)}/passtime`, { passtime_ms: passtimeMs }, "đặt PassTime"),
  resetFaceId: (uidNumber) => identitySend("DELETE", `${uidPath(uidNumber)}/faceid`, undefined, "xóa dữ liệu FaceID"),
  recycleUser: (uidNumber, confirmOwnerId) => identitySend("POST", `${uidPath(uidNumber)}/recycle`, { confirm_owner_id: confirmOwnerId }, "thu hồi tài khoản"),

  // --- Xác thực bổ sung: nhập lại PassCode của chính mình, nhận mã step-up có hiệu lực vài phút ---
  stepUp: async (passcode) => {
    const res = await identitySend("POST", "/step-up", { passcode }, "xác nhận PassCode");
    if (res?.step_up_token) {
      stepUpToken = { token: res.step_up_token, expiresAt: Date.now() + (res.expires_in - 15) * 1000 };
      return { status: "SUCCESS", expiresAt: stepUpToken.expiresAt };
    }
    return res;
  },
  hasStepUp: () => Boolean(currentStepUp()),

  // --- Nạp / xuất CSV (Quản trị toàn tổ chức) ---
  // Chạy thử: importUsers(file) -> { file_hash, summary, rows }; áp dụng: importUsers(file, { dryRun: false, expectedHash })
  importUsers: (file, { dryRun = true, expectedHash = "", sendPasscode = false } = {}) => {
    const form = new FormData();
    form.append("file", file);
    form.append("dry_run", dryRun ? "true" : "false");
    form.append("expected_hash", expectedHash);
    form.append("send_passcode", sendPasscode ? "true" : "false");
    return identitySend("POST", "/import", form, "nạp người dùng từ CSV", { form: true });
  },
  // Tải CSV về máy: { q, role, status }; trả { status: "SUCCESS", fileName } hoặc { status: "FAIL", detail }
  exportUsersCsv: async (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const res = await identitySend("GET", `/users/export.csv${query.toString() ? `?${query}` : ""}`, undefined, "xuất CSV", { raw: true });
    if (!(res instanceof Response)) return res;
    const fileName = (res.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || "users.csv";
    const url = URL.createObjectURL(await res.blob());
    const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { status: "SUCCESS", fileName };
  },

  // Nhật ký thao tác: { target_id, actor_id, limit, before_id }
  listAudit: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") query.set(key, value);
    });
    const qs = query.toString();
    return identityGet(`/audit${qs ? `?${qs}` : ""}`, "truy vấn nhật ký Quản trị Định danh");
  }
};

/**
 * Model Context Protocol (MCP) - /api/mcp/...
 * Thông tin kết nối MCP Server của Gateway (POST /api/mcp) và quản trị MCP Server bên ngoài mà mô hình AI được gọi công cụ.
 * Trả { status: "SUCCESS", ... } hoặc { status: "FAIL", detail, httpStatus } (Backend chặn quyền bằng HTTP 403).
 */
const mcpRequest = async (method, path, body, label) => {
  try {
    const response = await fetch(`${httpUrl}/api/mcp${path}`, {
      method,
      headers: getAuthHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return await parseResponse(response);
  } catch (error) {
    console.error(`[iThunder API] Lỗi ${label}:`, error);
    return { status: "FAIL", detail: "Không thể kết nối AI Gateway. Hãy thử lại!" };
  }
};

const serverPath = (serverId) => `/servers/${encodeURIComponent(serverId)}`;

export const mcpAPI = {
  // Địa chỉ MCP Server, công cụ của Gateway theo vai trò, cấu hình MCP Client, is_admin
  getInfo: () => mcpRequest("GET", "/info", undefined, "truy vấn thông tin MCP"),

  // Công cụ MCP bên ngoài mà mô hình AI được gọi khi trả lời người đăng nhập
  getMyTools: () => mcpRequest("GET", "/tools", undefined, "truy vấn công cụ MCP"),

  // Quản trị viên: danh mục MCP Server bên ngoài (mã truy cập không bao giờ được trả về)
  listServers: () => mcpRequest("GET", "/servers", undefined, "truy vấn danh mục MCP Server"),
  createServer: (server) => mcpRequest("POST", "/servers", server, "đăng ký MCP Server"),
  // auth_token: bỏ khỏi body để giữ mã cũ, chuỗi rỗng để xóa
  updateServer: (serverId, changes) => mcpRequest("PATCH", serverPath(serverId), changes, "cập nhật MCP Server"),
  deleteServer: (serverId) => mcpRequest("DELETE", serverPath(serverId), undefined, "gỡ MCP Server"),
  testServer: (serverId) => mcpRequest("POST", `${serverPath(serverId)}/test`, undefined, "kết nối thử MCP Server")
};

/**
 * Trao đổi trực tuyến - /api/comm/... (thời gian thực qua /ws/comm, xem services/commSocket.js)
 * Tin nhắn, thành viên, tệp đính kèm chỉ nằm trên Backend: giao diện giữ trong bộ nhớ, tải lại khi mở trang.
 */
const commRequest = async (method, path, body, label) => {
  try {
    const response = await fetch(`${httpUrl}/api/comm${path}`, {
      method,
      headers: getAuthHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return await parseResponse(response);
  } catch (error) {
    console.error(`[iThunder API] Lỗi ${label}:`, error);
    return { status: "FAIL", detail: "Không thể kết nối AI Gateway. Hãy thử lại!" };
  }
};

const convPath = (convId) => `/conversations/${encodeURIComponent(convId)}`;

export const commAPI = {
  // { allowed, can_create_group, can_bind_ldap_group, assistant_available, default_model, storages, limits }
  getInfo: () => commRequest("GET", "/info", undefined, "truy vấn Trao đổi trực tuyến"),

  // { conversations: [{ id, kind: direct|group|assistant, title, ldap_unit, metadata, member_role, unread, member_count,
  //   peer: { user_id, user_name, online } | null, last_message }] }
  listConversations: () => commRequest("GET", "/conversations", undefined, "truy vấn danh sách hội thoại"),
  // { kind, title, member_ids, ldap_unit, domain, model } => { created, conversation }
  createConversation: (data) => commRequest("POST", "/conversations", data, "tạo hội thoại"),
  // { conversation: { ..., members: [{ user_id, user_name, member_role, online, last_read_id }] } }
  getConversation: (convId) => commRequest("GET", convPath(convId), undefined, "truy vấn hội thoại"),
  updateConversation: (convId, changes) => commRequest("PATCH", convPath(convId), changes, "cập nhật hội thoại"),
  addMembers: (convId, memberIds) => commRequest("POST", `${convPath(convId)}/members`, { member_ids: memberIds }, "thêm thành viên"),
  removeMember: (convId, userId) => commRequest("DELETE", `${convPath(convId)}/members/${encodeURIComponent(userId)}`, undefined, "bớt thành viên"),

  // Tin cũ hơn before (mã tin), theo thứ tự thời gian: { messages, has_more, last_read_id }
  listMessages: (convId, before) => commRequest("GET", `${convPath(convId)}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`, undefined, "tải tin nhắn"),
  // Dự phòng khi /ws/comm chưa kết nối: { content, client_msg_id, reply_to, attachments, aimodel, runtime }
  sendMessage: (convId, data) => commRequest("POST", `${convPath(convId)}/messages`, data, "gửi tin nhắn"),
  editMessage: (messageId, content) => commRequest("PATCH", `/messages/${encodeURIComponent(messageId)}`, { content }, "sửa tin nhắn"),
  deleteMessage: (messageId) => commRequest("DELETE", `/messages/${encodeURIComponent(messageId)}`, undefined, "xóa tin nhắn"),
  markRead: (convId, messageId) => commRequest("POST", `${convPath(convId)}/read`, { message_id: messageId }, "đánh dấu đã đọc"),

  // Người nhận tin (OpenLDAP, tối thiểu 2 ký tự) và phân vùng iDragonCloud được gắn hội thoại
  // listUnits => { units: [{ unit: "<Nhánh>/<gid>", description, member_count }] }
  searchUsers: (q) => commRequest("GET", `/users/search?q=${encodeURIComponent(q)}`, undefined, "tìm người dùng"),
  listUnits: () => commRequest("GET", "/units", undefined, "truy vấn phân vùng OpenLDAP"),

  // Tải tệp lên hội thoại => { attachment: { id, name, size, mime } }; gửi kèm tin bằng attachments: [id]
  uploadAttachment: async (convId, file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${httpUrl}/api/comm${convPath(convId)}/attachments`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("tara_token") || ""}` },
        body: formData
      });
      return await parseResponse(response);
    } catch (error) {
      console.error("[iThunder API] Lỗi tải tệp đính kèm:", error);
      return { status: "FAIL", detail: "Không thể kết nối AI Gateway. Hãy thử lại!" };
    }
  },

  // Tải tệp đính kèm (cần JWT nên không dùng liên kết trực tiếp): trả Blob hoặc { status: "FAIL", detail }
  downloadAttachment: async (convId, attachmentId) => {
    try {
      const response = await fetch(`${httpUrl}/api/comm${convPath(convId)}/attachments/${encodeURIComponent(attachmentId)}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("tara_token") || ""}` }
      });
      if (!response.ok) return await parseResponse(response);
      return await response.blob();
    } catch (error) {
      console.error("[iThunder API] Lỗi tải xuống tệp đính kèm:", error);
      return { status: "FAIL", detail: "Không thể kết nối AI Gateway. Hãy thử lại!" };
    }
  }
};

/**
 * Giám sát Hạ tầng Máy chủ AI - /api/system/...
 * Backend đọc Ollama (/api/ps, /api/tags) của từng Máy chủ AI LLM Runtime và, nếu được cấu hình,
 * NVIDIA DCGM Exporter / node_exporter / DGX Dashboard;
 * HTTP 403 khi vai trò không được xem.
 */
const systemGet = async (path, label) => {
  try {
    const response = await fetch(`${httpUrl}/api/system${path}`, {
      method: "GET",
      headers: getAuthHeaders()
    });
    return await parseResponse(response);
  } catch (error) {
    console.error(`[iThunder API] Lỗi ${label}:`, error);
    return { status: "FAIL", detail: "Không thể kết nối AI Gateway. Hãy thử lại!" };
  }
};

export const systemAPI = {
  // { runtimes: [{ id, name, ollama_url, sources, ollama: { ok, version }, models: { ok, installed, loaded }, monitored,
  //   host: { ok, errors, hostname, uptime_seconds, cpu, memory, disks, gpus } | null }], config_error }
  getMetrics: () => systemGet("/metrics", "truy vấn tài nguyên AI Server"),

  // { file, lines: [{ level, text }] } - chỉ quản trị viên
  getLogs: (lines = 100) => systemGet(`/logs?lines=${encodeURIComponent(lines)}`, "truy vấn nhật ký hệ thống")
};

/**
 * Phân vùng (Public) người dùng tự mở thêm vào danh mục Kho Tri thức: tiện ích riêng của từng người trên máy trạm này
 * (localStorage theo uidNumber). Quyền luôn được Backend kiểm tra lại ở mỗi lần tải danh mục.
 */
const openedCloudsKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem("tara_user") || "{}");
    return user?.userId ? `tara_opened_clouds:${user.userId}` : null;
  } catch {
    return null;
  }
};

export const getOpenedClouds = () => {
  const key = openedCloudsKey();
  if (!key) return [];
  try {
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(list) ? list.filter(k => typeof k === "string") : [];
  } catch {
    return [];
  }
};

const saveOpenedClouds = (list) => {
  const key = openedCloudsKey();
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify([...new Set(list)])); } catch { /* trình duyệt chặn lưu trữ: chỉ mất tiện ích */ }
};

export const openCloud = (storageKey, max = 10) => {
  const list = getOpenedClouds().filter(k => k !== storageKey);
  saveOpenedClouds([...list, storageKey].slice(-max));   // vượt giới hạn: bỏ phân vùng mở lâu nhất
};

export const closeCloud = (storageKey) => saveOpenedClouds(getOpenedClouds().filter(k => k !== storageKey));

/**
 * Quyền của người dùng trên một kho: ưu tiên trường `permission` do Backend trả về;
 * dự phòng cho Backend phiên bản cũ (chưa có trường này): Visitor chỉ đọc kho Public.
 */
export const getStoragePermission = (collection, userRole) => {
  if (!collection) return null;
  if (collection.permission) return collection.permission;
  return userRole === "visitor" && collection.storage_key === "Public" ? "read" : "manage";
};

// Ép buộc xuất bản đối tượng mặc định cho React SPA
export default iThunderAPI;

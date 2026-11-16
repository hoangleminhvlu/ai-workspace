/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.09.27)
 * Tập tin khởi chạy và cấu hình môi trường AI Workspace cho người dùng.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import iThunderAPI, { handleUnauthorized, describeError, getStoragePermission, identityAPI, openCloud, closeCloud, takePendingDomain, takePendingThread, getGatewayConfig, notifyAuthChanged, gatewayAPI } from './services/api';
import PublicCloudsDialog from './pages/PublicCloudsDialog';
import useLatestCallback from './hooks/useLatestCallback';
import { GUEST_USER, newThreadId, PERSONAL_STORE, MAX_FACE_ATTEMPTS, UNKNOWN_HISTORY_POLICY, SLASH_COMMANDS, formatDateTime } from './workspace/constants';
import { ORG_LOADING, CLIENT_APP } from './auth/gatewayUtils';
import LeftSidebar from './workspace/LeftSidebar';
import ChatHeader from './workspace/ChatHeader';
import useDataStore from './workspace/useDataStore';
import FileViewer from './workspace/FileViewer';
import StoreIntroCard from './workspace/StoreIntroCard';
import ChatMessages from './workspace/ChatMessages';
import Composer from './workspace/Composer';
import RightSidebar from './workspace/RightSidebar';
import GetCodeScreen from './auth/GetCodeScreen';
import RegisterScreen from './auth/RegisterScreen';
import LoginScreen from './auth/LoginScreen';
import useOrgGateway from './auth/useOrgGateway';
import FaceIdScreen from './auth/FaceIdScreen';

export default function App() {
  const navigate = useNavigate();
  // Điều hướng phân cảnh giao diện: 'LOGIN' | 'FACEID' | 'GET_CODE' | 'REGISTER' | 'WORKSPACE'
  const [viewState, setViewState] = useState('LOGIN');
 
  // Trạng thái Form & Xác thực
  const [passcode, setPasscode] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [clientIp, setClientIp] = useState('127.0.0.1');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  // PassCode đúng nhưng tài khoản chưa thuộc Tổ chức: { token, message, orgName, sent } để đề nghị đăng ký trở thành Khách
  const [joinOffer, setJoinOffer] = useState(null);

  // Tổ chức sở hữu AI Gateway và AI Gateway đang dùng (auth/useOrgGateway.js)
  const { orgInfo, setOrgInfo, activeGateway, loadOrgInfo, connectGateway } = useOrgGateway({
    onGatewayChange: () => {
      setJoinOffer(null);
      setErrorMessage('');
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }   // kênh FaceID của AI Gateway cũ
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFaceProcessing, setIsFaceProcessing] = useState(false);

  // Điều khiển ẩn/hiện Sidebar Trái & Phải
  // Điện thoại (< 768px): hai thanh bên mặc định đóng và mở dạng lớp phủ, nhường toàn bộ chiều ngang cho khung Chat
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

  // --- BỔ SUNG KHỐI STATE THEME VÀO ĐÂY ---
  const [theme, setTheme] = useState(localStorage.getItem('tara_theme') || 'dark');

  // Chu kỳ đồng bộ class `.dark` lên thẻ html tổng của trang web
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('tara_theme', theme);
  }, [theme]);

  // Quản lý Dữ liệu Workspace
  const [userData, setUserData] = useState(GUEST_USER);
  const [activeDomain, setActiveDomain] = useState('Personal');
  // Mô hình LLM: danh mục đọc động từ Máy chủ AI (Backend /api/models <- Ollama /api/tags); lựa chọn được nhớ trên máy trạm
  // Mỗi mô hình thuộc một Máy chủ AI LLM Runtime (ai_runtimes.json của Backend); runtime rỗng => Backend tự chọn
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('tara_model') || window.TARA_CONFIG?.DEFAULT_MODEL || 'gemma4:latest');
  const [selectedRuntime, setSelectedRuntime] = useState(() => localStorage.getItem('tara_runtime') || '');
  const [chatModels, setChatModels] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(newThreadId);

  // Kho dữ liệu RAG & Chat
  const [collections, setCollections] = useState([]);
  const [showPublicClouds, setShowPublicClouds] = useState(false);   // hộp thoại mở Kho của phân vùng Public
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');

  // Kho Dữ liệu của kho đang chọn (workspace/useDataStore.js). Hàm truyền vào gọi trễ: refreshCollections,
  // syncActiveCollection được khai báo phía dưới.
  const {
    dataFiles, dataFilesLoading, dataFilesError, ragOnlyFiles, ragListError, dataFilter, setDataFilter, dataSubdir,
    dataFolders, syncForce, setSyncForce, syncRunning, dataNotice, dataBusyPath, autoSyncUpload, setAutoSyncUpload,
    viewer, dataFileInputRef, refreshDataFiles, closeViewer, openDataFile, downloadDataFile, removeRagChunks,
    syncOneDataFile, deleteOneDataFile, uploadDataFiles, openDataFolder, dataCrumbs, visibleDataFolders, runFolderSync,
    visibleDataFiles, visibleRagOnly
  } = useDataStore({
    activeDomain, viewState,
    refreshCollections: () => refreshCollections(),
    runSync: (subdir, force) => runFolderSyncInChat(subdir, force),
  });

  // Hàm nạp/làm mới danh mục kho tri thức thời gian thực từ API Gateway [2]
  // Đã chuẩn hóa: Tiếp nhận đối tượng overrideUser để triệt tiêu độ trễ cập nhật State của React
  const refreshCollections = async (overrideUser = null) => {
    // Ưu tiên sử dụng dữ liệu truyền vào trực tiếp, nếu không có mới dùng State hiện tại
    const currentUser = overrideUser || userData;

    // Nếu chưa có bất kỳ thông tin user nào, không phát lệnh gọi API
    if (!currentUser || !currentUser.userId) return;

    try {
      // Backend xác định định danh và vai trò từ JWT; mỗi kho trả về kèm quyền 'manage' | 'read'
      const data = await iThunderAPI.getCollections();
      if (Array.isArray(data)) {
        setCollections(data);
        // Kho đang chọn không còn quyền truy cập (vd. tài khoản Khách dùng chung không có Kho Cá nhân): chuyển sang kho đầu tiên
        if (data.length > 0) setActiveDomain(cur => data.some(c => c.storage_key === cur) ? cur : data[0].storage_key);
        // Lối tắt "Mở Kho" từ tab Phân vùng của Quản trị Định danh: chọn kho đó làm kho đang dùng
        const pending = takePendingDomain();
        const target = pending && data.find(c => c.storage_key === pending);
        if (target) { setActiveDomain(target.storage_key); setActiveThreadId(newThreadId()); }
        // Nút "Tiếp tục hội thoại" ở trang Lịch sử Làm việc: chọn kho của phiên rồi nạp lại tin nhắn
        const thread = takePendingThread();
        if (thread && data.some(c => c.storage_key === thread.domain)) {
          setActiveDomain(thread.domain);
          restoreThread(thread);
        } else if (thread) {
          setMessages([{ role: "assistant", content: "⚠️ **[Không thể tiếp tục]:** Bạn không còn quyền truy cập Kho Tri thức `" + (thread.domain || "?") + "` của phiên _" + (thread.title || thread.thread_id) + "_." }]);
        }
      }
    } catch (err) {
      console.warn("[iThunder Data] Không thể liên thông nạp dữ liệu thống kê phân vùng:", err);
    }
  };

  // Chính sách lưu lịch sử hội thoại theo vai trò: khai báo DUY NHẤT tại Backend (config.py: CHAT_HISTORY_ROLES),
  // giao diện đọc qua /api/auth/me. enabled = null khi chưa biết (chưa nạp hoặc Backend chưa có API này).
  const [historyPolicy, setHistoryPolicy] = useState(UNKNOWN_HISTORY_POLICY);

  const refreshHistoryPolicy = async () => {
    try {
      const me = await iThunderAPI.getCurrentUser();
      // Gateway chưa trả /api/org/info (vd. phiên bản Backend cũ) => lấy Tổ chức từ thông tin phiên
      if (me?.org_id) {
        setOrgInfo(prev => (prev.status === 'ok' ? prev : { ...ORG_LOADING, status: 'ok', orgId: me.org_id, orgName: me.org_name || me.user_org || me.org_id }));
      }
      if (me?.owner_id) {
        setUserData(prev => {
          if (prev.ownerId === me.owner_id || String(prev.userId) !== String(me.user_id)) return prev;
          const next = { ...prev, ownerId: me.owner_id };
          localStorage.setItem("tara_user", JSON.stringify(next));
          return next;
        });
      }
      if (me && typeof me.chat_history_enabled === "boolean") {
        const policy = { enabled: me.chat_history_enabled, roles: Array.isArray(me.chat_history_roles) ? me.chat_history_roles : [] };
        setHistoryPolicy(policy);
        return policy;
      }
    } catch (err) {
      console.warn("[iThunder Data] Không thể nạp chính sách lưu lịch sử hội thoại:", err);
    }
    return UNKNOWN_HISTORY_POLICY;
  };

  // Tự động làm mới thông số khi người dùng click chuyển đổi qua lại giữa các dòng tên Kho Tri thức [2, 4]
  // Cho phép gọi nạp kho tri thức cho TẤT CẢ vai trò (bao gồm cả visitor)
  // useLatestCallback: effect chỉ chạy khi viewState đổi nhưng luôn gọi các hàm làm mới phiên bản mới nhất
  const onViewStateChange = useLatestCallback(() => {
    if (viewState === 'WORKSPACE')  {
      refreshCollections();
      refreshHistoryPolicy();
      refreshIdentityPermissions();
      refreshChatModels();
    } else {
      setHistoryPolicy(UNKNOWN_HISTORY_POLICY);  // Đăng xuất / hết phiên: quên chính sách của người dùng trước
      setIdentityPermissions([]);
    }
  });
  useEffect(() => { onViewStateChange(); }, [viewState, onViewStateChange]);

  // Danh mục mô hình của các Máy chủ AI; lựa chọn cũ không còn => cùng tên ở runtime khác, hoặc mô hình mặc định của Backend
  const refreshChatModels = async () => {
    const res = await iThunderAPI.getModels();
    if (res?.status !== 'SUCCESS' || !Array.isArray(res.models) || res.models.length === 0) return;
    setChatModels(res.models);
    const model = localStorage.getItem('tara_model');
    const runtime = localStorage.getItem('tara_runtime');
    const match = res.models.find(m => m.name === model && m.runtime === runtime) || res.models.find(m => m.name === model);
    setSelectedModel(match ? match.name : res.default_model);
    setSelectedRuntime(match ? match.runtime : (res.default_runtime || ''));
  };

  useEffect(() => {
    localStorage.setItem('tara_model', selectedModel);
    localStorage.setItem('tara_runtime', selectedRuntime);
  }, [selectedModel, selectedRuntime]);

  const modelKey = (runtime, name) => `${runtime}::${name}`;
  const selectModel = (key) => {
    const [runtime, ...name] = key.split('::');
    setSelectedRuntime(runtime);
    setSelectedModel(name.join('::'));
  };
  const modelLabel = (model) => {
    const known = window.TARA_CONFIG?.MODEL_LIST?.[model.name];
    const info = [model.parameter_size, model.loaded ? '● sẵn sàng' : null].filter(Boolean).join(' · ');
    return known ? `${known}${model.loaded ? ' · ● sẵn sàng' : ''}` : `${model.name}${info ? ` (${info})` : ''}`;
  };
  const modelGroups = chatModels.reduce((groups, model) => {
    const group = groups.find(g => g.runtime === model.runtime);
    if (group) group.models.push(model);
    else groups.push({ runtime: model.runtime, name: model.runtime_name, models: [model] });
    return groups;
  }, []);

  // Quyền Quản trị Định danh do Backend đọc lại từ OpenLDAP: quyết định có hiện mục "Quản trị Định danh" ở LeftSidebar
  const [identityPermissions, setIdentityPermissions] = useState([]);
  const refreshIdentityPermissions = async () => {
    try {
      const res = await identityAPI.getMyPermissions();
      setIdentityPermissions(Array.isArray(res?.permissions) ? res.permissions : []);
    } catch {
      setIdentityPermissions([]);
    }
  };

  const onActiveDomainChange = useLatestCallback(() => {
    if (viewState === 'WORKSPACE') {
      refreshCollections();
    }
  });
  useEffect(() => { onActiveDomainChange(); }, [activeDomain, onActiveDomainChange]);

  // Trạng thái bộ lọc lệnh gạch chéo (Slash Commands)
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState([]);
  const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);

  const slashCommands = SLASH_COMMANDS;
  const historyListRef = useRef([]);  // Danh sách thread của lần /history gần nhất, dùng cho /thread <số>

  // Tham chiếu phần cứng máy trạm
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const faceAwaitingRef = useRef(false);   // Đang chờ kết quả khung hình trước: không gửi dồn khung mới
  const faceFailCountRef = useRef(0);      // Số khung hình thất bại liên tiếp
  const faceSucceededRef = useRef(false);  // Lượt quét hiện tại đã xác thực thành công
  const [faceScanStopped, setFaceScanStopped] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const promptInputRef = useRef(null);

  // Ô nhập Prompt tự giãn theo nội dung (bắt đầu 1 dòng, tối đa 40% chiều cao màn hình rồi mới cuộn)
  useEffect(() => {
    const el = promptInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.4))}px`;
  }, [inputPrompt, viewState]);

 // --- TỰ ĐỘNG PHỤC HỒI PHIÊN LÀM VIỆC KHI REFRESH TRÌNH DUYỆT (F5) ---
  // Chạy một lần khi mở trang (restoreSession ổn định nhờ useLatestCallback)
  const restoreSession = useLatestCallback(() => {
    // Lý do bị đăng xuất khi đang ở trang khác "/" (vd. tài khoản bị tạm khóa trong lúc mở /identity)
    try {
      const reason = sessionStorage.getItem("tara_logout_reason");
      if (reason) { sessionStorage.removeItem("tara_logout_reason"); setErrorMessage(reason); }
    } catch { /* sessionStorage có thể bị chặn: bỏ qua */ }

    const savedToken = localStorage.getItem("tara_token");
    const savedUserStr = localStorage.getItem("tara_user");

    // Nếu tồn tại token hợp lệ và khác chuỗi rỗng/None
    if (savedToken && savedToken !== "None" && savedToken !== "") {
      setIsLoading(true);

      // CHUẨN HÓA: Phục hồi thông tin nhân sự chính chủ, triệt tiêu bẫy Guest 1162000
      if (savedUserStr) {
        try {
          const parsedUser = JSON.parse(savedUserStr);
          if (parsedUser && parsedUser.userId) {
            setUserData(parsedUser); // <--- Trả lại chính xác ID và Tên người dùng
            setViewState('WORKSPACE');
            // Ép lệnh refresh đọc trực tiếp gói biến đệm vừa phân rã để kéo đúng dữ liệu RBAC
            refreshCollections(parsedUser);
          }
        } catch (e) {
          console.error("Lỗi phân giải cấu trúc dữ liệu người dùng:", e);
          setViewState('WORKSPACE');
          refreshCollections();
        }
      } else {
        setViewState('WORKSPACE');
        refreshCollections();
      }

      setIsLoading(false);
    }
  });
  useEffect(() => { restoreSession(); }, [restoreSession]);

  useEffect(() => {
    // Thu thập IP máy trạm tự động
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => console.warn("[iThunder] Sử dụng IP mạng nội bộ dự phòng."));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Backend trả 401 (token hết hạn / không hợp lệ): api.js đã xóa phiên cục bộ, đưa người dùng về màn hình đăng nhập
  useEffect(() => {
    const onSessionExpired = (e) => {
      setMessages([]);
      setCollections([]);
      setActiveThreadId(newThreadId());
      setUserData(GUEST_USER);
      setErrorMessage(e.detail || "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!");
      setIsLoading(false);
      setViewState('LOGIN');
    };
    window.addEventListener('tara:session-expired', onSessionExpired);
    return () => window.removeEventListener('tara:session-expired', onSessionExpired);
  }, []);

  // =========================================================================
  // XỬ LÝ LỆNH GẠCH CHÉO (SLASH COMMANDS) ENGINE
  // =========================================================================
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputPrompt(value);

    if (value.startsWith('/')) {
      const searchWord = value.toLowerCase();
      const filtered = slashCommands.filter(c => c.cmd.toLowerCase().startsWith(searchWord));
      setFilteredCommands(filtered);
      setShowSlashMenu(filtered.length > 0);
      setSelectedCmdIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const selectCommand = (commandStr) => {
    setInputPrompt(commandStr + " ");
    setShowSlashMenu(false);
  };

  const handleInputKeyDown = (e) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCmdIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCmdIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredCommands[selectedCmdIndex].cmd);
      } else if (e.key === 'Escape') {
        setShowSlashMenu(false);
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendPrompt();
      }
    }
  };

  // =========================================================================
  // KẾT NỐI WEBSOCKET XÁC THỰC VÀ BIỂU MẪU ĐĂNG NHẬP
  // =========================================================================
  // =========================================================================
  // KẾT NỐI WEBSOCKET XÁC THỰC VÀ BIỂU MẪU ĐĂNG NHẬP
  // =========================================================================
  
  // Địa chỉ AI Gateway: dùng chung getGatewayConfig của services/api.js (mặc định là chính tên miền đang mở AI Workspace)

  const initWebSocketConnection = (onOpenCallback) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (onOpenCallback) onOpenCallback();
      return;
    }

    const { wsUrl } = getGatewayConfig();

    // Khởi tạo thực thể kênh truyền trắc sinh học FaceID bảo mật
    const socket = new WebSocket(`${wsUrl}/ws/auth`);

    socket.onopen = () => {
      wsRef.current = socket;
      if (onOpenCallback) onOpenCallback();
    };

    socket.onmessage = (event) => {
      try {
        const res = JSON.parse(event.data);
        setIsLoading(false);
        faceAwaitingRef.current = false; // Kết quả khung hình trước đã về: cho phép gửi khung tiếp theo

        if (res.status === "REQUIRE_FACEID") {
          setStatusMessage(res.message);
          setViewState('FACEID');
          setTimeout(() => startWebcamHardware(), 500);
        } else if (res.status === "SUCCESS") {
          // Khung hình còn đang xử lý có thể trả thêm SUCCESS: chỉ xử lý lần đầu của mỗi lượt quét
          if (faceSucceededRef.current) return;
          faceSucceededRef.current = true;
          setStatusMessage(res.message);
          setErrorMessage('');
          stopWebcamHardware();
          faceFailCountRef.current = 0;
          gatewayAPI.commit();   // ứng dụng máy trạm: ghi nhớ AI Gateway vừa xác thực thành công
          localStorage.setItem("tara_token", res.access_token || "");

          const sessionUser = {
            userId: res.user_id,
            ownerId: res.owner_id || "",
            userName: res.user_name,
            userRole: res.user_role || "member",
            userOrg: res.user_org
          };
          localStorage.setItem("tara_user", JSON.stringify(sessionUser));
          notifyAuthChanged();

          setUserData(sessionUser);
          setActiveThreadId(newThreadId());
          setViewState('WORKSPACE');
        } else if (res.status === "JOIN_REQUIRED") {
          // Kênh WebSocket xác thực PassCode: tài khoản chưa thuộc Tổ chức
          stopWebcamHardware();
          setJoinOffer({ token: res.join_token, message: res.message, orgName: res.org_name, sent: false });
          setViewState('LOGIN');
        } else if (res.status === "BAD_IMAGE" || res.status === "FAIL" || res.status === "ERROR") {
          setErrorMessage(res.message);
          faceFailCountRef.current += 1;

          // Lỗi PassCode/hệ thống: dừng ngay. Lỗi tạm thời (không thấy mặt, ảnh mờ, chưa khớp): tiếp tục quét đến giới hạn
          const fatal = res.status === "ERROR" || res.code === "ACCOUNT_SUSPENDED" || res.code === "JOIN_REQUIRED" || /passcode/i.test(res.message || "");
          if (fatal || faceFailCountRef.current >= MAX_FACE_ATTEMPTS) {
            stopWebcamHardware();
            setFaceScanStopped(true);
          }
        }
      } catch (err) { console.error("Lỗi phân rã gói tin trắc sinh học WS:", err); }
    };

    socket.onerror = () => {
      setErrorMessage("Mất kết nối cổng bảo mật tới AI Gateway.");
      setIsLoading(false);
    };

    // Kênh bị đóng (Backend khởi động lại, mất mạng): dừng gửi khung hình vào socket đã chết
    socket.onclose = () => {
      if (wsRef.current === socket) wsRef.current = null;
      faceAwaitingRef.current = false;
      if (faceIntervalRef.current) {
        stopWebcamHardware();
        setFaceScanStopped(true);
        setErrorMessage("Kênh xác thực FaceID đã bị ngắt. Hãy bấm Quét lại.");
      }
    };
  };

  const startWebcamHardware = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsFaceProcessing(true);
        setFaceScanStopped(false);
        faceAwaitingRef.current = false;
        faceSucceededRef.current = false;
        if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
        faceIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !canvasRef.current || !wsRef.current) return;
          if (wsRef.current.readyState !== WebSocket.OPEN) return;
          // Backend xử lý tuần tự: chỉ gửi khung mới khi kết quả khung trước đã về, tránh dồn hàng đợi
          if (faceAwaitingRef.current) return;
          faceAwaitingRef.current = true;
          const context = canvasRef.current.getContext('2d');
          canvasRef.current.width = 320;
          canvasRef.current.height = 320;
          context.drawImage(videoRef.current, 0, 0, 320, 320);
          const base64Frame = canvasRef.current.toDataURL('image/jpeg', 0.85).replace(/^data:image\/[a-z]+;base64,/, "");
          wsRef.current.send(JSON.stringify({ action: "verify_faceid", passcode: passcode, domain: activeDomain, clientIp: clientIp, image: base64Frame }));
        }, 1200);
      }
    } catch { setErrorMessage("Không thể kích hoạt Webcam máy trạm. Vui lòng cấp quyền."); }
  };

  const stopWebcamHardware = () => {
    if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
    faceIntervalRef.current = null;
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsFaceProcessing(false);
  };

  // Quét lại sau khi tạm dừng: mở lại kênh WebSocket nếu đã bị đóng, reset bộ đếm lỗi
  const retryFaceScan = () => {
    faceFailCountRef.current = 0;
    setErrorMessage('');
    setFaceScanStopped(false);
    initWebSocketConnection(() => setTimeout(() => startWebcamHardware(), 300));
  };

  // Người dùng đồng ý trở thành Khách: Backend gửi liên kết xác nhận tới Email đăng ký của tài khoản
  const acceptJoinOffer = async () => {
    if (!joinOffer?.token) return;
    setIsLoading(true);
    setErrorMessage('');
    const res = await iThunderAPI.requestJoin(joinOffer.token);
    setIsLoading(false);
    if (res.status === "SUCCESS") setJoinOffer({ ...joinOffer, sent: true, message: res.message });
    else setErrorMessage(res.message || "Không gửi được yêu cầu trở thành Khách của Tổ chức.");
  };

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    if (CLIENT_APP && orgInfo.status !== 'ok') {
      setErrorMessage('Hãy nhập địa chỉ và Kết nối AI Gateway của Tổ chức trước khi xác thực PassCode.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setJoinOffer(null);

    try {
      // Cùng AI Gateway với mọi API khác (/api/org/info, /ws/auth...): đúng Backend của Tổ chức đang mở
      const response = await fetch(`${getGatewayConfig().httpUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode, clientIp: clientIp })
      });

      const res = await response.json();
      setIsLoading(false);

      if (res.status === "SUCCESS") {
        // LUỒNG MIỄN FACEID: Lưu token và thông tin, vào thẳng luôn Workspace
        gatewayAPI.commit();   // ứng dụng máy trạm: ghi nhớ AI Gateway vừa xác thực thành công
        localStorage.setItem("tara_token", res.access_token || "");
        const sessionUser = {
          userId: res.user_id,
          ownerId: res.owner_id || "",
          userName: res.user_name,
          userRole: res.user_role || "member",
          userOrg: res.user_org
        };
        localStorage.setItem("tara_user", JSON.stringify(sessionUser));
        notifyAuthChanged();
        setUserData(sessionUser);
        setActiveThreadId(newThreadId());
        setViewState('WORKSPACE'); // Chuyển thẳng trang
      }
      else if (res.status === "JOIN_REQUIRED") {
        // PassCode đúng nhưng chưa là thành viên của Tổ chức: đề nghị đăng ký trở thành Khách (xác nhận qua Email)
        setPasscode('');
        setJoinOffer({ token: res.join_token, message: res.message, orgName: res.org_name, sent: false });
      }
      else if (res.status === "REQUIRE_FACEID") {
        // LUỒNG BẮT BUỘC QUÉT FACEID: Kích hoạt kết nối và bật camera quét
        setStatusMessage(res.message);
        setViewState('FACEID');
        initWebSocketConnection(() => {
          // Bật ngầm luồng WebSocket để sẵn sàng hứng base64 camera gửi lên
          console.log("[iThunder Gateway] Đã kết nối kênh trắc sinh học FaceID.");
          setTimeout(() => startWebcamHardware(), 500);
        });
      } 
      else {
        setErrorMessage(res.message || "Mã PassCode không chính xác!");
      }
    } catch {
      setIsLoading(false);
      const gateway = getGatewayConfig().httpUrl;
      setErrorMessage(`Không thể kết nối API xác thực của AI Gateway${gateway ? ` ${gateway}` : ''}.`);
    }
  };

  // =========================================================================
  // XỬ LÝ KẾT XUẤT LUỒNG CHAT STREAMING (SSE CHAT)
  // =========================================================================
  const handleSendPrompt = async () => {
    if (!inputPrompt.trim() || isLoading) return;

    const userQuery = inputPrompt.trim();
    setInputPrompt('');
    setShowSlashMenu(false);
    setIsLoading(true);
    closeViewer();  // Gửi câu hỏi: quay lại khung hội thoại để thấy câu trả lời

    setMessages(prev => [...prev, { role: "user", content: userQuery }]);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    if (userQuery.startsWith('/')) {
      try {
        await runSlashCommand(userQuery);
      } catch (err) {
        console.error("[iThunder Slash Command]", err);
        replaceLastAssistant("❌ **[Lỗi lệnh nhanh]:** Không thể thực thi lệnh `" + userQuery.split(/\s+/)[0] + "` do mất kết nối tới AI Gateway.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const token = localStorage.getItem("tara_token") || "";
      // Định danh/vai trò/IP do Backend lấy từ JWT. Câu hỏi gửi trong thân JSON (không nằm trên URL) để không bị ghi vào
      // nhật ký truy cập của máy chủ web và không bị giới hạn độ dài URL.
      const response = await fetch(`${getGatewayConfig().httpUrl}/api/chat/rag-stream`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: activeThreadId,
          domain: activeDomain,
          aimodel: selectedModel,
          runtime: selectedRuntime || null,
          prompt: userQuery
        })
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          handleUnauthorized(describeError(errData, 401));
          return;
        }
        // 403: vai trò không có quyền khai thác kho đang chọn; 422: mô hình không còn trên Máy chủ AI => nạp lại danh mục
        if (response.status === 422) refreshChatModels();
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `⛔ **${response.status === 422 ? "Không thể dùng mô hình AI" : "Không thể khai thác Kho tri thức"}:** ${describeError(errData, response.status)}`
          };
          return updated;
        });
        return;
      }

      // --- KHỐI XỬ LÝ ĐỌC LUỒNG STREAM ĐÃ CHUẨN HÓA TRIỆT TIÊU TRÙNG LẶP ---
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = ""; // Biến cục bộ để giữ vết chuỗi sạch tránh re-render đè
      let lineBuffer = "";      // Giữ phần dòng SSE bị cắt dở giữa hai chunk mạng

      const appendToken = (text) => {
        accumulatedText += text; // Cộng dồn vào biến đệm sạch
        const snapshot = accumulatedText;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: snapshot };
          return updated;
        });
      };

      const processLine = (line) => {
        const cleanLine = line.trim();

        // Loại bỏ dòng trống hoặc dòng kết thúc hội thoại
        if (!cleanLine || cleanLine === "data: [DONE]") return;

        if (cleanLine.startsWith("data: ")) {
          try {
            // Trích xuất chính xác chuỗi JSON nằm sau cụm "data: "
            const parsed = JSON.parse(cleanLine.substring(6).trim());
            const tokenContent = parsed.choices?.[0]?.delta?.content;
            if (tokenContent) appendToken(tokenContent);
          } catch {
            // Phòng hờ API trả về text thô không theo chuẩn OpenAI
            if (cleanLine.includes('"text":')) {
              try {
                const parsedRaw = JSON.parse(cleanLine);
                if (parsedRaw.text) appendToken(parsedRaw.text);
              } catch { /* Không phải JSON hợp lệ: bỏ qua dòng này */ }
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop(); // Dòng cuối có thể chưa trọn vẹn, chờ chunk kế tiếp

        for (const line of lines) processLine(line);
      }

      // Xả phần còn lại trong bộ giải mã và bộ đệm dòng khi luồng đóng
      lineBuffer += decoder.decode();
      if (lineBuffer) processLine(lineBuffer);

    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `❌ **Lỗi kết nối mạng:** Không thể nhận dữ liệu phát trực tuyến từ cổng AI Platform.`
        };
        return updated;
      });
    } finally {
      // TIẾN TRÌNH KẾT THÚC (THÀNH CÔNG HAY LỖI) -> GIẢI PHÓNG CỜ KHÓA
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    // Xóa giá trị input để có thể chọn lại cùng một tệp ở lần sau
    e.target.value = "";
    if (!file) return;

    const targetDomain = activeDomain;
    if (!canManageActive) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⛔ **[Không đủ quyền]:** Vai trò `" + userData.userRole + "` chỉ được khai thác (không được nạp tài liệu) vào phân vùng `" + targetDomain + "`."
      }]);
      return;
    }

    // Gộp cả 2 tin nhắn vào một lượt cập nhật state để tối ưu hiệu năng render
    setMessages(prev => [
      ...prev,
      { role: "user", content: "📎 Đính kèm tệp tin tài liệu: `" + file.name + "`" },
      { role: "assistant", content: "⏳ Đang lưu tệp vào Kho Dữ liệu và nạp vào Kho Tri thức `" + targetDomain + "`..." }
    ]);

    const setUploadResult = (content) => {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content };
        return updated;
      });
    };

    try {
      const res = await iThunderAPI.uploadDocument(file, targetDomain);

      // Tệp được lưu vào thư mục gốc của Kho Dữ liệu ứng với Kho Tri thức đang chọn rồi mới RAG: làm mới cả hai danh mục
      if (res?.stored || res?.status === "SUCCESS") await Promise.all([refreshCollections(), refreshDataFiles()]);
      if (res && res.status === "SUCCESS") {
        setUploadResult("✅ **[Nạp tri thức thành công]:** Tài liệu `" + (res.path || file.name) + "` đã được lưu vào Kho Dữ liệu và nạp vào Kho Tri thức `" + targetDomain + "`." + (res.detail ? "\n\n* Chi tiết: " + res.detail : ""));
      } else {
        // FastAPI có thể trả detail dạng mảng (lỗi 422) hoặc chuỗi
        const reason = typeof res?.detail === "string" ? res.detail : (res?.message || "Backend từ chối tiếp nhận tệp tin.");
        setUploadResult("⚠️ **[Nạp tri thức thất bại]:** Không thể tích hợp tài liệu `" + file.name + "`.\n\n* Nguyên nhân: " + reason);
      }
    } catch {
      setUploadResult("❌ **[Lỗi kết nối]:** Không thể tải tệp `" + file.name + "` lên AI Gateway.");
    }
  };


  // Đổi kho tri thức: mở một phiên hội thoại (thread) mới gắn với kho vừa chọn
  const storeList = Array.isArray(collections) ? collections : [];
  const personalStore = storeList.find(c => c.storage_key === PERSONAL_STORE);
  const otherStores = storeList.filter(c => c.storage_key !== PERSONAL_STORE);
  const activeOther = otherStores.find(c => c.storage_key === activeDomain);

  const handleSelectDomain = (col) => {
    if (col.storage_key === activeDomain) return;
    setActiveDomain(col.storage_key);
    setActiveThreadId(newThreadId());
    if (messages.length > 0) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "🔀 **[Hệ thống]:** Đã chuyển sang Kho tri thức `" + col.display_name + "`. Các câu hỏi tiếp theo thuộc một phiên hội thoại mới."
      }]);
    }
  };

  // Mở Kho của một phân vùng Public (chỉ khai thác): thêm vào danh mục kho ở thanh bên rồi chuyển sang kho đó
  const handleOpenPublicCloud = async (col, maxOpened) => {
    openCloud(col.storage_key, maxOpened || 10);
    setShowPublicClouds(false);
    await refreshCollections();
    handleSelectDomain(col);
  };

  // Gỡ phân vùng Public đã mở khỏi danh mục; đang dùng kho đó thì quay về kho Cá nhân
  const handleClosePublicCloud = async (col) => {
    closeCloud(col.storage_key);
    if (activeDomain === col.storage_key) handleSelectDomain({ storage_key: "Personal", display_name: "Cá nhân" });
    await refreshCollections();
  };

  // =========================================================================
  // LỆNH NHANH (SLASH COMMANDS): thực thi tại máy trạm bằng các API sẵn có của AI Gateway
  // =========================================================================

  // Thay nội dung bong bóng trả lời đang chờ (tin nhắn cuối) bằng kết quả của lệnh
  const replaceLastAssistant = (content) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { role: "assistant", content };
      return updated;
    });
  };

  const syncProgressMessage = (subdir = '') =>
    "⏳ **[Hệ thống]:** Đang RAG các tệp chưa đồng bộ hoặc đã sửa trong " + (subdir ? "thư mục `" + subdir + "` của " : "") + "Kho Dữ liệu `" + selectedColDetails.display_name + "`...";

  // Đồng bộ thư mục Kho Dữ liệu của kho đang chọn; dùng chung cho nút "Đồng bộ Kho Tri thức" và lệnh /rag-sync
  const syncActiveCollection = async ({ subdir = '', force = false } = {}) => {
    const col = selectedColDetails;
    try {
      const res = await iThunderAPI.syncDirectory(col.storage_key, { subdir, force });
      if (res && res.status === "SUCCESS") {
        await Promise.all([refreshCollections(), refreshDataFiles()]);
        const more = res.remaining > 0 ? "\n\n⏭️ Kho còn tệp chưa RAG: bấm **Đồng bộ** lần nữa (hoặc gõ `/rag-sync" + (subdir ? " " + subdir : "") + "`) để nạp tiếp." : "";
        return "✅ **[Đồng bộ thành công]:** " + (res.detail || "Đã cập nhật danh mục tệp tin nhúng.") + more;
      }
      return "⚠️ **[Đồng bộ thất bại]:** Backend phản hồi lỗi xử lý.\n\n* Nguyên nhân: " + (res?.detail || "Không rõ nguyên nhân cấu hình.");
    } catch {
      return "❌ **[Lỗi kết nối]:** Không thể gửi lệnh đồng bộ tới AI Gateway.";
    }
  };

  // RAG một thư mục (nút trên thư mục / cuối thanh bên phải): báo tiến trình và kết quả trong khung Chat
  const runFolderSyncInChat = async (subdir, force) => {
    setMessages(prev => [...prev, { role: "assistant", content: syncProgressMessage(subdir) }]);
    const result = await syncActiveCollection({ subdir, force });
    setMessages(prev => [...prev, { role: "assistant", content: result }]);
  };

  // Lấy danh sách thread của kho đang chọn (mới nhất trước) và ghi nhớ cho /thread <số>
  const fetchThreadList = async () => {
    const data = await iThunderAPI.getChatThreads(activeDomain);
    if (!Array.isArray(data)) throw new Error(data?.detail || data?.message || "Không đọc được danh sách hội thoại.");
    historyListRef.current = data;
    return data;
  };

  // Nạp lại toàn bộ tin nhắn của một thread và tiếp tục ghi vào thread đó
  const restoreThread = async (thread) => {
    const data = await iThunderAPI.getChatHistory(thread.thread_id);
    if (!Array.isArray(data)) {
      replaceLastAssistant("⚠️ **[Không thể khôi phục]:** " + (data?.detail || "Phiên hội thoại không tồn tại hoặc không thuộc về bạn."));
      return;
    }
    const restored = data.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") }));
    setActiveThreadId(thread.thread_id);
    setMessages([
      ...restored,
      {
        role: "assistant",
        content: "📂 **[Đã khôi phục hội thoại]:** _" + (thread.title || thread.thread_id) + "_ (" + restored.length +
          " tin nhắn, cập nhật " + formatDateTime(thread.created_at) + "). Các câu hỏi tiếp theo sẽ được ghi tiếp vào phiên này."
      }
    ]);
  };

  const historyNotSavedMessage = (policy) =>
    "ℹ️ **[Lịch sử hội thoại]:** Hệ thống không lưu lịch sử hội thoại cho vai trò `" + userData.userRole + "`" +
    (policy.roles.length ? " (chỉ lưu cho " + policy.roles.join(", ") + ")." : ".");

  // Kiểm tra chính sách trước khi gọi API lịch sử; nạp lại nếu chưa biết.
  // Nếu Backend chưa hỗ trợ /api/auth/me (enabled = null) thì vẫn gọi API lịch sử như bình thường.
  const historyBlocked = async () => {
    const policy = historyPolicy.enabled === null ? await refreshHistoryPolicy() : historyPolicy;
    if (policy.enabled === false) {
      replaceLastAssistant(historyNotSavedMessage(policy));
      return true;
    }
    return false;
  };

  const runSlashCommand = async (text) => {
    const [rawCmd, ...args] = text.trim().split(/\s+/);
    const cmd = rawCmd.toLowerCase();
    const storeName = activeCollection?.display_name || activeDomain;

    switch (cmd) {
      case '/menu': {
        setIsLeftSidebarOpen(true);
        setIsRightSidebarOpen(true);
        replaceLastAssistant(
          "🧭 **[Menu tác vụ chính]** — Kho đang làm việc: `" + storeName + "` (" + (canManageActive ? "Quản trị" : "Chỉ khai thác") + ")\n\n" +
          SLASH_COMMANDS.map(c => "* `" + c.cmd + "` — " + c.desc).join("\n") +
          "\n\nĐã mở thanh Kho tri thức (bên trái) và Thông số phân vùng (bên phải)."
        );
        return;
      }

      case '/history': {
        if (await historyBlocked()) return;
        const threads = await fetchThreadList();
        if (threads.length === 0) {
          replaceLastAssistant("🗂️ **[Lịch sử hội thoại]:** Chưa có hội thoại nào được lưu trong kho `" + storeName + "`.");
          return;
        }
        const shown = threads.slice(0, 20);
        replaceLastAssistant(
          "🗂️ **[Lịch sử hội thoại — kho `" + storeName + "`]:** " + threads.length + " phiên" + (threads.length > shown.length ? " (hiển thị 20 phiên mới nhất)" : "") + "\n\n" +
          shown.map((t, i) => (i + 1) + ". **" + (t.title || "(không tiêu đề)") + "** — " + formatDateTime(t.created_at) +
            (t.thread_id === activeThreadId ? " _(đang mở)_" : "")).join("\n") +
          "\n\nGõ `/thread <số>` để mở lại một phiên, hoặc `/thread` để mở phiên gần nhất."
        );
        return;
      }

      case '/thread': {
        if (await historyBlocked()) return;
        const arg = args[0];
        let target = null;
        if (arg && /^\d+$/.test(arg)) {
          // Số thứ tự theo danh sách /history gần nhất (tự nạp nếu chưa gọi /history)
          const list = historyListRef.current.length ? historyListRef.current : await fetchThreadList();
          target = list[Number(arg) - 1] || null;
          if (!target) { replaceLastAssistant("⚠️ **[Không tìm thấy]:** Không có phiên số " + arg + ". Gõ `/history` để xem danh sách."); return; }
        } else if (arg) {
          target = { thread_id: arg, title: arg };  // Mã thread cụ thể (thread_...)
        } else {
          const list = await fetchThreadList();
          target = list[0] || null;
          if (!target) { replaceLastAssistant("🗂️ **[Khôi phục hội thoại]:** Chưa có hội thoại nào được lưu trong kho `" + storeName + "`."); return; }
        }
        await restoreThread(target);
        return;
      }

      case '/knowledge':
        replaceLastAssistant("📚 Đang mở trang **Quản trị Phân vùng Kho Tri thức**...");
        navigate('/knowledge');
        return;

      case '/analytics':
        if (userData.userRole !== 'admin') {
          replaceLastAssistant("⛔ **[Không có quyền]:** Giám sát Hệ thống chỉ dành cho Quản trị viên (vai trò `admin`).");
          return;
        }
        replaceLastAssistant("📊 Đang mở trang **Giám sát Hạ tầng & Hiệu năng AI Server**...");
        navigate('/analytics');
        return;

      case '/mcp':
        replaceLastAssistant("🔌 Đang mở trang **Tích hợp MCP (Model Context Protocol)**...");
        navigate('/mcp');
        return;

      case '/comm':
        replaceLastAssistant("💬 Đang mở trang **Trao đổi trực tuyến**...");
        navigate('/comm');
        return;

      case '/rag-sync': {
        if (!canManageActive) {
          replaceLastAssistant("⛔ **[Không đủ quyền]:** Vai trò `" + userData.userRole + "` chỉ được khai thác kho `" + storeName + "`, không được đồng bộ dữ liệu.");
          return;
        }
        const subdir = args.join(' ').trim();       // /rag-sync <thư mục con>: chỉ RAG thư mục đó
        replaceLastAssistant(syncProgressMessage(subdir));
        const result = await syncActiveCollection({ subdir });
        setMessages(prev => [...prev, { role: "assistant", content: result }]);
        return;
      }

      default:
        replaceLastAssistant(
          "❓ **[Lệnh không hợp lệ]:** `" + rawCmd + "`. Các lệnh nhanh được hỗ trợ:\n\n" +
          SLASH_COMMANDS.map(c => "* `" + c.cmd + "` — " + c.desc).join("\n")
        );
    }
  };


  const selectedColDetails = collections.find(c => c.storage_key === activeDomain) || collections[0] || {
    storage_key: "Personal",
    display_name: "Đang nạp...",
    collection_name: "personal_knowledge",
    file_count: 0,
    chunk_count: 0,
    storage_size: "0 Bytes"
  };

  // Quyền trên kho đang làm việc (activeDomain): 'manage' = xem, tải dữ liệu, đồng bộ RAG; 'read' = chỉ khai thác hội thoại
  const activeCollection = collections.find(c => c.storage_key === activeDomain);
  const activePermission = getStoragePermission(activeCollection, userData.userRole);
  const canManageActive = activePermission === 'manage';

  // Mở thanh bên và đưa con trỏ tới danh sách chọn Kho Tri thức (từ dòng trạng thái / thông báo chào mừng)
  const focusStorePicker = () => {
    setIsLeftSidebarOpen(true);
    setTimeout(() => document.getElementById('sidebar-store-select')?.focus(), 150);
  };

  // =========================================================================
  // GIAO DIỆN KẾT XUẤT CHÍNH (HTML CORES)
  // =========================================================================

  // Đăng xuất: báo Backend hủy PassTime, xóa phiên cục bộ và đưa mọi trạng thái về mặc định
  const handleLogout = async () => {
    try {
      // Gửi kèm JWT để Backend hủy đúng PassTime của chính chủ phiên trên OpenLDAP
      await iThunderAPI.logout();
    } catch (err) {
      console.error("Không thể thông báo hủy phiên tới Backend:", err);
    } finally {
      // 2. Xóa sạch dấu vết lưu trữ cục bộ trên trình duyệt vật lý
      localStorage.removeItem("tara_token");
      localStorage.removeItem("tara_user");
      notifyAuthChanged();   // đóng kết nối /ws/comm dùng chung, kết thúc cuộc gọi đang có
      // Giữ lại "tara_theme": đây là tùy chọn giao diện của máy trạm, không phải dữ liệu phiên

      // 3. Xóa sạch vùng nhớ đệm phiên (nếu có)
      sessionStorage.clear();

      // 4. Reset toàn bộ trạng thái dữ liệu trong bộ nhớ RAM của React về mặc định
      setPasscode('');
      setEmail('');
      setFullName('');
      setMessages([]);
      setCollections([]);
      setActiveThreadId(newThreadId());
      setUserData(GUEST_USER);

      // 5. Trục xuất người dùng về màn hình khóa trung tâm
      setViewState('LOGIN');
    }
  };

  // Tên Tổ chức hiển thị trong Workspace: theo AI Gateway; dự phòng bằng Tổ chức ghi trong phiên đăng nhập
  const workspaceOrgName = orgInfo.status === 'ok' ? orgInfo.orgName : (userData.userOrg || 'Chưa xác định Tổ chức');

  // =========================================================================
  // XỬ LÝ KHỐI CHỨC NĂNG: NHẬN PASSCODE QUA EMAIL (GET_CODE)
  // =========================================================================
  if (viewState === 'GET_CODE') {
    return (
      <GetCodeScreen
        email={email} errorMessage={errorMessage} isLoading={isLoading} orgInfo={orgInfo} setEmail={setEmail}
        setErrorMessage={setErrorMessage} setIsLoading={setIsLoading} setStatusMessage={setStatusMessage}
        setViewState={setViewState} statusMessage={statusMessage} />
    );
  }

  // =========================================================================
  // XỬ LÝ KHỐI CHỨC NĂNG: ĐĂNG KÝ TÀI KHOẢN MỚI (REGISTER)
  // =========================================================================
  if (viewState === 'REGISTER') {
    return (
      <RegisterScreen
        email={email} errorMessage={errorMessage} fullName={fullName} isLoading={isLoading} orgInfo={orgInfo} setEmail={setEmail}
        setErrorMessage={setErrorMessage} setFullName={setFullName} setIsLoading={setIsLoading}
        setStatusMessage={setStatusMessage} setViewState={setViewState} statusMessage={statusMessage} />
    );
  }

  // =========================================================================
  // XỬ LÝ KHỐI CHỨC NĂNG: XÁC THỰC PASSCODE  (LOGIN)
  // =========================================================================
  if (viewState === 'LOGIN') {
    return (
      <LoginScreen
        acceptJoinOffer={acceptJoinOffer} activeGateway={activeGateway} connectGateway={connectGateway}
        errorMessage={errorMessage} handlePasscodeSubmit={handlePasscodeSubmit} isLoading={isLoading} joinOffer={joinOffer}
        loadOrgInfo={loadOrgInfo} orgInfo={orgInfo} passcode={passcode} setErrorMessage={setErrorMessage}
        setJoinOffer={setJoinOffer} setPasscode={setPasscode} setViewState={setViewState} />
    );
  }

  if (viewState === 'FACEID') {
    return (
      <FaceIdScreen
        canvasRef={canvasRef} errorMessage={errorMessage} faceScanStopped={faceScanStopped} isFaceProcessing={isFaceProcessing}
        orgInfo={orgInfo} retryFaceScan={retryFaceScan} setErrorMessage={setErrorMessage} setFaceScanStopped={setFaceScanStopped}
        setViewState={setViewState} statusMessage={statusMessage} stopWebcamHardware={stopWebcamHardware} videoRef={videoRef} />
    );
  }

  return (
    <div className="w-screen h-app flex overflow-hidden bg-app text-fg font-sans antialiased selection:bg-blue-600/30">

      {/* Điện thoại: lớp nền mờ khi mở thanh bên, chạm để đóng */}
      {(isLeftSidebarOpen || isRightSidebarOpen) && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" aria-hidden="true"
          onClick={() => { setIsLeftSidebarOpen(false); setIsRightSidebarOpen(false); }} />
      )}

      {/* 1. THANH SIDEBAR TRÁI: QUẢN LÝ KHO TRI THỨC */}
      <LeftSidebar
        activeDomain={activeDomain} activeGateway={activeGateway} activeOther={activeOther}
        handleClosePublicCloud={handleClosePublicCloud} handleLogout={handleLogout} handleSelectDomain={handleSelectDomain}
        identityPermissions={identityPermissions} isLeftSidebarOpen={isLeftSidebarOpen} navigate={navigate} orgInfo={orgInfo}
        otherStores={otherStores} personalStore={personalStore} setShowPublicClouds={setShowPublicClouds} userData={userData}
        workspaceOrgName={workspaceOrgName} />

      {/* NÚT THU HẸP THANH TRÁI */}
      <div className="h-app flex items-center justify-center z-10 shrink-0 bg-app">
        <button 
          onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} 
          className="w-4 h-12 bg-panel hover:bg-hover border-y border-r border-line text-fg-muted hover:text-fg-strong flex items-center justify-center rounded-r-md shadow-md focus:outline-none"
        >
          {isLeftSidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      {/* 2. CỬA SỔ CHÍNH TRUNG TÂM */}
      {/* min-w-0: cho phép vùng giữa co lại, nội dung dài (tên tệp, văn bản) không đẩy RightSidebar ra ngoài màn hình */}
      <main className="flex-1 min-w-0 h-app flex flex-col justify-between bg-app">
        <ChatHeader
          activeCollection={activeCollection} chatModels={chatModels}
          focusStorePicker={focusStorePicker} isLeftSidebarOpen={isLeftSidebarOpen} modelGroups={modelGroups} modelKey={modelKey}
          modelLabel={modelLabel} orgInfo={orgInfo} refreshChatModels={refreshChatModels} selectedModel={selectedModel}
          selectedRuntime={selectedRuntime} selectModel={selectModel} setIsLeftSidebarOpen={setIsLeftSidebarOpen}
          setTheme={setTheme} theme={theme} workspaceOrgName={workspaceOrgName} />

        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 flex justify-center custom-scrollbar">
          <div className="w-full min-w-0 flex flex-col gap-4">

            {viewer ? (
              // TRÌNH XEM TẬP TIN KHO DỮ LIỆU (thay khung hội thoại cho đến khi đóng hoặc gửi câu hỏi mới)
              <FileViewer
                canManageActive={canManageActive} closeViewer={closeViewer} dataBusyPath={dataBusyPath}
                deleteOneDataFile={deleteOneDataFile} downloadDataFile={downloadDataFile} selectedColDetails={selectedColDetails}
                syncOneDataFile={syncOneDataFile} viewer={viewer} />
            ) : (<>
            <StoreIntroCard
              activeCollection={activeCollection} canManageActive={canManageActive}
              focusStorePicker={focusStorePicker} storeList={storeList} workspaceOrgName={workspaceOrgName} />

            <ChatMessages
              isLoading={isLoading} messages={messages} messagesEndRef={messagesEndRef} userData={userData} />
            </>)}
          </div>
        </div>

        <Composer
          canManageActive={canManageActive} fileInputRef={fileInputRef} filteredCommands={filteredCommands}
          handleFileUpload={handleFileUpload} handleInputChange={handleInputChange} handleInputKeyDown={handleInputKeyDown}
          handleSendPrompt={handleSendPrompt} inputPrompt={inputPrompt} promptInputRef={promptInputRef}
          selectCommand={selectCommand} selectedCmdIndex={selectedCmdIndex} showSlashMenu={showSlashMenu} />
      </main>

      {/* NÚT THU HẸP THANH PHẢI */}
      <div className="h-app flex items-center justify-center z-10 shrink-0 bg-app">
        <button 
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} 
          className="w-4 h-12 bg-panel hover:bg-hover border-y border-l border-line text-fg-muted hover:text-fg-strong flex items-center justify-center rounded-l-md shadow-md focus:outline-none"
        >
          {isRightSidebarOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* 3. THANH SIDEBAR PHẢI: QUẢN TRỊ VÀ PHÂN QUYỀN TRỰC QUAN */}
      <RightSidebar
        activePermission={activePermission} autoSyncUpload={autoSyncUpload} canManageActive={canManageActive}
        dataBusyPath={dataBusyPath} dataCrumbs={dataCrumbs} dataFileInputRef={dataFileInputRef} dataFiles={dataFiles}
        dataFilesError={dataFilesError} dataFilesLoading={dataFilesLoading} dataFilter={dataFilter} dataFolders={dataFolders}
        dataNotice={dataNotice} dataSubdir={dataSubdir} deleteOneDataFile={deleteOneDataFile}
        isRightSidebarOpen={isRightSidebarOpen} openDataFile={openDataFile} openDataFolder={openDataFolder}
        ragListError={ragListError} ragOnlyFiles={ragOnlyFiles} refreshDataFiles={refreshDataFiles}
        removeRagChunks={removeRagChunks} runFolderSync={runFolderSync} selectedColDetails={selectedColDetails}
        setAutoSyncUpload={setAutoSyncUpload} setDataFilter={setDataFilter} setSyncForce={setSyncForce} syncForce={syncForce}
        syncOneDataFile={syncOneDataFile} syncRunning={syncRunning} uploadDataFiles={uploadDataFiles} viewer={viewer}
        visibleDataFiles={visibleDataFiles} visibleDataFolders={visibleDataFolders} visibleRagOnly={visibleRagOnly} />

      {showPublicClouds && (
        <PublicCloudsDialog
          openedKeys={collections.filter(c => c.opened || c.scope === 'cloud').map(c => c.storage_key)}
          onOpen={(col, maxOpened) => collections.some(c => c.storage_key === col.storage_key)
            ? (setShowPublicClouds(false), handleSelectDomain(col)) : handleOpenPublicCloud(col, maxOpened)}
          onClose={() => setShowPublicClouds(false)} />
      )}
    </div>
  );
}

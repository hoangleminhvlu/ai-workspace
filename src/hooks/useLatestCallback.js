/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.09.27)
 * Hook trả về một hàm ổn định (không đổi giữa các lần render) nhưng luôn gọi phiên bản mới nhất của `fn`.
 *
 * Dùng cho useEffect chỉ muốn chạy khi một vài giá trị thay đổi (vd. viewState, activeDomain) nhưng bên trong
 * gọi các hàm đọc state mới nhất: khai báo đủ phụ thuộc theo react-hooks/exhaustive-deps mà effect không bị
 * chạy lại mỗi lần render (tương tự useEffectEvent của React 19.2).
 */

import { useCallback, useLayoutEffect, useRef } from 'react';

export default function useLatestCallback(fn) {
  const fnRef = useRef(fn);
  // useLayoutEffect chạy trước mọi useEffect của cùng lần render, nên effect luôn gọi đúng phiên bản mới nhất
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  return useCallback((...args) => fnRef.current(...args), []);
}

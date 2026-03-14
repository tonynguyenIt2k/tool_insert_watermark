
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const baseName = (name) => name.replace(/\.[^.]+$/, '');
const quality12ToCanvasQ = (q12) => clamp(q12 / 12, 0.08, 1);
const isImage = (f) => /^image\//.test(f.type) || /\.heic$/i.test(f.name) || /\.heif$/i.test(f.name);
const isHeic = (f) => /\.heic$/i.test(f.name) || /\.heif$/i.test(f.name) || f.type === 'image/heic' || f.type === 'image/heif';

// State (Global)
let mode = "none";
let folderInfo = null;
let items = [];
let wmImg = null, logoImg = null;
let processing = false;

// Firebase Initialization
const firebaseConfig = {
    apiKey: "AIzaSyBnI9k12C4yq0h9_-ek4wLFPCUWK9dgWUE",
    authDomain: "nhatot24h-84173.firebaseapp.com",
    projectId: "nhatot24h-84173",
    storageBucket: "nhatot24h-84173.firebasestorage.app",
    messagingSenderId: "618857393712",
    appId: "1:618857393712:web:813612e08aa283fa3247f5",
    databaseURL: "https://nhatot24h-84173-default-rtdb.firebaseio.com"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;
let isApplyingRemoteSettings = false; // Flag to prevent infinite sync loops

// Convert HEIC to JPG using heic2any library
async function convertHeicToJpg(file) {
    if (!isHeic(file)) return file;

    try {
        const blob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.92
        });
        // heic2any may return array or single blob
        const jpgBlob = Array.isArray(blob) ? blob[0] : blob;
        // Create a new File object with .jpg extension
        const newName = baseName(file.name) + '.jpg';
        return new File([jpgBlob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
    } catch (err) {
        console.error('HEIC conversion failed:', err);
        throw new Error(`Không thể chuyển đổi HEIC: ${file.name}`);
    }
}

/* ================= I18N ================= */
const I18N = {
    vi: {
        title: "Batch Ảnh 1:1 • Blur nền • Watermark • Logo + Glass Plate",
        subtitle: `
        <span class="ms xs">upload</span><span>Preview ảnh gốc</span>
        <span class="ms xs">arrow_forward</span><span>Xử lý</span>
        <span class="ms xs">arrow_forward</span><span>Preview kết quả</span>
        <span class="ms xs">download</span><span>Tải 1 hoặc tải nhiều bằng tick</span>
    `,
        theme: "Giao diện",
        settings: "Cài đặt",
        clear: "Xoá",
        process: "Xử lý",
        input_title: "Ảnh gốc",
        input_desc: `Chọn nhiều lần để cộng dồn ảnh. Nếu chọn thư mục → chỉ hiện icon thư mục + tên + số lượng ảnh.`,
        drop_title: "Kéo thả ảnh vào đây",
        drop_desc: "Chrome/Edge hỗ trợ chọn thư mục (webkitdirectory).",
        pick_files: "Chọn nhiều ảnh (cộng dồn)",
        pick_folder: "Chọn thư mục ảnh (Chrome/Edge)",
        pick_folder_btn: "Chọn thư mục…",
        hint_remove: `Nút <span class="ms xs">close</span> chỉ hiện khi ở chế độ ảnh lẻ (preview thumbnails).`,
        count: "Ảnh",
        mode: "Chế độ",
        tips_title: "Gợi ý nhanh",
        tips_desc: "Mở <b>Cài đặt</b> để đổi Logo/Watermark, format và thông số.",
        tip1_title: "PNG nét • JPG nhẹ",
        tip1_desc: "PNG giữ chi tiết, JPG giảm dung lượng (Quality 1–12).",
        tip2_title: "Watermark tự co giãn",
        tip2_desc: "Luôn scale theo <b>OUT_SIZE</b>, không cần đúng 1080×1080.",
        tip3_title: "File mặc định",
        tip4_title: "Quy trình chuẩn",
        tip4_desc: "Upload → (tuỳ chọn) Cài đặt → Xử lý → Tải lẻ / Tải chọn / ZIP.",
        out_title: "Kết quả",
        out_desc: "Chỉ hiện ảnh kết quả sau khi xử lý. Có tải lẻ / tải đã chọn / ZIP.",
        ready: "Sẵn sàng",
        select_all: "Chọn tất",
        unselect_all: "Bỏ chọn",
        download_selected: "Tải đã chọn",
        download_zip: "Tải tất cả (ZIP)",
        no_result: "Chưa có kết quả. Bấm “Xử lý” để tạo ảnh.",
        bottom_hint: "Chọn ảnh → (tùy chọn) mở Cài đặt chọn watermark/logo → bấm Xử lý. Nếu không chọn sẽ dùng mặc định assets.",
        dock_upload: "Upload",
        dock_settings: "Cài đặt",
        dock_process: "Xử lý",
        ui_lang: "Giao diện & Ngôn ngữ",
        theme_mode: "Chế độ giao diện",
        theme_hint: "Lưu vào máy. Load lại không bị nháy giao diện.",
        language: "Ngôn ngữ",
        preset: "Preset nhanh",
        blur_soft: "Blur mềm",
        blur_strong: "Blur mạnh",
        wm_logo: "Watermark & Logo",
        enable_wm: "Chèn Watermark",
        enable_logo: "Chèn Logo",
        wm_file: "Watermark PNG overlay",
        logo_file: "Logo PNG",
        wm_scale_hint: "Watermark đã tự scale theo OUT_SIZE (không còn phụ thuộc 1080×1080).",
        out_format: "Định dạng xuất",
        jpg_quality: "JPG_QUALITY (1–12) — chỉ dùng khi JPG",
        zip_name: "Tên ZIP (tải tất cả)",
        format_hint: "PNG nét hơn, JPG nhẹ hơn.",
        blur_bg: "Blur nền",
        blur_fix: "Đã fix “viền mở rộng chưa blur”: nền blur được vẽ lớn hơn theo BG_BLUR nên không hở viền.",
        glass_plate: "Glass Plate sau logo",
        save_close: "Lưu & Đóng",
        esc_hint: "Nhấn <b>ESC</b> để đóng. Chạm nền tối để đóng.",
        status_need_images: "Thiếu dữ liệu: cần ảnh.",
        status_load_assets: "Đang load watermark + logo…",
        status_start: "Bắt đầu xử lý…",
        status_zip: "Đang đóng gói ZIP…",
        status_done: (n) => `Xử lý xong ${n} ảnh.`,
        status_err: (m) => `Lỗi: ${m}`,
        snack_saved: "Đã lưu cài đặt.",
        snack_cleared: "Đã xoá.",
        snack_removed: "Đã xoá ảnh khỏi danh sách.",
        snack_invalid: "Không có ảnh hợp lệ.",
        snack_drag_err: "Không đọc được dữ liệu kéo thả.",
        snack_done: "Hoàn tất xử lý.",
        snack_downloaded: (name) => `Đã tải ${name}`,
        snack_selected_none: "Chưa chọn ảnh nào.",
        snack_folder: (name, n) => `Đã chọn thư mục: ${name} (${n} ảnh)`,
        snack_added: (added, total) => `Đã thêm ${added} ảnh. Tổng: ${total}`,
        snack_converting_heic: "Đang chuyển đổi ảnh HEIC...",
        snack_heic_done: (n) => `Đã chuyển đổi ${n} ảnh HEIC sang JPG.`,
        preset_1080: "Đã áp dụng preset 1080.",
        preset_2000: "Đã áp dụng preset 2000.",
        preset_1350: "Đã áp dụng preset 1350.",
        blur_softer: "Blur mềm hơn.",
        blur_stronger: "Blur mạnh hơn.",
        download_one: "Tải ảnh",
        result_tag: "Ảnh kết quả",
        choose: "Chọn",
        download_selected_zip: "Tải đã chọn (ZIP)",

        confirm_title: "Xác nhận truy cập thư mục",
        confirm_subtitle: "Trình duyệt sẽ hỏi quyền đọc file",
        confirm_desc: "Khi bạn chọn thư mục, Chrome/Edge sẽ hiện hộp thoại bảo mật để xác nhận cho phép website đọc các ảnh trong thư mục đó. Đây là cơ chế bắt buộc của trình duyệt và không thể thay thế/ẩn đi.",
        confirm_tip: "Tip: Nếu bạn không muốn thấy bước này, hãy chọn ảnh lẻ (multi-file) hoặc kéo thả ảnh vào vùng Upload.",
        confirm_cancel: "Huỷ",
        confirm_continue: "Tiếp tục",
        confirm_esc: "Nhấn <b>ESC</b> để đóng.",
        login: "Đăng nhập",
        logout: "Đăng xuất"
    },
    en: {
        title: "Batch 1:1 • Blurred BG • Watermark • Logo + Glass Plate",
        subtitle: `
        <span class="ms xs">upload</span><span>Preview input</span>
        <span class="ms xs">arrow_forward</span><span>Process</span>
        <span class="ms xs">arrow_forward</span><span>Preview output</span>
        <span class="ms xs">download</span><span>Download single or multi</span>
    `,
        theme: "Theme",
        settings: "Settings",
        clear: "Clear",
        process: "Process",
        input_title: "Input photos",
        input_desc: `Pick multiple times to append. If you pick a folder → show folder icon + name + count only.
        <br><b>Default:</b> logo + watermark from <code>./assets/logo/logo.png</code> and <code>./assets/watermark/watermark.png</code>.`,
        drop_title: "Drag & drop images here",
        drop_desc: "Chrome/Edge supports folder picker (webkitdirectory).",
        pick_files: "Pick images (append)",
        pick_folder: "Pick folder (Chrome/Edge)",
        pick_folder_btn: "Choose folder…",
        hint_remove: `Remove <span class="ms xs">close</span> button appears only in files mode (thumbnails).`,
        count: "Images",
        mode: "Mode",
        tips_title: "Quick tips",
        tips_desc: "Open <b>Settings</b> to change Logo/Watermark, format and params.",
        tip1_title: "PNG sharp • JPG light",
        tip1_desc: "PNG keeps details, JPG reduces size (Quality 1–12).",
        tip2_title: "Auto-scale watermark",
        tip2_desc: "Always scales with <b>OUT_SIZE</b>, no need exactly 1080×1080.",
        tip3_title: "Default files",
        tip4_title: "Workflow",
        tip4_desc: "Upload → (optional) Settings → Process → Download single / selected / ZIP.",
        out_title: "Result",
        out_desc: "Results appear after processing. Download single / selected / ZIP.",
        ready: "Ready",
        select_all: "Select all",
        unselect_all: "Unselect",
        download_selected: "Download selected",
        download_zip: "Download all (ZIP)",
        no_result: "No results yet. Click “Process” to generate.",
        bottom_hint: "Pick images → (optional) Settings → Process. If not set, defaults from assets will be used.",
        dock_upload: "Upload",
        dock_settings: "Settings",
        dock_process: "Process",
        ui_lang: "UI & Language",
        theme_mode: "Theme mode",
        theme_hint: "Saved locally. Reload without flicker.",
        language: "Language",
        preset: "Quick presets",
        blur_soft: "Softer blur",
        blur_strong: "Stronger blur",
        wm_logo: "Watermark & Logo",
        enable_wm: "Add Watermark",
        enable_logo: "Add Logo",
        wm_file: "Watermark PNG overlay",
        logo_file: "Logo PNG",
        wm_scale_hint: "Watermark auto-scales with OUT_SIZE (not bound to 1080×1080).",
        out_format: "Output format",
        jpg_quality: "JPG_QUALITY (1–12) — for JPG only",
        zip_name: "ZIP name (download all)",
        format_hint: "PNG is sharper, JPG is smaller.",
        blur_bg: "Background blur",
        blur_fix: "Fixed blur edge: background is drawn larger by BG_BLUR so no border gaps.",
        glass_plate: "Glass plate behind logo",
        save_close: "Save & Close",
        esc_hint: "Press <b>ESC</b> to close. Tap backdrop to close.",
        status_need_images: "Missing input: please add images.",
        status_load_assets: "Loading watermark + logo…",
        status_start: "Processing…",
        status_zip: "Packing ZIP…",
        status_done: (n) => `Done: ${n} images.`,
        status_err: (m) => `Error: ${m}`,
        snack_saved: "Saved.",
        snack_cleared: "Cleared.",
        snack_removed: "Removed from list.",
        snack_invalid: "No valid images.",
        snack_drag_err: "Cannot read dropped files.",
        snack_done: "Processing completed.",
        snack_downloaded: (name) => `Downloaded ${name}`,
        snack_selected_none: "No images selected.",
        snack_folder: (name, n) => `Folder selected: ${name} (${n})`,
        snack_added: (added, total) => `Added ${added}. Total: ${total}`,
        snack_converting_heic: "Converting HEIC images...",
        snack_heic_done: (n) => `Converted ${n} HEIC images to JPG.`,
        preset_1080: "Preset 1080 applied.",
        preset_2000: "Preset 2000 applied.",
        preset_1350: "Preset 1350 applied.",
        blur_softer: "Softer blur applied.",
        blur_stronger: "Stronger blur applied.",
        download_one: "Download",
        result_tag: "Output",
        choose: "Select",
        download_selected_zip: "Download selected (ZIP)",

        confirm_title: "Confirm folder access",
        confirm_subtitle: "Browser will ask permission",
        confirm_desc: "When you choose a folder, Chrome/Edge will show a security confirmation to allow this website to read images inside that folder. This prompt is enforced by the browser and cannot be replaced/hidden by the website.",
        confirm_tip: "Tip: If you don’t want to see this step, use multi-file picker or drag & drop images.",
        confirm_cancel: "Cancel",
        confirm_continue: "Continue",
        confirm_esc: "Press <b>ESC</b> to close.",
        login: "Login",
        logout: "Logout"
    }
};

function getLang() { return document.documentElement.getAttribute("lang") || "vi"; }
function t(key, arg) {
    const dict = I18N[getLang()] || I18N.vi;
    const v = dict[key];
    return (typeof v === "function") ? v(arg) : (v ?? key);
}

function applyLang() {
    const dict = I18N[getLang()] || I18N.vi;
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const k = el.getAttribute("data-i18n");
        const v = dict[k];
        if (typeof v === "string") {
            if (k === "subtitle" || k === "input_desc" || k === "hint_remove" || k === "confirm_desc" || k === "confirm_tip" || k === "confirm_esc") el.innerHTML = v;
            else el.innerHTML = v;
        }
    });
    $("langLabel").textContent = getLang().toUpperCase();
    $("btnDownloadSelected").querySelector("span:last-child").textContent =
        (I18N[getLang()]?.download_selected_zip) || t("download_selected");
}

/* ================= THEME ================= */
function getTheme() { return document.documentElement.getAttribute("data-theme") || "auto"; }
function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch (e) { }
    updateThemeUI();
}
function cycleTheme() {
    const cur = getTheme();
    const next = cur === "auto" ? "dark" : cur === "dark" ? "light" : "auto";
    setTheme(next);
    snack(`${t("theme")}: ${next.toUpperCase()}`, "ok");
}
function updateThemeUI() {
    const theme = getTheme();
    const icon = theme === "dark" ? "dark_mode" : theme === "light" ? "light_mode" : "brightness_auto";
    $("themeIcon").textContent = icon;
    document.querySelectorAll("[data-theme-pick]").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-theme-pick") === theme);
    });
}

function setLang(lang) {
    document.documentElement.setAttribute("lang", lang);
    try { localStorage.setItem("lang", lang); } catch (e) { }
    applyLang();
    updateLangUI();
}
function toggleLang() {
    const cur = getLang();
    setLang(cur === "vi" ? "en" : "vi");
    snack(`Language: ${getLang().toUpperCase()}`, "ok");
}
function updateLangUI() {
    const lang = getLang();
    $("langLabel").textContent = lang.toUpperCase();
    document.querySelectorAll("[data-lang-pick]").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-lang-pick") === lang);
    });
}

/* ============== UI helpers ============== */
function setStatus(text, icon = "info") {
    $("status").innerHTML = `<span class="ms xs">${icon}</span><span>${text}</span>`;
}
function setProgress(pct) { $("bar").style.width = `${clamp(pct, 0, 100).toFixed(1)}%`; }

function snack(msg, type = "info") {
    const icon = type === "ok" ? "check_circle" : type === "err" ? "error" : type === "warn" ? "warning" : "info";
    $("snackMsg").innerHTML = `<span class="ms sm">${icon}</span><span>${msg}</span>`;
    const el = $("snack");
    el.classList.add("show");
    clearTimeout(snack._t);
    snack._t = setTimeout(() => el.classList.remove("show"), 2600);
}
$("snackClose").addEventListener("click", () => $("snack").classList.remove("show"));

/* ============== Safari-safe download ============== */
function isSafari() {
    const ua = navigator.userAgent;
    return /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
}
function downloadBlob(blob, filename) {
    try {
        if (typeof saveAs === "function" && !isSafari()) {
            saveAs(blob, filename);
            return;
        }
    } catch (e) { }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
    }, 500);
}

/* ============== Robust image decode (Safari-friendly) ============== */
async function decodeToCanvasImageSourceFromBlob(blob) {
    // Safari has bugs with createImageBitmap + drawImage + filter (tiling artifacts).
    // Force use of <img> fallback for Safari.
    if (typeof createImageBitmap === "function" && !isSafari()) {
        try {
            return await createImageBitmap(blob, { imageOrientation: "from-image" });
        } catch (e1) {
            try { return await createImageBitmap(blob); } catch (e2) { }
        }
    }
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Image decode failed"));
        });
        return img;
    } finally {
        // keep; will revoke after draw if blob url
    }
}

async function fileToImageSource(file) {
    const blob = await file.slice(0, file.size, file.type);
    return await decodeToCanvasImageSourceFromBlob(blob);
}

async function urlToImageSource(url) {
    // If URL is from R2 bucket, proxy through our CORS-enabled worker
    const proxiedUrl = proxyR2Url(url);

    // Strategy 1: fetch (works on http/https)
    try {
        const res = await fetch(proxiedUrl);
        if (res.ok) {
            const blob = await res.blob();
            return await decodeToCanvasImageSourceFromBlob(blob);
        }
    } catch (e) { /* fetch blocked on file:// */ }

    // Strategy 2: XMLHttpRequest (works on file:// in most browsers)
    try {
        const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', proxiedUrl, true);
            xhr.responseType = 'blob';
            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 0) {
                    resolve(xhr.response);
                } else {
                    reject(new Error("XHR status " + xhr.status));
                }
            };
            xhr.onerror = () => reject(new Error("XHR error"));
            xhr.send();
        });
        return await decodeToCanvasImageSourceFromBlob(blob);
    } catch (e) { /* XHR also blocked */ }

    // Strategy 3: Load as <img>, re-encode via canvas to get clean blob
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = proxiedUrl;
    await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Không load được: " + url));
    });

    // Try to re-encode to avoid taint
    try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        if (blob) return await decodeToCanvasImageSourceFromBlob(blob);
    } catch (e) { /* canvas tainted, fall through */ }

    // Last resort: return img directly (may taint canvas)
    return img;
}

/**
 * Proxy R2 public URLs through the Cloudflare Worker to add CORS headers.
 * Non-R2 URLs are returned unchanged.
 */
function proxyR2Url(url) {
    const R2_HOST = "pub-f5b4cee090744ed2b73828a7e619786a.r2.dev";
    try {
        const parsed = new URL(url);
        if (parsed.host === R2_HOST) {
            return `https://r2-uploader.insertwatermark.workers.dev/proxy?url=${encodeURIComponent(url)}`;
        }
    } catch (e) { /* not a valid URL, return as-is */ }
    return url;
}

const DEFAULT_WM_URL = (typeof DEFAULT_WM_B64 !== 'undefined') ? DEFAULT_WM_B64 : "./assets/watermark/watermark.png";
const DEFAULT_LOGO_URL = (typeof DEFAULT_LOGO_B64 !== 'undefined') ? DEFAULT_LOGO_B64 : "./assets/logo/logo.png";

function canvasToBlob(canvas, format, quality) {
    return new Promise((resolve, reject) => {
        try {
            if (format === "png") {
                canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png");
            } else {
                canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob failed")), "image/jpeg", quality);
            }
        } catch (e) { reject(e); }
    });
}

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function renderOne({
    src, wm, logo,
    OUT_SIZE, BG_BLUR, BG_SCALE,
    WM_POSITION = 'full', WM_TARGET_W = 300,
    LOGO_TARGET_W, LOGO_MARGIN,
    LOGO_PLATE_PADDING, LOGO_PLATE_BLUR,
    LOGO_PLATE_OPACITY, LOGO_PLATE_COLOR,
    LOGO_POSITION,
    ENABLE_PLATE = true,
    WM_OPACITY,
    textConfig
}) {
    const w = src.width, h = src.height;
    const size = Math.max(w, h);

    const sq = document.createElement("canvas");
    sq.width = size; sq.height = size;
    const sctx = sq.getContext("2d", { alpha: false });

    sctx.fillStyle = "rgba(0,0,0,1)";
    sctx.fillRect(0, 0, size, size);

    const pad = 0; // Removed extra padding
    const cover = Math.max(size / w, size / h) * (BG_SCALE / 100);
    const bw = w * cover, bh = h * cover;
    const bx = (size - bw) / 2, by = (size - bh) / 2;

    sctx.save();
    if (isSafari() && BG_BLUR > 0) {
        sctx.drawImage(src, bx, by, bw, bh);
        try {
            stackBlurCanvasRGB(sctx, 0, 0, size, size, BG_BLUR);
        } catch (e) { console.warn("Blur failed", e); }
    } else {
        sctx.filter = `blur(${BG_BLUR}px)`;
        sctx.drawImage(src, bx, by, bw, bh);
    }
    sctx.restore();

    const mx = (size - w) / 2, my = (size - h) / 2;
    sctx.drawImage(src, mx, my, w, h);

    const out = document.createElement("canvas");
    out.width = OUT_SIZE; out.height = OUT_SIZE;
    const octx = out.getContext("2d");

    octx.drawImage(sq, 0, 0, OUT_SIZE, OUT_SIZE);

    if (wm) {
        octx.save();
        octx.globalAlpha = clamp(WM_OPACITY, 0, 100) / 100;
        if (WM_POSITION === 'full') {
            octx.drawImage(wm, 0, 0, OUT_SIZE, OUT_SIZE);
        } else {
            const wmAspect = wm.width / wm.height;
            const wmW = WM_TARGET_W;
            const wmH = wmW / wmAspect;
            let wx = 0, wy = 0;
            const m = LOGO_MARGIN || 28;
            if (WM_POSITION === 'custom') {
                wx = (+document.getElementById('WM_X').value || 0) * OUT_SIZE;
                wy = (+document.getElementById('WM_Y').value || 0) * OUT_SIZE;
            } else if (WM_POSITION === 'TL') { wx = m; wy = m; }
            else if (WM_POSITION === 'TR') { wx = OUT_SIZE - wmW - m; wy = m; }
            else if (WM_POSITION === 'BL') { wx = m; wy = OUT_SIZE - wmH - m; }
            else if (WM_POSITION === 'BR') { wx = OUT_SIZE - wmW - m; wy = OUT_SIZE - wmH - m; }
            else if (WM_POSITION === 'center') { wx = (OUT_SIZE - wmW) / 2; wy = (OUT_SIZE - wmH) / 2; }
            octx.drawImage(wm, wx, wy, wmW, wmH);
        }
        octx.restore();
    }

    if (textConfig && textConfig.enabled && textConfig.text) {
        octx.save();
        octx.globalAlpha = textConfig.opacity / 100;
        octx.fillStyle = textConfig.color === "white" ? "white" : textConfig.color === "red" ? "red" : textConfig.color === "blue" ? "blue" : "black";
        octx.font = `${textConfig.weight} ${textConfig.size}px '${textConfig.font}', sans-serif`;
        octx.textBaseline = "middle";

        const txt = textConfig.text + "   ";
        const tw = octx.measureText(txt).width;
        if (tw > 0) {
            const cols = Math.ceil(OUT_SIZE / tw) + 1;
            const rows = textConfig.repeats;
            const RowH = textConfig.size * 1.5;
            const totalH = rows * RowH;

            let startY;
            if (WM_POSITION === 'custom') {
                // Custom position: use WM_Y offset
                const wmY = (+document.getElementById('WM_Y').value || 0) * OUT_SIZE;
                startY = wmY + (RowH / 2);
            } else {
                // Default: bottom of image
                startY = OUT_SIZE - totalH + (RowH / 2) - (RowH * 0.2);
            }

            for (let r = 0; r < rows; r++) {
                const y = startY + (r * RowH);
                const offset = r % 2 === 0 ? 0 : -(tw / 2);

                for (let c = 0; c < cols; c++) {
                    octx.fillText(txt, offset + (c * tw), y);
                }
            }
        }
        octx.restore();
    }

    if (logo) {
        const scale = LOGO_TARGET_W / logo.width;
        const lw = logo.width * scale;
        const lh = logo.height * scale;

        let lx = LOGO_MARGIN;
        let ly = LOGO_MARGIN;

        // Position Logic
        const pos = LOGO_POSITION || "TL";
        if (pos === "custom") { // Custom logic
            // Directly read from hidden inputs
            const customX = +$("LOGO_X").value || 0;
            const customY = +$("LOGO_Y").value || 0;
            // Use values if they exist (even if 0)
            lx = customX * OUT_SIZE;
            ly = customY * OUT_SIZE;
        } else if (pos === "TR") {
            lx = OUT_SIZE - lw - LOGO_MARGIN;
            ly = LOGO_MARGIN;
        } else if (pos === "BL") {
            lx = LOGO_MARGIN;
            ly = OUT_SIZE - lh - LOGO_MARGIN;
        } else if (pos === "BR") {
            lx = OUT_SIZE - lw - LOGO_MARGIN;
            ly = OUT_SIZE - lh - LOGO_MARGIN;
        } else if (pos === "center") {
            lx = (OUT_SIZE - lw) / 2;
            ly = (OUT_SIZE - lh) / 2;
        }

        // Glass Plate (only if enabled)
        if (ENABLE_PLATE) {
            const pad2 = LOGO_PLATE_PADDING;
            const pl = clamp(lx - pad2, 0, OUT_SIZE);
            const pt = clamp(ly - pad2, 0, OUT_SIZE);
            const pr = clamp(lx + lw + pad2, 0, OUT_SIZE);
            const pb = clamp(ly + lh + pad2, 0, OUT_SIZE);
            const pw = pr - pl, ph = pb - pt;

            octx.save();
            octx.globalAlpha = clamp(LOGO_PLATE_OPACITY, 0, 100) / 100;
            octx.filter = `blur(${LOGO_PLATE_BLUR}px)`;
            octx.fillStyle = (LOGO_PLATE_COLOR === "white") ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)";
            roundRect(octx, pl, pt, pw, ph, 18);
            octx.fill();
            octx.restore();
        }

        octx.drawImage(logo, lx, ly, lw, lh);
    }

    return out;
}

/* ===== Interactive Preview State ===== */
let isDraggingLogo = false;
let isResizingLogo = false;
let dragStartX, dragStartY;
let initialLogoLeft, initialLogoTop;
let initialLogoW, initialLogoH;
let previewScale = 1; // ratio of preview image width / actual OUT_SIZE

function isPreviewOpen() {
    return $("previewModal").classList.contains("show");
}

async function openInteractivePreview() {
    if (!items.length) {
        snack((I18N[getLang()] || I18N.vi).no_input || "Chưa chọn ảnh nào", "warn");
        return;
    }

    try {
    // Load assets first (logo/watermark) if not already loaded
    await loadAssets();
    } catch (err) {
        console.error("loadAssets error:", err);
        snack("Lỗi tải assets: " + (err?.message || String(err)), "err");
        return;
    }

    // Get first item
    const it = items[0];
    const src = await fileToImageSource(it.file);

    // Load config
    const OUT_SIZE = +$("OUT_SIZE").value || 2000;
    const BG_BLUR = +$("BG_BLUR").value || 45;
    const BG_SCALE = +$("BG_SCALE").value || 115;
    const WM_OPACITY = clamp(+$("WM_OPACITY").value || 100, 0, 100);
    const LOGO_TARGET_W = +$("LOGO_TARGET_W").value || 160;
    const LOGO_MARGIN = +$("LOGO_MARGIN").value || 28;
    const LOGO_PLATE_PADDING = +$("LOGO_PLATE_PADDING").value || 14;
    const LOGO_PLATE_BLUR = clamp(+$("LOGO_PLATE_BLUR").value || 18, 0, 120);
    const LOGO_PLATE_OPACITY = clamp(+$("LOGO_PLATE_OPACITY").value || 40, 0, 100);
    const LOGO_PLATE_COLOR = $("LOGO_PLATE_COLOR").value || "black";
    let LOGO_POSITION = $("LOGO_POSITION").value || "TL";

    const enableTextWM = $("enableTextWM").checked;
    const textConfig = {
        enabled: enableTextWM,
        text: $("wmText").value || "",
        size: clamp(+$("wmTextSize").value || 60, 10, 500),
        opacity: clamp(+$("wmTextOpacity").value || 30, 0, 100),
        color: $("wmTextColor").value || "black",
        repeats: clamp(+$("wmTextRepeats").value || 3, 1, 10),
        font: $("wmTextFont").value || "Inter",
        weight: $("wmTextWeight").value || "300"
    };

    const WM_POS = $("WM_POSITION").value || "full";
    const WM_TARGET_W_VAL = clamp(+$("WM_TARGET_W").value || 300, 40, 4000);
    const wmEnabled = wmImg && $("enableWatermark").checked;

    // 1. Render Background (No Logo, no watermark — watermark shown as overlay)
    // When text WM is enabled, don't bake it into background — show as overlay
    const previewTextConfig = enableTextWM ? { ...textConfig, enabled: false } : textConfig;
    const bgCanvas = renderOne({
        src,
        wm: null, // Never bake image watermark into bg for preview — show as overlay
        logo: null,
        OUT_SIZE, BG_BLUR, BG_SCALE,
        WM_POSITION: WM_POS,
        WM_TARGET_W: WM_TARGET_W_VAL,
        LOGO_TARGET_W, LOGO_MARGIN, LOGO_PLATE_PADDING, LOGO_PLATE_BLUR, LOGO_PLATE_OPACITY, LOGO_PLATE_COLOR,
        ENABLE_PLATE: $("enablePlate").checked,
        WM_OPACITY, textConfig: previewTextConfig
    });

    // 2. Setup Preview Modal
    const modal = $("previewModal");
    const imgParam = $("previewImg");
    const logoDiv = $("previewLogo");
    const logoImgEl = $("previewLogoImg");
    const wmDiv = $("previewWatermark");
    const wmImgEl = $("previewWmImg");

    modal.classList.add("show");
    $("previewCaption").textContent = "Preview: " + it.name + " (Kéo logo/watermark để chỉnh vị trí)";
    const btnConfirm = $("btnConfirmPreview");
    if (btnConfirm) btnConfirm.style.display = "inline-flex";

    // Set background
    const format = $("OUT_FORMAT").value || "jpg";
    const mime = format === "png" ? "image/png" : "image/jpeg";
    const quality = +$("JPG_QUALITY").value || 0.92;
    imgParam.src = bgCanvas.toDataURL(mime, quality);

    // 3. Setup Logo Overlay
    if (logoImg && $("enableLogo").checked) {
        logoDiv.style.display = "block";

        const logoFile = $("inLogo").files[0];
        if (logoFile) {
            logoImgEl.src = URL.createObjectURL(logoFile);
        } else if (window.customLogoDataURL) {
            logoImgEl.src = proxyR2Url(window.customLogoDataURL);
        } else {
            logoImgEl.src = DEFAULT_LOGO_URL;
        }

        const logoAspect = logoImg.width / logoImg.height;
        const curLogoW = LOGO_TARGET_W;
        const curLogoH = curLogoW / logoAspect;

        let lx, ly;
        if (LOGO_POSITION === "custom") {
            lx = (+$("LOGO_X").value || 0) * OUT_SIZE;
            ly = (+$("LOGO_Y").value || 0) * OUT_SIZE;
        } else if (LOGO_POSITION === "TR") {
            lx = OUT_SIZE - curLogoW - LOGO_MARGIN; ly = LOGO_MARGIN;
        } else if (LOGO_POSITION === "BL") {
            lx = LOGO_MARGIN; ly = OUT_SIZE - curLogoH - LOGO_MARGIN;
        } else if (LOGO_POSITION === "BR") {
            lx = OUT_SIZE - curLogoW - LOGO_MARGIN; ly = OUT_SIZE - curLogoH - LOGO_MARGIN;
        } else if (LOGO_POSITION === "center") {
            lx = (OUT_SIZE - curLogoW) / 2; ly = (OUT_SIZE - curLogoH) / 2;
        } else { // TL
            lx = LOGO_MARGIN; ly = LOGO_MARGIN;
        }

        logoDiv.style.left = (lx / OUT_SIZE * 100) + "%";
        logoDiv.style.top = (ly / OUT_SIZE * 100) + "%";
        logoDiv.style.width = (curLogoW / OUT_SIZE * 100) + "%";
        logoDiv.style.height = "auto";

        logoDiv.dataset.lx = lx;
        logoDiv.dataset.ly = ly;
        logoDiv.dataset.w = curLogoW;
    } else {
        logoDiv.style.display = "none";
    }

    // 4. Setup Watermark Overlay (image OR text — mutually exclusive)
    // enableTextWM already declared above

    if (wmEnabled) {
        // === IMAGE WATERMARK OVERLAY ===
        wmDiv.style.display = "block";

        const wmFile = $("inWM").files[0];
        if (wmFile) {
            wmImgEl.src = URL.createObjectURL(wmFile);
        } else if (window.customWMDataURL) {
            wmImgEl.src = proxyR2Url(window.customWMDataURL);
        } else {
            wmImgEl.src = DEFAULT_WM_URL;
        }

        const wmAspect = wmImg.width / wmImg.height;
        const m = LOGO_MARGIN;
        let curWmW, wx, wy;

        if (WM_POS === "full") {
            curWmW = OUT_SIZE;
            wx = 0; wy = 0;
        } else if (WM_POS === "custom") {
            curWmW = WM_TARGET_W_VAL;
            wx = (+$("WM_X").value || 0) * OUT_SIZE;
            wy = (+$("WM_Y").value || 0) * OUT_SIZE;
        } else {
            curWmW = WM_TARGET_W_VAL;
            const curWmH = curWmW / wmAspect;
            if (WM_POS === "TL") { wx = m; wy = m; }
            else if (WM_POS === "TR") { wx = OUT_SIZE - curWmW - m; wy = m; }
            else if (WM_POS === "BL") { wx = m; wy = OUT_SIZE - curWmH - m; }
            else if (WM_POS === "BR") { wx = OUT_SIZE - curWmW - m; wy = OUT_SIZE - curWmH - m; }
            else if (WM_POS === "center") { wx = (OUT_SIZE - curWmW) / 2; wy = (OUT_SIZE - curWmH) / 2; }
            else { wx = m; wy = m; }
        }

        wmDiv.style.left = (wx / OUT_SIZE * 100) + "%";
        wmDiv.style.top = (wy / OUT_SIZE * 100) + "%";
        wmDiv.style.width = (curWmW / OUT_SIZE * 100) + "%";
        wmDiv.style.height = "auto";
        wmDiv.style.opacity = clamp(WM_OPACITY, 0, 100) / 100;

        wmDiv.dataset.wx = wx;
        wmDiv.dataset.wy = wy;
        wmDiv.dataset.w = curWmW;

    } else if (enableTextWM && textConfig.text) {
        // === TEXT WATERMARK OVERLAY ===
        // Render text watermark onto a temp canvas, then show as overlay
        const tCanvas = document.createElement("canvas");
        const tCtx = tCanvas.getContext("2d");

        // Measure text to determine canvas size
        tCtx.font = `${textConfig.weight} ${textConfig.size}px '${textConfig.font}', sans-serif`;
        const txt = textConfig.text + "   ";
        const tw = tCtx.measureText(txt).width;
        if (tw > 0) {
            const cols = Math.ceil(OUT_SIZE / tw) + 1;
            const rows = textConfig.repeats;
            const rowH = textConfig.size * 1.5;
            const totalW = OUT_SIZE;
            const totalH = rows * rowH;

            tCanvas.width = totalW;
            tCanvas.height = totalH;

            tCtx.font = `${textConfig.weight} ${textConfig.size}px '${textConfig.font}', sans-serif`;
            tCtx.fillStyle = textConfig.color === "white" ? "white" : textConfig.color === "red" ? "red" : textConfig.color === "blue" ? "blue" : "black";
            tCtx.textBaseline = "middle";

            for (let r = 0; r < rows; r++) {
                const y = (r * rowH) + (rowH / 2);
                const offset = r % 2 === 0 ? 0 : -(tw / 2);
                for (let c = 0; c < cols; c++) {
                    tCtx.fillText(txt, offset + (c * tw), y);
                }
            }

            wmImgEl.src = tCanvas.toDataURL("image/png");
            wmDiv.style.display = "block";

            // Position: default at bottom, or custom
            const m = LOGO_MARGIN;
            const curWmW = OUT_SIZE;
            const curWmH = totalH;
            let wx, wy;

            if (WM_POS === "custom") {
                wx = (+$("WM_X").value || 0) * OUT_SIZE;
                wy = (+$("WM_Y").value || 0) * OUT_SIZE;
            } else {
                // Default: bottom of image
                wx = 0;
                wy = OUT_SIZE - curWmH;
            }

            wmDiv.style.left = (wx / OUT_SIZE * 100) + "%";
            wmDiv.style.top = (wy / OUT_SIZE * 100) + "%";
            wmDiv.style.width = (curWmW / OUT_SIZE * 100) + "%";
            wmDiv.style.height = "auto";
            wmDiv.style.opacity = clamp(textConfig.opacity, 0, 100) / 100;

            wmDiv.dataset.wx = wx;
            wmDiv.dataset.wy = wy;
            wmDiv.dataset.w = curWmW;
        } else {
            wmDiv.style.display = "none";
        }
    } else {
        wmDiv.style.display = "none";
    }
}

// DRAG & RESIZE EVENTS
const pLogo = $("previewLogo");
const pContainer = $("previewContainer");

// Mouse Down (Drag Start)
pLogo.addEventListener("mousedown", startDrag);
pLogo.addEventListener("touchstart", startDrag, { passive: false });

function startDrag(e) {
    if (e.target.classList.contains("resizeHandle")) return; // Defer to resize
    e.preventDefault();
    isDraggingLogo = true;

    // Switch to custom mode immediately
    $("LOGO_POSITION").value = "custom";

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragStartX = clientX;
    dragStartY = clientY;

    // Current % positions
    initialLogoLeft = parseFloat(pLogo.style.left);
    initialLogoTop = parseFloat(pLogo.style.top);

    pLogo.classList.add("dragging");
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("touchmove", onDrag, { passive: false });
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchend", endDrag);
}

function onDrag(e) {
    if (!isDraggingLogo) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    // Convert px delta to % delta relative to container width/height
    const cw = pContainer.clientWidth;
    const ch = pContainer.clientHeight;

    const dxPct = (dx / cw) * 100;
    const dyPct = (dy / ch) * 100;

    pLogo.style.left = (initialLogoLeft + dxPct) + "%";
    pLogo.style.top = (initialLogoTop + dyPct) + "%";
}

function endDrag() {
    if (!isDraggingLogo) return;
    isDraggingLogo = false;
    pLogo.classList.remove("dragging");

    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("touchmove", onDrag);
    document.removeEventListener("mouseup", endDrag);
    document.removeEventListener("touchend", endDrag);

    // Save new position
    const leftPct = parseFloat(pLogo.style.left) / 100;
    const topPct = parseFloat(pLogo.style.top) / 100;

    $("LOGO_X").value = leftPct;
    $("LOGO_Y").value = topPct;

    // Trigger update
    // We don't re-render preview because we just moved it visually.
    // But we should reset thumbnails.
    resetOutputs();
    renderOutputThumbs();
}

// Resize Logic
const pHandle = pLogo.querySelector(".resizeHandle");
pHandle.addEventListener("mousedown", startResize);
pHandle.addEventListener("touchstart", startResize, { passive: false });

function startResize(e) {
    e.stopPropagation(); // prevent drag
    e.preventDefault();
    isResizingLogo = true;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    dragStartX = clientX;

    // Current width %
    initialLogoW = parseFloat(pLogo.style.width);

    pLogo.classList.add("dragging");
    document.addEventListener("mousemove", onResize);
    document.addEventListener("touchmove", onResize, { passive: false });
    document.addEventListener("mouseup", endResize);
    document.addEventListener("touchend", endResize);
}

function onResize(e) {
    if (!isResizingLogo) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = clientX - dragStartX;

    // Convert px delta to % delta
    const cw = pContainer.clientWidth;
    const dxPct = (dx / cw) * 100;

    // New width
    const newW = Math.max(5, initialLogoW + dxPct); // min 5%
    pLogo.style.width = newW + "%";
}

function endResize() {
    if (!isResizingLogo) return;
    isResizingLogo = false;
    pLogo.classList.remove("dragging");

    document.removeEventListener("mousemove", onResize);
    document.removeEventListener("touchmove", onResize);
    document.removeEventListener("mouseup", endResize);
    document.removeEventListener("touchend", endResize);

    // Save new width
    const widthPct = parseFloat(pLogo.style.width) / 100;
    const OUT_SIZE = +$("OUT_SIZE").value || 2000;

    const newTargetW = Math.round(widthPct * OUT_SIZE);
    $("LOGO_TARGET_W").value = newTargetW;

    resetOutputs();
    renderOutputThumbs();
}

// ===== WATERMARK DRAG & RESIZE =====
let isDraggingWm = false;
let isResizingWm = false;
let wmDragStartX, wmDragStartY;
let initialWmLeft, initialWmTop;
let initialWmW;

const pWm = $("previewWatermark");

pWm.addEventListener("mousedown", startWmDrag);
pWm.addEventListener("touchstart", startWmDrag, { passive: false });

function startWmDrag(e) {
    if (e.target.classList.contains("resizeHandle")) return;
    e.preventDefault();
    isDraggingWm = true;

    $("WM_POSITION").value = "custom";

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    wmDragStartX = clientX;
    wmDragStartY = clientY;

    initialWmLeft = parseFloat(pWm.style.left);
    initialWmTop = parseFloat(pWm.style.top);

    pWm.classList.add("dragging");
    document.addEventListener("mousemove", onWmDrag);
    document.addEventListener("touchmove", onWmDrag, { passive: false });
    document.addEventListener("mouseup", endWmDrag);
    document.addEventListener("touchend", endWmDrag);
}

function onWmDrag(e) {
    if (!isDraggingWm) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - wmDragStartX;
    const dy = clientY - wmDragStartY;

    const cw = pContainer.clientWidth;
    const ch = pContainer.clientHeight;

    const dxPct = (dx / cw) * 100;
    const dyPct = (dy / ch) * 100;

    pWm.style.left = (initialWmLeft + dxPct) + "%";
    pWm.style.top = (initialWmTop + dyPct) + "%";
}

function endWmDrag() {
    if (!isDraggingWm) return;
    isDraggingWm = false;
    pWm.classList.remove("dragging");

    document.removeEventListener("mousemove", onWmDrag);
    document.removeEventListener("touchmove", onWmDrag);
    document.removeEventListener("mouseup", endWmDrag);
    document.removeEventListener("touchend", endWmDrag);

    const leftPct = parseFloat(pWm.style.left) / 100;
    const topPct = parseFloat(pWm.style.top) / 100;

    $("WM_X").value = leftPct;
    $("WM_Y").value = topPct;

    resetOutputs();
    renderOutputThumbs();
}

// Watermark Resize
const pWmHandle = pWm.querySelector(".resizeHandle");
pWmHandle.addEventListener("mousedown", startWmResize);
pWmHandle.addEventListener("touchstart", startWmResize, { passive: false });

function startWmResize(e) {
    e.stopPropagation();
    e.preventDefault();
    isResizingWm = true;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    wmDragStartX = clientX;

    initialWmW = parseFloat(pWm.style.width);

    pWm.classList.add("dragging");
    document.addEventListener("mousemove", onWmResize);
    document.addEventListener("touchmove", onWmResize, { passive: false });
    document.addEventListener("mouseup", endWmResize);
    document.addEventListener("touchend", endWmResize);
}

function onWmResize(e) {
    if (!isResizingWm) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = clientX - wmDragStartX;

    const cw = pContainer.clientWidth;
    const dxPct = (dx / cw) * 100;

    const newW = Math.max(5, initialWmW + dxPct);
    pWm.style.width = newW + "%";
}

function endWmResize() {
    if (!isResizingWm) return;
    isResizingWm = false;
    pWm.classList.remove("dragging");

    document.removeEventListener("mousemove", onWmResize);
    document.removeEventListener("touchmove", onWmResize);
    document.removeEventListener("mouseup", endWmResize);
    document.removeEventListener("touchend", endWmResize);

    const widthPct = parseFloat(pWm.style.width) / 100;
    const OUT_SIZE = +$("OUT_SIZE").value || 2000;

    const newTargetW = Math.round(widthPct * OUT_SIZE);
    $("WM_TARGET_W").value = newTargetW;

    resetOutputs();
    renderOutputThumbs();
}


/* ===== LIVE PREVIEW (Legacy - override with Interactive) ===== */
async function previewFirstItem() {
    try {
        await openInteractivePreview();
    } catch (err) {
        console.error("Preview error:", err);
        snack("Lỗi xem trước: " + (err?.message || String(err)), "err");
    }
}

// Hook reset logic.. actually we don't need to re-render preview on drag/resize because 
// we are doing it manually. 
// BUT if user changes INPUTS, we do.

function updateInteractivePreview() {
    if (!isPreviewOpen()) return;
    // Debounce?
    openInteractivePreview();
}

// Button Click listener moved to init()


// Hook into existing listeners for auto-update
const configIdsForPreview = [
    "inWM", "inLogo", "OUT_FORMAT", "JPG_QUALITY", "OUT_SIZE", "BG_BLUR", "BG_SCALE",
    "WM_OPACITY", "WM_POSITION", "WM_TARGET_W", "WM_X", "WM_Y", "LOGO_TARGET_W", "LOGO_MARGIN", "LOGO_PLATE_PADDING",
    "LOGO_PLATE_BLUR", "LOGO_PLATE_OPACITY", "LOGO_PLATE_COLOR",
    "enableWatermark", "enableLogo", "enablePlate",
    "LOGO_POSITION",
    "wmText", "wmTextSize", "wmTextOpacity", "wmTextColor", "wmTextRepeats", "wmTextFont", "wmTextWeight"
];

configIdsForPreview.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", updateInteractivePreview);
    if (el.tagName === "INPUT" && (el.type === "text" || el.type === "number")) {
        el.addEventListener("input", updateInteractivePreview);
    }
});


// State
// State definitions moved to top


const uid = () => Math.random().toString(36).slice(2, 10);
const isSameFile = (a, b) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

function setMode(m) {
    mode = m;
    $("kpiModeIn").textContent =
        mode === "folder" ? (getLang() === "en" ? "Folder" : "Thư mục")
            : mode === "files" ? (getLang() === "en" ? "Files" : "Ảnh lẻ")
                : "—";
}

function ready() {
    const ok = items.length && !processing;
    // $("btnRun").disabled = !ok;
    $("btnRun2").disabled = !ok;

    const canClear = (items.length || $("inWM").files[0] || $("inLogo").files[0]) && !processing;
    // $("btnClear").disabled = !canClear;
    $("btnClear2").disabled = !canClear;

    $("kpiReady").textContent = ok ? "Yes" : "No";
    return ok;
}

function updateKPIs() {
    $("kpiCountIn").textContent = String(items.length);
    $("kpiCountOut").textContent = String(items.length);
    ready();
}

function resetOutputs() {
    for (const it of items) {
        it.outBlob = null;
        it.outName = null;
        if (it.outURL) { URL.revokeObjectURL(it.outURL); it.outURL = null; }
    }
    $("btnDownloadAll").disabled = true;
    $("btnDownloadSelected").disabled = true;
    $("btnSelectAll").disabled = true;
    $("btnUnselectAll").disabled = true;
}

function revokeAll() {
    for (const it of items) {
        if (it.inURL) URL.revokeObjectURL(it.inURL);
        if (it.outURL) URL.revokeObjectURL(it.outURL);
    }
}

function clearAll() {
    revokeAll();
    items = [];
    mode = "none";
    folderInfo = null;
    resetOutputs();
    setMode("none");
    setProgress(0);

    $("thumbsIn").innerHTML = "";
    $("thumbsOut").innerHTML = "";
    $("folderSummary").classList.remove("show");
    $("inPhotos").value = "";
    $("inFolder").value = "";

    $("inWM").value = "";
    $("inLogo").value = "";

    setStatus(t("no_result"), "info");
    snack(t("snack_cleared"), "ok");
    updateKPIs();
}

function removeItem(id) {
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    const [rm] = items.splice(idx, 1);
    if (rm?.inURL) URL.revokeObjectURL(rm.inURL);
    if (rm?.outURL) URL.revokeObjectURL(rm.outURL);

    resetOutputs();
    renderInputThumbs();
    renderOutputThumbs();
    updateKPIs();
    snack(t("snack_removed"), "ok");
}

async function addFiles(fileList, isFolder = false) {
    let files = Array.from(fileList || []).filter(isImage);
    if (!files.length) { snack(t("snack_invalid"), "warn"); return; }

    // Check for HEIC files and convert them
    const heicFiles = files.filter(isHeic);
    if (heicFiles.length > 0) {
        snack(t("snack_converting_heic"), "info");
        try {
            const convertedFiles = await Promise.all(
                files.map(async (f) => {
                    if (isHeic(f)) {
                        return await convertHeicToJpg(f);
                    }
                    return f;
                })
            );
            files = convertedFiles;
            snack((I18N[getLang()] || I18N.vi).snack_heic_done(heicFiles.length), "ok");
        } catch (err) {
            console.error("HEIC conversion error:", err);
            snack(err?.message || "HEIC conversion failed", "err");
            return;
        }
    }

    if (isFolder) {
        revokeAll();
        items = [];
        folderInfo = null;
        setMode("folder");

        const first = files[0];
        const rel = first.webkitRelativePath || "";
        const folderName = (rel && rel.includes("/")) ? rel.split("/")[0] : (getLang() === "en" ? "Folder" : "Thư mục");
        folderInfo = { name: folderName, count: files.length };

        $("folderName").textContent = folderInfo.name;
        $("folderCount").textContent = `${folderInfo.count} ${getLang() === "en" ? "images" : "ảnh"}`;
        $("folderSummary").classList.add("show");
        $("thumbsIn").innerHTML = "";
    } else {
        setMode("files");
        $("folderSummary").classList.remove("show");
    }

    let added = 0;
    for (const f of files) {
        if (items.some(it => isSameFile(it.file, f))) continue;
        items.push({
            id: uid(),
            file: f,
            name: f.name,
            relPath: f.webkitRelativePath || "",
            inURL: URL.createObjectURL(f),
            outBlob: null,
            outURL: null,
            outName: null,
            selected: true
        });
        added++;
    }

    resetOutputs();
    if (!isFolder) renderInputThumbs();
    renderOutputThumbs();
    updateKPIs();

    if (isFolder) {
        snack((I18N[getLang()] || I18N.vi).snack_folder(folderInfo.name, folderInfo.count), "ok");
    } else {
        snack((I18N[getLang()] || I18N.vi).snack_added(added, items.length), "ok");
    }
}

function renderInputThumbs() {
    const wrap = $("thumbsIn");
    wrap.innerHTML = "";
    if (mode === "folder") return;

    for (const it of items) {
        const card = document.createElement("div");
        card.className = "thumb";

        const imgWrap = document.createElement("div");
        imgWrap.className = "imgWrap";

        const img = document.createElement("img");
        img.src = it.inURL;
        img.alt = it.name;
        imgWrap.appendChild(img);

        const x = document.createElement("button");
        x.className = "xbtn";
        x.type = "button";
        x.title = "Remove";
        x.innerHTML = `<span class="ms sm">close</span>`;
        x.addEventListener("click", () => removeItem(it.id));
        imgWrap.appendChild(x);

        const meta = document.createElement("div");
        meta.className = "meta";

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = it.relPath || it.name;

        meta.appendChild(name);

        card.appendChild(imgWrap);
        card.appendChild(meta);
        wrap.appendChild(card);
    }
}

function isProcessedAll() {
    return items.length && items.every(it => !!it.outBlob && !!it.outURL);
}

function updateBatchButtons() {
    const ok = isProcessedAll() && !processing;
    $("btnDownloadAll").disabled = !ok;
    $("btnDownloadSelected").disabled = !ok || !items.some(it => it.selected);
    $("btnSelectAll").disabled = !ok;
    $("btnUnselectAll").disabled = !ok;
}

function renderOutputThumbs() {
    const wrap = $("thumbsOut");
    if (!items.some(it => it.outBlob)) {
        wrap.innerHTML = "";
        updateBatchButtons();
        return;
    }

    wrap.innerHTML = "";
    const processedAll = isProcessedAll();

    for (const it of items) {
        if (!it.outBlob || !it.outURL) continue;

        const card = document.createElement("div");
        card.className = "thumb";

        const imgWrap = document.createElement("div");
        imgWrap.className = "imgWrap";

        const img = document.createElement("img");
        img.src = it.outURL;
        img.alt = it.name;
        imgWrap.appendChild(img);

        // Click to preview
        imgWrap.addEventListener("click", () => {
            openPreview(it.outURL, it.outName || it.name);
        });

        const meta = document.createElement("div");
        meta.className = "meta";

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = it.relPath || it.name;

        const tag = document.createElement("div");
        tag.className = "tag";
        tag.innerHTML = `<span class="ms sm">check_circle</span><span>${t("result_tag")}</span>`;

        const actions = document.createElement("div");
        actions.className = "actions";

        const left = document.createElement("div");
        left.style.display = "flex";
        left.style.gap = "10px";
        left.style.alignItems = "center";

        const lab = document.createElement("label");
        lab.className = "sel";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!it.selected;
        cb.disabled = !processedAll || processing;
        cb.addEventListener("change", (ev) => {
            it.selected = ev.target.checked;
            updateBatchButtons();
        });

        const text = document.createElement("span");
        text.style.display = "inline-flex";
        text.style.gap = "6px";
        text.style.alignItems = "center";
        text.innerHTML = `<span>${t("choose")}</span>`;

        lab.appendChild(cb);
        lab.appendChild(text);
        left.appendChild(lab);

        const btnDl = document.createElement("button");
        btnDl.className = "btn mini";
        btnDl.disabled = !it.outBlob || processing;
        btnDl.innerHTML = `<span class="ms">download</span><span>${t("download_one")}</span>`;
        btnDl.addEventListener("click", () => {
            if (!it.outBlob) return;
            downloadBlob(it.outBlob, it.outName || (baseName(it.name) + ".jpg"));
        });

        actions.appendChild(left);
        actions.appendChild(btnDl);

        meta.appendChild(name);
        meta.appendChild(tag);
        meta.appendChild(actions);

        card.appendChild(imgWrap);
        card.appendChild(meta);
        wrap.appendChild(card);
    }

    updateBatchButtons();
}

async function loadAssets() {
    const wmFile = $("inWM").files[0];
    const logoFile = $("inLogo").files[0];
    const enableWM = $("enableWatermark").checked;
    const enableLogo = $("enableLogo").checked;

    setStatus(t("status_load_assets"), "hourglass_top");

    // Only load watermark if enabled
    if (enableWM) {
        if (wmFile) {
            wmImg = await fileToImageSource(wmFile);
        } else if (window.customWMDataURL) {
            try {
                wmImg = await urlToImageSource(window.customWMDataURL);
            } catch (err) {
                console.warn("Custom WM URL failed, auto-fixing:", err);
                const brokenUrl = window.customWMDataURL;
                window.customWMDataURL = null;
                wmImg = await urlToImageSource(DEFAULT_WM_URL);
                // Auto-fix: remove broken URL from Firebase
                autoFixBrokenAssetUrl('customWMDataURL', brokenUrl);
                snack("Watermark URL lỗi → đã dùng mặc định & tự sửa trên Cloud.", "warn");
            }
        } else {
            wmImg = await urlToImageSource(DEFAULT_WM_URL);
        }
    } else {
        wmImg = null;
    }

    // Only load logo if enabled
    if (enableLogo) {
        if (logoFile) {
            logoImg = await fileToImageSource(logoFile);
        } else if (window.customLogoDataURL) {
            try {
                logoImg = await urlToImageSource(window.customLogoDataURL);
            } catch (err) {
                console.warn("Custom Logo URL failed, auto-fixing:", err);
                const brokenUrl = window.customLogoDataURL;
                window.customLogoDataURL = null;
                logoImg = await urlToImageSource(DEFAULT_LOGO_URL);
                // Auto-fix: remove broken URL from Firebase
                autoFixBrokenAssetUrl('customLogoDataURL', brokenUrl);
                snack("Logo URL lỗi → đã dùng mặc định & tự sửa trên Cloud.", "warn");
            }
        } else {
            logoImg = await urlToImageSource(DEFAULT_LOGO_URL);
        }
    } else {
        logoImg = null;
    }

    return true;

}

/**
 * Auto-fix broken R2 URLs in Firebase.
 * Removes the broken URL from currentSettings and any matching presets.
 */
function autoFixBrokenAssetUrl(fieldName, brokenUrl) {
    if (!currentUser) return;
    const uid = currentUser.uid;

    // 1. Clear from currentSettings
    db.ref(`users/${uid}/currentSettings/${fieldName}`).remove()
        .then(() => console.log(`Auto-fixed: removed ${fieldName} from currentSettings`))
        .catch(err => console.warn("Auto-fix currentSettings failed:", err));

    // 2. Clear from any preset that has this broken URL
    db.ref(`users/${uid}/customPresets`).once('value').then(snapshot => {
        const data = snapshot.val();
        if (!data) return;

        const updates = {};
        Object.keys(data).forEach(presetId => {
            const preset = data[presetId];
            if (preset?.values?.[fieldName] === brokenUrl) {
                updates[`${presetId}/values/${fieldName}`] = null;
                console.log(`Auto-fixed: removing ${fieldName} from preset "${preset.name || presetId}"`);
            }
        });

        if (Object.keys(updates).length > 0) {
            db.ref(`users/${uid}/customPresets`).update(updates)
                .then(() => console.log("Auto-fixed presets in Firebase"))
                .catch(err => console.warn("Auto-fix presets failed:", err));
        }
    }).catch(err => console.warn("Auto-fix preset scan failed:", err));
}

/* ===== Events: upload ===== */
// Image custom states for presets
window.customWMDataURL = null;
window.customLogoDataURL = null;

$("inWM").addEventListener("change", (e) => {
    $("enableWatermark").checked = true;
    window.customWMDataURL = null;
    if (e.target.files[0]) {
        const r = new FileReader();
        r.onload = ev => window.customWMDataURL = ev.target.result;
        r.readAsDataURL(e.target.files[0]);
    }
    updateInteractivePreview();
});

$("inLogo").addEventListener("change", (e) => {
    $("enableLogo").checked = true;
    window.customLogoDataURL = null;
    if (e.target.files[0]) {
        const r = new FileReader();
        r.onload = ev => window.customLogoDataURL = ev.target.result;
        r.readAsDataURL(e.target.files[0]);
    }
    updateInteractivePreview();
});

$("inPhotos").addEventListener("change", (e) => {
    addFiles(e.target.files, false);
    e.target.value = "";
});

$("inFolder").addEventListener("change", (e) => {
    $("inPhotos").value = "";
    addFiles(e.target.files, true);
});

// config change => invalidate outputs
// Toggle Text Watermark Settings
$("enableTextWM").addEventListener("change", () => {
    const on = $("enableTextWM").checked;
    // Mutual exclusion: turn off image watermark when text is on
    if (on) $("enableWatermark").checked = false;
    const settings = $("textWmSettings");
    if (settings) settings.style.display = on ? "block" : "none";

    resetOutputs();
    renderOutputThumbs();
    updateKPIs();
});

// Mutual exclusion: turn off text watermark when image watermark is on
$("enableWatermark").addEventListener("change", () => {
    if ($("enableWatermark").checked) {
        $("enableTextWM").checked = false;
        const settings = $("textWmSettings");
        if (settings) settings.style.display = "none";
    }
});

// config change => invalidate outputs
const configIds = [
    "inWM", "inLogo", "OUT_FORMAT", "JPG_QUALITY", "OUT_SIZE", "BG_BLUR", "BG_SCALE",
    "WM_OPACITY", "WM_POSITION", "WM_TARGET_W", "WM_X", "WM_Y", "LOGO_TARGET_W", "LOGO_MARGIN", "LOGO_PLATE_PADDING",
    "LOGO_PLATE_BLUR", "LOGO_PLATE_OPACITY", "LOGO_PLATE_COLOR",
    "enableWatermark", "enableLogo", "enablePlate",
    "LOGO_POSITION",
    "wmText", "wmTextSize", "wmTextOpacity", "wmTextColor", "wmTextRepeats", "wmTextFont", "wmTextWeight"
];

configIds.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
        resetOutputs();
        renderOutputThumbs();
        updateKPIs();
        syncCurrentSettings(); // Added sync to Firebase
    });
});

// Drag&Drop
const dz = $("dropzone");
dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("drag");
    const files = e.dataTransfer?.files;
    if (files && files.length) addFiles(files, false);
    else snack(t("snack_drag_err"), "warn");
});

// Clear
// $("btnClear").addEventListener("click", clearAll);
$("btnClear2").addEventListener("click", clearAll);

// Batch select
$("btnSelectAll").addEventListener("click", () => {
    for (const it of items) it.selected = true;
    renderOutputThumbs();
});
$("btnUnselectAll").addEventListener("click", () => {
    for (const it of items) it.selected = false;
    renderOutputThumbs();
});

// Download selected: ZIP selected
$("btnDownloadSelected").addEventListener("click", async () => {
    if (!isProcessedAll()) return;
    const selected = items.filter(it => it.selected && it.outBlob);
    if (!selected.length) { snack(t("snack_selected_none"), "warn"); return; }

    try {
        const zip = new JSZip();
        for (const it of selected) {
            zip.file(it.outName, it.outBlob);
        }
        setStatus(t("status_zip"), "archive");
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        const name = ($("zipName").value || "selected.zip").replace(/\.zip$/i, "") + "_selected.zip";
        downloadBlob(blob, name);
        snack((I18N[getLang()] || I18N.vi).snack_downloaded(name), "ok");
        setStatus((I18N[getLang()] || I18N.vi).status_done(items.length), "check_circle");
    } catch (err) {
        console.error(err);
        snack(err?.message || String(err), "err");
    }
});


/* ===== Image Preview Modal (Lightbox) ===== */
const previewModal = $("previewModal");
const previewImg = $("previewImg");
const previewCaption = $("previewCaption");

function openPreview(imgSrc, caption) {
    previewImg.src = imgSrc;
    previewCaption.textContent = caption || "";
    // Hide interactive logo/watermark overlays (only for interactive preview, not result lightbox)
    $("previewLogo").style.display = "none";
    $("previewWatermark").style.display = "none";
    // Hide confirm button (only for interactive preview)
    const btnConfirm = $("btnConfirmPreview");
    if (btnConfirm) btnConfirm.style.display = "none";

    previewModal.classList.add("show");
    previewModal.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
}

function closePreview() {
    previewModal.classList.remove("show");
    previewModal.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    previewImg.src = "";
}

$("btnClosePreview").addEventListener("click", closePreview);
const btnConfirm = $("btnConfirmPreview");
if (btnConfirm) btnConfirm.addEventListener("click", closePreview);
$("previewOverlay").addEventListener("click", (e) => {
    // Close if clicking outside the image
    if (e.target === $("previewOverlay") || e.target === previewImg) {
        closePreview();
    }
});

/* ✅ NEW: Confirm folder modal (professional pre-confirm) */
const confirmFolderModal = $("confirmFolderModal");
function openConfirmFolder() {
    confirmFolderModal.classList.add("show");
    confirmFolderModal.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
}
function closeConfirmFolder() {
    confirmFolderModal.classList.remove("show");
    confirmFolderModal.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
}
$("btnPickFolder").addEventListener("click", openConfirmFolder);
$("btnCloseConfirmFolder").addEventListener("click", closeConfirmFolder);
$("btnCancelConfirmFolder").addEventListener("click", closeConfirmFolder);
$("btnContinueConfirmFolder").addEventListener("click", () => {
    closeConfirmFolder();
    // open the actual browser folder picker (the browser prompt is unavoidable)
    $("inFolder").click();
});
confirmFolderModal.addEventListener("click", (e) => { if (e.target === confirmFolderModal) closeConfirmFolder(); });

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (previewModal.classList.contains("show")) closePreview();
        if (confirmFolderModal.classList.contains("show")) closeConfirmFolder();
    }
});

// Presets (Removed)

/* ===== Firebase Auth & Sync Logic ===== */
auth.onAuthStateChanged(user => {
    currentUser = user;
    const userProfile = $("userProfile");
    const btnLogin = $("btnLogin");
    const loginOverlay = $("loginOverlay");

    if (user) {
        // Logged In
        localStorage.setItem("wasLoggedIn", "true");
        document.body.classList.remove("locked");
        if (loginOverlay) loginOverlay.classList.add("hidden");

        if (userProfile) userProfile.style.display = "flex";
        if (btnLogin) btnLogin.style.display = "none";
        if ($("userAvatar")) $("userAvatar").src = user.photoURL || "";
        if ($("userName")) {
            $("userName").textContent = user.displayName || user.email || "User";
            $("userName").style.display = "inline";
        }
        if ($("dropdownEmail")) {
            $("dropdownEmail").textContent = user.email || "User";
        }

        // Load custom presets exclusively from DB for this user
        db.ref(`users/${user.uid}/customPresets`).on('value', snapshot => {
            const data = snapshot.val();
            const presets = data ? Object.values(data).filter(p => p && p.id) : [];
            window._runtimePresets = presets;
            renderCustomPresets();
        }, error => {
            console.error("Firebase customPresets read error:", error);
            if (error.code === "PERMISSION_DENIED") {
                alert("Lỗi quyền truy cập Firebase Realtime Database. Vui lòng mở quyền đọc/ghi trên Firebase Rules.");
            }
        });

        // Load current Settings from DB
        isApplyingRemoteSettings = true;
        db.ref(`users/${user.uid}/currentSettings`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (data) {
                applyCustomPreset({ name: "Cloud Sync", values: data }, true);
                snack("Đã đồng bộ cài đặt từ Cloud.", "info");
            }
            setTimeout(() => { isApplyingRemoteSettings = false; }, 500);
        }).catch(err => {
            console.error("Firebase currentSettings read error:", err);
        });

    } else {
        // Logged Out
        localStorage.setItem("wasLoggedIn", "false");
        document.body.classList.add("locked");
        if (loginOverlay) loginOverlay.classList.remove("hidden");

        if (userProfile) userProfile.style.display = "none";
        if (btnLogin) btnLogin.style.display = "inline-flex";
        if ($("userName")) $("userName").style.display = "none";

        // Clear cached cloud presets
        window._runtimePresets = [];
        renderCustomPresets();
    }
    
    if (typeof handleMobileProfile === "function") {
        handleMobileProfile();
    }
});

function handleLogin() {
    const btn = $("btnOverlayLogin");
    if (btn) {
        btn.innerHTML = '<span class="ms">hourglass_empty</span> Vui lòng chờ...';
        btn.style.opacity = "0.7";
        btn.style.pointerEvents = "none";
    }
    const btn2 = $("btnLogin");
    if (btn2) {
        btn2.style.opacity = "0.7";
        btn2.style.pointerEvents = "none";
    }

    // Use signInWithPopup to avoid Permissions policy violation (unload event)
    auth.signInWithPopup(provider).catch(err => {
        console.error("Login popup failed", err);
        if (btn) {
            btn.innerHTML = '<span class="ms">login</span> Đăng nhập với Google';
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
        }
        if (btn2) {
            btn2.style.opacity = "1";
            btn2.style.pointerEvents = "auto";
        }
        snack((I18N[getLang()] || I18N.vi).status_err(err.message), "error");
    });
}

// Dropdown Logic
window.toggleUserDropdown = function(e) {
    if (e) e.stopPropagation();
    const dropdown = $("userDropdown");
    if (dropdown) {
        const isVisible = dropdown.style.display === "flex";
        dropdown.style.display = isVisible ? "none" : "flex";
    }
};

document.addEventListener("click", () => {
    const dropdown = $("userDropdown");
    if (dropdown && dropdown.style.display === "flex") {
        dropdown.style.display = "none";
    }
});

$("btnTriggerLogout")?.addEventListener("click", () => {
    $("btnLogout")?.click();
});

$("btnLogin")?.addEventListener("click", handleLogin);
$("btnOverlayLogin")?.addEventListener("click", handleLogin);

$("btnLogout")?.addEventListener("click", () => {
    showConfirmModal(
        "Đăng xuất",
        "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này?",
        "Đăng xuất",
        "logout",
        false,
        () => {
            localStorage.setItem("wasLoggedIn", "false");
            auth.signOut().then(() => snack((I18N[getLang()] || I18N.vi).logout + " OK", "ok"));
        }
    );
});


// Relocating profile to mobile dock on small screens
function handleMobileProfile() {
    const profile = $("userProfile");
    const login = $("btnLogin");
    const dock = document.querySelector(".mobileDock");
    const cluster = document.querySelector(".actions-cluster");

    if (!profile || !dock || !cluster) return;

    if (window.innerWidth <= 768) {
        if (profile.parentElement !== dock) {
            dock.prepend(login);
            dock.prepend(profile);
        }
    } else {
        if (profile.parentElement !== cluster) {
            cluster.prepend(login);
            cluster.prepend(profile);
        }
    }
}

// Relocating custom presets to top on mobile
function handleMobilePresets() {
    const presetContainer = $("customPresetContainer");
    const grid = document.querySelector(".grid");
    const settingsCardBody = document.querySelector(".card:not(#customPresetCard) > .cardBody"); 
    // Wait, the settings card is the second .card in .grid (or first if no customPresetCard).
    // Let's explicitly find the settings card body by checking its preceding header.
    const settingsCard = Array.from(document.querySelectorAll('.card')).find(card => card.querySelector('[data-i18n="settings"]'));
    if (!settingsCard) return;
    const sBody = settingsCard.querySelector('.cardBody');

    if (!presetContainer || !grid || !sBody) return;

    if (window.innerWidth <= 768) {
        // Move to top of grid
        if (presetContainer.parentElement !== grid) {
            grid.insertBefore(presetContainer, grid.firstChild);
        }
    } else {
        // Move back to settings card body (at the very beginning)
        if (presetContainer.parentElement !== sBody) {
            sBody.insertBefore(presetContainer, sBody.firstChild);
        }
    }
}

window.addEventListener("resize", () => {
    handleMobileProfile();
    handleMobilePresets();
});

document.addEventListener("DOMContentLoaded", () => {
    handleMobileProfile();
    handleMobilePresets();
});
// Initial check during auth render setup
const origAuthObserver = auth.onAuthStateChanged;

/* ===== Custom Presets Logic ===== */
window._runtimePresets = [];

const CUSTOM_PRESET_KEYS = [
    "OUT_FORMAT", "JPG_QUALITY", "OUT_SIZE", "BG_BLUR", "BG_SCALE",
    "WM_OPACITY", "WM_POSITION", "WM_TARGET_W", "WM_X", "WM_Y", "LOGO_TARGET_W", "LOGO_MARGIN", "LOGO_PLATE_PADDING",
    "LOGO_PLATE_BLUR", "LOGO_PLATE_OPACITY", "LOGO_PLATE_COLOR",
    "enableWatermark", "enableLogo", "enablePlate",
    "LOGO_POSITION", "enableTextWM",
    "wmText", "wmTextSize", "wmTextOpacity", "wmTextColor", "wmTextRepeats", "wmTextFont", "wmTextWeight"
];

function getCustomPresets() {
    return window._runtimePresets || [];
}

const R2_WORKER_URL = "https://r2-uploader.insertwatermark.workers.dev"; // Cloudflare R2 Uploader Endpoint

async function uploadBase64ToR2(base64Data, filename) {
    if (!currentUser) return null;
    const token = await currentUser.getIdToken();
    try {
        const response = await fetch(R2_WORKER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: base64Data,
                filename: filename
            })
        });

        const text = await response.text();
        let result = null;
        try {
            result = JSON.parse(text);
        } catch (parseErr) {
            console.error("Non-JSON Response from R2 Worker:", response.status, text);
            alert(`Cloudflare R2 Server Error (${response.status}):\n\n${text.substring(0, 200)}...`);
            return null;
        }

        if (response.ok && result.success) {
            return result.url;
        } else {
            console.error("R2 Upload Application Error:", result);
            alert(`Lỗi ứng dụng R2: ${result.error || JSON.stringify(result)}`);
            return null;
        }
    } catch (e) {
        console.error("Failed to fetch R2 Worker", e);
        alert(`Lỗi kết nối hoặc kích thước ảnh quá lớn:\n\n${e.message}`);
        return null;
    }
}

async function deleteR2Asset(url) {
    if (!currentUser || !url || !url.includes("r2.dev")) return false;
    const token = await currentUser.getIdToken();
    try {
        const response = await fetch(R2_WORKER_URL, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url })
        });
        const result = await response.json();
        return result.success;
    } catch (e) {
        console.warn("Failed to delete R2 asset:", e);
        return false;
    }
}

function isAssetInUse(url, excludePresetId = null) {
    if (!url) return false;
    const presets = getCustomPresets();
    for (const p of presets) {
        if (p.id === excludePresetId) continue;
        if (p.values.customLogoDataURL === url || p.values.customWMDataURL === url) return true;
    }
    return false;
}

async function saveCustomPresets(presets) {
    if (!currentUser) return;

    // Check for base64 images and upload to R2 before saving
    try {
        for (let i = 0; i < presets.length; i++) {
            const preset = presets[i];

            if (preset.values.customWMDataURL && preset.values.customWMDataURL.startsWith("data:image")) {
                const ext = preset.values.customWMDataURL.indexOf("image/jpeg") > -1 ? "jpg" : "png";
                snack("Đang tải hình nền lên Cloud...", "info");
                const publicUrl = await uploadBase64ToR2(preset.values.customWMDataURL, `watermark_${preset.id}.${ext}`);
                if (publicUrl) preset.values.customWMDataURL = publicUrl;
            }

            if (preset.values.customLogoDataURL && preset.values.customLogoDataURL.startsWith("data:image")) {
                const ext = preset.values.customLogoDataURL.indexOf("image/jpeg") > -1 ? "jpg" : "png";
                snack("Đang tải Logo lên Cloud...", "info");
                const publicUrl = await uploadBase64ToR2(preset.values.customLogoDataURL, `logo_${preset.id}.${ext}`);
                if (publicUrl) preset.values.customLogoDataURL = publicUrl;
                else throw new Error("Cloudflare R2 Upload Failed for Logo");
            }
        }
    } catch (e) {
        console.error("Process image errors", e);
        alert("Lỗi tải ảnh lên Cloudflare R2: " + e.message);
        return false;
    }

    window._runtimePresets = presets;
    try {
        const updates = {};
        presets.forEach(p => { updates[p.id] = p; });
        db.ref(`users/${currentUser.uid}/customPresets`).set(updates).catch(err => {
            console.error("Firebase saveCustomPresets error:", err);
            if (err.code === "PERMISSION_DENIED") {
                alert("Không thể lưu Preset lên Cloud do chưa thiết lập quyền Firebase Realtime Database Rules. Vui lòng cập nhật Rule Firebase.");
            }
        });
    } catch (e) {
        console.error("Failed to save custom presets", e);
        return false;
    }
    return true;
}

function renderCustomPresets() {
    const presets = getCustomPresets();
    const container = $("customPresetList");
    if (!container) return;

    container.innerHTML = "";

    presets.forEach(preset => {
        const card = document.createElement("div");
        card.className = "preset-card";
        card.addEventListener("click", () => applyCustomPreset(preset));

        // Logo
        if (preset.values.enableLogo && preset.values.customLogoDataURL) {
            const img = document.createElement("img");
            img.className = "preset-logo";
            img.src = preset.values.customLogoDataURL;
            img.alt = preset.name;
            // Handle loading errors gracefully
            img.onerror = () => {
                img.style.display = 'none';
                if (!card.querySelector('.preset-logo-fallback')) {
                    const fb = document.createElement("div");
                    fb.className = "preset-logo-fallback";
                    fb.innerHTML = '<span class="ms">image_not_supported</span>';
                    card.insertBefore(fb, card.firstChild);
                }
            };
            card.appendChild(img);
        } else {
            // Fallback logo if logo is disabled or missing
            const fallback = document.createElement("div");
            fallback.className = "preset-logo-fallback";
            fallback.innerHTML = `<span class="ms">image</span>`;
            card.appendChild(fallback);
        }

        // Name
        const nameEl = document.createElement("div");
        nameEl.className = "preset-name";
        nameEl.textContent = preset.name;
        card.appendChild(nameEl);

        // Watermark Text (Subtitle)
        if (preset.values.enableTextWM && preset.values.wmText) {
            const wmEl = document.createElement("div");
            wmEl.className = "preset-wm";
            wmEl.textContent = `(${preset.values.wmText})`;
            card.appendChild(wmEl);
        }

        // Delete Button
        const delBtn = document.createElement("button");
        delBtn.className = "preset-delete";
        delBtn.type = "button";
        delBtn.innerHTML = '<span class="ms">delete</span>';
        delBtn.title = t("clear") || "Xóa";
        delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteCustomPreset(preset.id);
        });
        card.appendChild(delBtn);

        container.appendChild(card);
    });
}

function applyCustomPreset(preset, silent = false) {
    if (!preset || !preset.values) return;

    // Apply image base64 if available
    if (preset.values.customWMDataURL) {
        window.customWMDataURL = preset.values.customWMDataURL;
        if ($("inWM")) $("inWM").value = "";
    } else {
        window.customWMDataURL = null;
    }

    if (preset.values.customLogoDataURL) {
        window.customLogoDataURL = preset.values.customLogoDataURL;
        if ($("inLogo")) $("inLogo").value = "";
    } else {
        window.customLogoDataURL = null;
    }

    CUSTOM_PRESET_KEYS.forEach(key => {
        const el = $(key);
        if (el && preset.values[key] !== undefined) {
            if (el.type === "checkbox") {
                el.checked = preset.values[key];
            } else {
                el.value = preset.values[key];
            }
        }
    });

    const textWmOn = $("enableTextWM")?.checked;
    if ($("textWmSettings")) $("textWmSettings").style.display = textWmOn ? "block" : "none";
    if (textWmOn && $("enableWatermark")) $("enableWatermark").checked = false;

    if (!silent) snack(`Đã áp dụng: ${preset.name}`, "ok");
    resetOutputs();
    renderOutputThumbs();
    updateKPIs();
}

function showConfirmModal(title, desc, okText, okIcon, isDanger, onConfirm, altInfo = null) {
    const modal = $("confirmActionModal");
    if (!modal) return;
    
    $("confirmActionTitle").innerText = title;
    $("confirmActionDesc").innerHTML = desc;
    $("confirmActionOkText").innerText = okText;
    $("confirmActionIcon").innerText = okIcon;
    
    const btnOk = $("btnConfirmActionOk");
    if (isDanger) btnOk.classList.add("error");
    else btnOk.classList.remove("error");
    
    const btnAlt = $("btnConfirmActionAlt");
    if (altInfo) {
        $("confirmActionAltText").innerText = altInfo.text;
        $("confirmActionAltIcon").innerText = altInfo.icon;
        btnAlt.style.display = "flex";
    } else {
        btnAlt.style.display = "none";
    }
    
    // remove previous listeners by cloning
    const btnCancel = $("btnConfirmActionCancel");
    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    
    const btnClose = $("btnConfirmActionClose");
    const newBtnClose = btnClose.cloneNode(true);
    btnClose.parentNode.replaceChild(newBtnClose, btnClose);
    
    const newBtnOk = btnOk.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    
    const newBtnAlt = btnAlt.cloneNode(true);
    btnAlt.parentNode.replaceChild(newBtnAlt, btnAlt);
    
    modal.classList.add("show");
    
    const close = () => modal.classList.remove("show");
    
    newBtnClose.onclick = close;
    newBtnCancel.onclick = close;
    
    newBtnOk.onclick = () => {
        close();
        if (onConfirm) onConfirm();
    };
    
    newBtnAlt.onclick = () => {
        close();
        if (altInfo && altInfo.onAlt) altInfo.onAlt();
    }
}

function deleteCustomPreset(id) {
    if (!currentUser) return;
    
    showConfirmModal(
        "Xóa Preset",
        "Bạn có chắc chắn muốn xóa preset này? Hành động này không thể hoàn tác.",
        "Xóa",
        "delete",
        true,
        () => {
            let presets = getCustomPresets();
            const pToDelete = presets.find(p => p.id === id);
            presets = presets.filter(p => p.id !== id);
            window._runtimePresets = presets;

            try {
                db.ref(`users/${currentUser.uid}/customPresets/${id}`).remove();
                
                // Cleanup orphaned R2 images safely
                if (pToDelete) {
                    const l = pToDelete.values.customLogoDataURL;
                    const w = pToDelete.values.customWMDataURL;
                    if (l && !isAssetInUse(l, id)) deleteR2Asset(l);
                    if (w && !isAssetInUse(w, id)) deleteR2Asset(w);
                }
            } catch (e) { }

            renderCustomPresets();
            snack(t("snack_cleared"), "info");
        }
    );
}

$("btnSavePreset")?.addEventListener("click", async () => {
    if (!currentUser) {
        snack("Vui lòng đăng nhập để lưu preset", "warn");
        const loginOverlay = $("loginOverlay");
        if (loginOverlay) loginOverlay.classList.remove("hidden");
        return;
    }

    const nameInput = $("customPresetName");
    const name = nameInput.value.trim();
    if (!name) { snack("Vui lòng nhập tên preset", "warn"); return; }

    const savePresetData = async (presetObj, presetsList, successMsg) => {
        $("btnSavePreset").disabled = true;
        if ($("dockSavePreset")) $("dockSavePreset").disabled = true;
        try {
            const presetsToSave = JSON.parse(JSON.stringify(presetsList));
            // if we are adding new, it's not in the list yet
            if (!presetsToSave.find(p => p.id === presetObj.id)) {
                presetsToSave.push(presetObj);
            } else {
                // overwrite existing
                const idx = presetsToSave.findIndex(p => p.id === presetObj.id);
                if (idx !== -1) {
                    const oldLogo = presetsToSave[idx].values.customLogoDataURL;
                    const oldWM = presetsToSave[idx].values.customWMDataURL;
                    
                    presetsToSave[idx] = presetObj;
                    
                    // Cleanup overwritten assets if they are no longer in use
                    if (oldLogo && oldLogo !== presetObj.values.customLogoDataURL && !isAssetInUse(oldLogo, presetObj.id)) {
                        deleteR2Asset(oldLogo);
                    }
                    if (oldWM && oldWM !== presetObj.values.customWMDataURL && !isAssetInUse(oldWM, presetObj.id)) {
                        deleteR2Asset(oldWM);
                    }
                }
            }
            
            const success = await saveCustomPresets(presetsToSave);
            if (success) {
                nameInput.value = "";
                renderCustomPresets();
                snack(successMsg, "ok");
            }
        } finally {
            $("btnSavePreset").disabled = false;
            if ($("dockSavePreset")) $("dockSavePreset").disabled = false;
        }
    };

    const values = {};
    CUSTOM_PRESET_KEYS.forEach(key => {
        const el = $(key);
        if (el) values[key] = el.type === "checkbox" ? el.checked : el.value;
    });

    if (window.customWMDataURL) values.customWMDataURL = window.customWMDataURL;
    if (window.customLogoDataURL) values.customLogoDataURL = window.customLogoDataURL;

    const currentPresets = getCustomPresets();
    const existing = currentPresets.find(p => p.name.toLowerCase() === name.toLowerCase());

    if (existing) {
        showConfirmModal(
            "Trùng tên Preset",
            `Đã có một Preset mang tên "<b>${name}</b>".<br>Bạn muốn ghi đè lên bộ cũ hay tạo một bộ hoàn toàn mới?`,
            "Ghi đè (Sửa cũ)",
            "save",
            false,
            () => { // onConfirm: Overwrite
                const updatedPreset = {
                    id: existing.id,
                    name: existing.name,
                    values: Object.assign({}, values)
                };
                const msg = `Đã cập nhật preset: ${name}`;
                savePresetData(updatedPreset, currentPresets, msg);
            },
            { // altInfo: Save New
                text: "Tạo mới (Bản sao)",
                icon: "add",
                onAlt: () => {
                    let newName = `${name} (1)`;
                    let counter = 1;
                    while (currentPresets.find(p => p.name.toLowerCase() === newName.toLowerCase())) {
                        counter++;
                        newName = `${name} (${counter})`;
                    }
                    const newPreset = {
                        id: "preset_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                        name: newName,
                        values: values
                    };
                    savePresetData(newPreset, currentPresets, `Đã lưu bản sao: ${newName}`);
                }
            }
        );
    } else {
        const newPreset = {
            id: "preset_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            name: name,
            values: values
        };
        savePresetData(newPreset, currentPresets, `Đã lưu preset: ${name}`);
    }
});

$("dockSavePreset")?.addEventListener("click", () => {
    $("btnSavePreset")?.click();
});

// Auto Sync Current Settings
let syncTimeout = null;
function syncCurrentSettings() {
    if (isApplyingRemoteSettings || !currentUser) return;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        const values = {};
        CUSTOM_PRESET_KEYS.forEach(key => {
            const el = $(key);
            if (el) values[key] = el.type === "checkbox" ? el.checked : el.value;
        });

        // ONLY sync URL-based images to currentSettings to avoid crashing Firebase with huge Base64 strings
        if (window.customWMDataURL && !window.customWMDataURL.startsWith("data:image")) {
            values.customWMDataURL = window.customWMDataURL;
        }
        if (window.customLogoDataURL && !window.customLogoDataURL.startsWith("data:image")) {
            values.customLogoDataURL = window.customLogoDataURL;
        }

        db.ref(`users/${currentUser.uid}/currentSettings`).set(values).catch(console.error);
    }, 1000);
}

/* ===== Theme / Lang buttons ===== */
$("btnTheme").addEventListener("click", cycleTheme);
$("btnLang").addEventListener("click", toggleLang);

document.querySelectorAll("[data-theme-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
        setTheme(btn.getAttribute("data-theme-pick"));
        snack(`${t("theme")}: ${getTheme().toUpperCase()}`, "ok");
    });
});

document.querySelectorAll("[data-lang-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
        setLang(btn.getAttribute("data-lang-pick"));
        snack(`Language: ${getLang().toUpperCase()}`, "ok");
    });
});

/* ===== Mobile dock ===== */
document.querySelectorAll(".mobileDock .dockBtn").forEach(btn => {
    btn.addEventListener("click", () => {
        // Toggle active class
        document.querySelectorAll(".mobileDock .dockBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Execute corresponding action
        const id = btn.id;
        if (id === "dockUpload") {
             $("inPhotos")?.click();
        } else if (id === "dockPreview") {
             $("btnLivePreview")?.click();
        } else if (id === "dockSavePreset") {
             $("btnSavePreset")?.click();
        } else if (id === "dockRun") {
             if (!$("btnRun2")?.disabled) runBatch();
        }
    });
});

/* ===== Main PROCESS ===== */
async function runBatch() {
    if (processing) return;
    if (!items.length) {
        setStatus(t("status_need_images"), "error");
        snack(t("status_need_images"), "warn");
        return;
    }

    processing = true;
    ready();
    updateBatchButtons();
    setProgress(0);
    setStatus(t("status_start"), "auto_fix_high");

    try {
        await loadAssets();

        const OUT_FORMAT = $("OUT_FORMAT").value;
        const JPG_QUALITY = clamp(+$("JPG_QUALITY").value || 10, 1, 12);
        const OUT_SIZE = clamp(+$("OUT_SIZE").value || 2000, 256, 6000);
        const BG_BLUR = clamp(+$("BG_BLUR").value || 45, 0, 200);
        const BG_SCALE = clamp(+$("BG_SCALE").value || 115, 100, 250);

        const WM_OPACITY = clamp(+$("WM_OPACITY").value || 100, 0, 100);
        const WM_POSITION = $("WM_POSITION").value || "full";
        const WM_TARGET_W = clamp(+$("WM_TARGET_W").value || 300, 40, 4000);
        const LOGO_TARGET_W = clamp(+$("LOGO_TARGET_W").value || 160, 20, 2000);
        const LOGO_MARGIN = clamp(+$("LOGO_MARGIN").value || 28, 0, 3000);

        const LOGO_PLATE_PADDING = clamp(+$("LOGO_PLATE_PADDING").value || 14, 0, 300);
        const LOGO_PLATE_BLUR = clamp(+$("LOGO_PLATE_BLUR").value || 18, 0, 120);
        const LOGO_PLATE_OPACITY = clamp(+$("LOGO_PLATE_OPACITY").value || 40, 0, 100);
        const LOGO_PLATE_COLOR = $("LOGO_PLATE_COLOR").value || "black";

        // New Inputs
        const LOGO_POSITION = $("LOGO_POSITION").value || "TL";
        const ENABLE_PLATE = $("enablePlate").checked;

        const enableTextWM = $("enableTextWM").checked;
        const textConfig = {
            enabled: enableTextWM,
            text: $("wmText").value || "",
            size: clamp(+$("wmTextSize").value || 60, 10, 500),
            opacity: clamp(+$("wmTextOpacity").value || 30, 0, 100),
            color: $("wmTextColor").value || "black",
            repeats: clamp(+$("wmTextRepeats").value || 3, 1, 10),
            font: $("wmTextFont").value || "Inter",
            weight: $("wmTextWeight").value || "300"
        };

        for (let i = 0; i < items.length; i++) {
            const it = items[i];

            const src = await fileToImageSource(it.file);

            const canvas = renderOne({
                src,
                wm: wmImg,
                logo: logoImg,
                OUT_SIZE, BG_BLUR, BG_SCALE,
                WM_POSITION, WM_TARGET_W,
                LOGO_TARGET_W, LOGO_MARGIN,
                LOGO_PLATE_PADDING, LOGO_PLATE_BLUR,
                LOGO_PLATE_OPACITY, LOGO_PLATE_COLOR,
                LOGO_POSITION,
                ENABLE_PLATE,
                WM_OPACITY,
                textConfig
            });

            try {
                if (src && typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement) {
                    if (/^blob:/.test(src.src)) URL.revokeObjectURL(src.src);
                }
            } catch (e) { }

            const blob = await canvasToBlob(canvas, OUT_FORMAT, quality12ToCanvasQ(JPG_QUALITY));

            const ext = OUT_FORMAT === "png" ? ".png" : ".jpg";
            const outName = `${baseName(it.name)}_${OUT_SIZE}${ext}`;

            if (it.outURL) { URL.revokeObjectURL(it.outURL); it.outURL = null; }

            it.outBlob = blob;
            it.outName = outName;
            it.outURL = URL.createObjectURL(blob);

            const pct = ((i + 1) / items.length) * 100;
            setProgress(pct);
            setStatus(`${t("status_start")} ${i + 1}/${items.length}`, "auto_fix_high");

            await new Promise(r => setTimeout(r, 0));
        }

        renderOutputThumbs();
        updateKPIs();
        updateBatchButtons();
        setStatus((I18N[getLang()] || I18N.vi).status_done(items.length), "check_circle");
        snack(t("snack_done"), "ok");
    } catch (err) {
        console.error(err);
        setStatus((I18N[getLang()] || I18N.vi).status_err(err?.message || String(err)), "error");
        snack(err?.message || String(err), "err");
    } finally {
        processing = false;
        ready();
        updateBatchButtons();
    }
}

// $("btnRun").addEventListener("click", runBatch);
$("btnRun2").addEventListener("click", runBatch);

/* ===== Legacy Preview Function Removed (Moved to OpenInteractivePreview above) ===== */


/* ===== Download ALL (ZIP) ===== */
$("btnDownloadAll").addEventListener("click", async () => {
    if (processing) return;
    if (!isProcessedAll()) return;

    try {
        setStatus(t("status_zip"), "archive");
        const zip = new JSZip();

        for (const it of items) {
            if (it.outBlob) zip.file(it.outName, it.outBlob);
        }

        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        const zipName = ($("zipName").value || "output.zip").replace(/\.zip$/i, "") + ".zip";
        downloadBlob(blob, zipName);
        snack((I18N[getLang()] || I18N.vi).snack_downloaded(zipName), "ok");
        setStatus((I18N[getLang()] || I18N.vi).status_done(items.length), "check_circle");
    } catch (err) {
        console.error(err);
        snack(err?.message || String(err), "err");
        setStatus((I18N[getLang()] || I18N.vi).status_err(err?.message || String(err)), "error");
    }
});

/* ===== Keyboard shortcuts (nice) ===== */
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!$("btnRun2").disabled) runBatch();
    }
});

/* ===== Init ===== */
(function init() {
    applyLang();
    updateThemeUI();
    updateLangUI();

    setMode("none");
    updateKPIs();
    setStatus(t("no_result"), "info");
    setProgress(0);

    // Attach Live Preview Listener
    const btnPrev = $("btnLivePreview");
    if (btnPrev) {
        console.log("Attaching Live Preview listener");
        btnPrev.addEventListener("click", async () => {
            console.log("Live Preview Clicked");
            try {
                await previewFirstItem();
            } catch (err) {
                console.error("Live Preview error:", err);
                snack("Lỗi xem trước: " + (err?.message || String(err)), "err");
            }
        });
    } else {
        console.error("btnLivePreview not found in init");
    }

    // Render custom presets on load
    renderCustomPresets();
})();

/* ============== StackBlur Algorithm (Fast Gaussian Blur) for Safari ============== */
function stackBlurCanvasRGB(context, top_x, top_y, width, height, radius) {
    if (isNaN(radius) || radius < 1) return;
    radius |= 0;

    let imageData;
    try {
        imageData = context.getImageData(top_x, top_y, width, height);
    } catch (e) { return; }

    const pixels = imageData.data;
    const wm = width - 1;
    const hm = height - 1;
    const wh = width * height;
    const div = radius + radius + 1;

    const r = []; const g = []; const b = [];
    let r_in_sum, g_in_sum, b_in_sum, r_out_sum, g_out_sum, b_out_sum, r_sum, g_sum, b_sum;
    let p, yp, yi, yw;
    const vmin = [];

    const div_sum = (div + 1) >> 1;
    const div_sum_sq = div_sum * div_sum;
    const dv = [];
    for (let i = 0; i < 256 * div_sum_sq; i++) dv[i] = (i / div_sum_sq) | 0;

    yw = yi = 0;

    const stack = [];
    for (let i = 0; i < div; i++) stack[i] = [0, 0, 0];

    let stack_ptr, stack_start;
    let r0, g0, b0, r1, g1, b1;

    // Horizontal Blur
    for (let y = 0; y < height; y++) {
        r_in_sum = g_in_sum = b_in_sum = r_sum = g_sum = b_sum = 0;
        r_out_sum = g_out_sum = b_out_sum = 0;
        r0 = pixels[yi]; g0 = pixels[yi + 1]; b0 = pixels[yi + 2];

        for (let i = 0; i <= radius; i++) {
            stack[i] = [r0, g0, b0];
            r_sum += r0 * (i + 1);
            g_sum += g0 * (i + 1);
            b_sum += b0 * (i + 1);
            r_out_sum += r0; g_out_sum += g0; b_out_sum += b0;
        }
        for (let i = 1; i <= radius; i++) {
            p = yi + ((Math.min(i, wm)) << 2);
            r1 = pixels[p]; g1 = pixels[p + 1]; b1 = pixels[p + 2];
            stack[i + radius] = [r1, g1, b1];
            r_sum += r1 * (radius + 1 - i);
            g_sum += g1 * (radius + 1 - i);
            b_sum += b1 * (radius + 1 - i);
            r_in_sum += r1; g_in_sum += g1; b_in_sum += b1;
        }
        stack_ptr = radius;

        for (let x = 0; x < width; x++) {
            pixels[yi] = dv[r_sum]; pixels[yi + 1] = dv[g_sum]; pixels[yi + 2] = dv[b_sum];

            r_sum -= r_out_sum; g_sum -= g_out_sum; b_sum -= b_out_sum;

            stack_start = stack_ptr - radius + div;
            const sir0 = stack[stack_start % div];

            r_out_sum -= sir0[0]; g_out_sum -= sir0[1]; b_out_sum -= sir0[2];

            if (y === 0) vmin[x] = Math.min(x + radius + 1, wm);
            p = (yw + vmin[x]) << 2;

            sir0[0] = pixels[p]; sir0[1] = pixels[p + 1]; sir0[2] = pixels[p + 2];

            r_in_sum += sir0[0]; g_in_sum += sir0[1]; b_in_sum += sir0[2];
            r_sum += r_in_sum; g_sum += g_in_sum; b_sum += b_in_sum;

            stack_ptr = (stack_ptr + 1) % div;
            const sir1 = stack[stack_ptr % div];

            r_out_sum += sir1[0]; g_out_sum += sir1[1]; b_out_sum += sir1[2];
            r_in_sum -= sir1[0]; g_in_sum -= sir1[1]; b_in_sum -= sir1[2];

            yi += 4;
        }
        yw += width;
    }

    // Vertical Blur
    for (let x = 0; x < width; x++) {
        g_in_sum = b_in_sum = r_in_sum = g_sum = b_sum = r_sum = 0;
        g_out_sum = b_out_sum = r_out_sum = 0;
        yi = x << 2;
        r0 = pixels[yi]; g0 = pixels[yi + 1]; b0 = pixels[yi + 2];

        for (let i = 0; i <= radius; i++) {
            stack[i] = [r0, g0, b0];
            r_sum += r0 * (i + 1);
            g_sum += g0 * (i + 1);
            b_sum += b0 * (i + 1);
            r_out_sum += r0; g_out_sum += g0; b_out_sum += b0;
        }
        for (let i = 1; i <= radius; i++) {
            p = (Math.min(i, hm) * width + x) << 2;
            r1 = pixels[p]; g1 = pixels[p + 1]; b1 = pixels[p + 2];
            stack[i + radius] = [r1, g1, b1];
            r_sum += r1 * (radius + 1 - i);
            g_sum += g1 * (radius + 1 - i);
            b_sum += b1 * (radius + 1 - i);
            r_in_sum += r1; g_in_sum += g1; b_in_sum += b1;
        }
        stack_ptr = radius;

        for (let y = 0; y < height; y++) {
            p = (y * width + x) << 2;
            pixels[p] = dv[r_sum]; pixels[p + 1] = dv[g_sum]; pixels[p + 2] = dv[b_sum];

            r_sum -= r_out_sum; g_sum -= g_out_sum; b_sum -= b_out_sum;

            stack_start = stack_ptr - radius + div;
            const sir0 = stack[stack_start % div];

            r_out_sum -= sir0[0]; g_out_sum -= sir0[1]; b_out_sum -= sir0[2];

            p = (Math.min(y + radius + 1, hm) * width + x) << 2;
            sir0[0] = pixels[p]; sir0[1] = pixels[p + 1]; sir0[2] = pixels[p + 2];

            r_in_sum += sir0[0]; g_in_sum += sir0[1]; b_in_sum += sir0[2];
            r_sum += r_in_sum; g_sum += g_in_sum; b_sum += b_in_sum;

            stack_ptr = (stack_ptr + 1) % div;
            const sir1 = stack[stack_ptr % div];

            r_out_sum += sir1[0]; g_out_sum += sir1[1]; b_out_sum += sir1[2];
            r_in_sum -= sir1[0]; g_in_sum -= sir1[1]; b_in_sum -= sir1[2];
        }
    }

    context.putImageData(imageData, top_x, top_y);
}

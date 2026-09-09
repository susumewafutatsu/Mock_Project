# Mock Project — Frontend

Giao diện nền tảng ôn tập & thi trực tuyến JLPT.
React 19 · Vite · React Router · lucide-react.

Backend nằm ở repo riêng: <https://github.com/susumewafutatsu/Mock_Pj>

---

## Chạy lần đầu — 3 bước

### 1. Cần có sẵn
- **Node.js 20 trở lên** (`node -v`)
- **Backend đang chạy** ở `http://localhost:8080` — xem README của repo backend

### 2. Cài thư viện

```bash
cd admin-ui
npm install
```

### 3. Chạy

```bash
npm run dev
```

Mở <http://localhost:5173>.

File `.env` đã có sẵn trong repo và trỏ đúng vào `localhost:8080` nên **không phải
cấu hình gì thêm**. Chỉ khi backend chạy ở cổng khác mới cần sửa nó.

---

## Tài khoản để thử

Mật khẩu tất cả là `demo1234` (dữ liệu mẫu do backend nạp sẵn):

| Vai | Email | Vào thấy gì |
|---|---|---|
| Thí sinh | `student1@demo.local` | Khoá học · Thẻ ghi nhớ · Sổ tay câu sai · Phòng thi · Đề tự do |
| Người ra đề | `teacher@demo.local` | Quản lý đề thi · Phòng thi · Khoá học · Ngân hàng câu hỏi |
| Quản trị viên | `admin@demo.local` | Hàng đợi duyệt khoá học |

---

## Cấu trúc thư mục

```
src/
├── pages/
│   ├── auth/       đăng nhập, đăng ký, callback Google
│   ├── admin/      Dashboard — hàng đợi duyệt khoá học
│   ├── teacher/    ExamManager (khung chính) · RoomManager · CourseManager · QuestionBank
│   └── student/    ExamList (khung chính) · Courses · Flashcards · MistakeBook · ExamRoom
├── services/       gọi API, mỗi mảng nghiệp vụ một file
├── context/        AuthContext
├── hooks/          useAuth · useExamTimer
└── utils/          constants.js
```

**Lưu ý về điều hướng:** `ExamManager.jsx` (người ra đề) và `ExamList.jsx` (thí
sinh) là hai *khung chính* — các màn hình khác hiện bên trong chúng qua state
`activeNav` chứ không phải route riêng. Thêm màn hình mới thì phải khai vào
`NAV_ITEMS` / `NAV_GROUPS` **và** thêm nhánh render, thiếu một trong hai là nút
bấm không ra gì.

---

## Quy ước cần biết trước khi sửa code

### Chữ Nhật phải có `className="jp"` và `lang="ja"`
Font mặc định không có glyph tiếng Nhật, nên chữ Hán rơi xuống font hệ thống —
trên Windows thường là font Trung, mà chữ Hán Nhật và Trung khác tự dạng ở nhiều
chữ (直, 骨, 今). Thiếu hai thuộc tính này thì **người học thuộc nhầm mặt chữ mà
không biết**.

```jsx
<p className="st-lesson-body jp" lang="ja">{content}</p>
```

### Màu lấy từ token trong `index.css`, không viết mã hex thẳng
Ba màu ngữ nghĩa có ý nghĩa cố định, không được mượn để trang trí:
`--jade` = đúng/đạt · `--cinnabar` = sai/lỗi · `--gold` = cần chú ý/đang chờ.

### Nội dung do người dùng nhập không bao giờ đổ vào `dangerouslySetInnerHTML`
Bài học hiển thị bằng CSS `white-space: pre-wrap`. Nội dung do người ra đề nhập;
dựng HTML từ chuỗi đó là mở đường XSS lên mọi thí sinh đọc bài.

### Server là nguồn sự thật của thời gian và điểm số
Client không tự tính thời gian còn lại, không tự chấm đáp án, không tự tính phần
trăm tiến độ. Hai bên tính riêng là hai chỗ có thể lệch nhau.

---

## Lệnh hay dùng

```bash
npm run dev      # chạy dev server
npm run build    # build production, kiểm tra lỗi cú pháp
npm run lint     # oxlint
```

# PR01 — Bảo toàn kết quả khi nộp bài lặp

Ngày 28/10/2026. Nhánh: `fix/v3-submit-idempotency`, tách từ `main` tại `ad71eade4af43f27663a0fa7f8c16f76c10157a5`.

Phạm vi được duyệt: chỉ nhiệm vụ 1, sửa nộp bài lặp. Không triển khai chức năng V4, chính sách deadline/grace window, ba chế độ công bố hoặc chuyển lớp. Không deploy, không migration, không gọi database production. Thay đổi chỉ là code và test local; không sửa điểm đã tồn tại.

## Vấn đề và hành vi sau sửa

Trước sửa, transaction có `results/{attemptId}` vẫn dựng lại payload từ request mới và ghi merge vào kết quả, thêm `regradedAt`. Gửi A đúng rồi B sai đổi score 10 → 0. API còn dựng response từ phép chấm request hiện tại nên có thể trả dữ liệu khác kết quả chính thức, nhất là khi request tranh chấp.

Sau sửa:

1. Route chỉ parse request và lấy thời gian server, gọi transaction; không chấm trước transaction.
2. Transaction đọc attempt mới nhất, xác thực studentId/studentCode, đọc kết quả canonical và resultId đã liên kết, assignment mới/cũ trong read set.
3. Nếu có kết quả, trả dữ liệu đã lưu; không gọi `prepareSubmit`, không update attempt, không set/merge result, không thêm `regradedAt`, không sửa metadata/đáp án/anti-cheat/autoSubmit/timestamp.
4. Nếu chưa có kết quả và attempt hợp lệ, đọc học sinh, validate và chấm bằng snapshot trong cùng transaction; ghi result + finalize attempt đồng thời. Firestore retry phải đọc lại attempt/kết quả trước khi quyết định chấm.
5. Response lấy summary và review qua DTO allowlist từ result do transaction trả, cho cả request thắng và request retry. Không lấy phép chấm của request thua.

Hai request cùng đọc trạng thái chưa nộp có thể tính điểm ứng viên trước commit; chỉ transaction thắng ghi kết quả. Callback retry thấy kết quả chính thức sẽ dừng trước bộ chấm và trả kết quả thắng. Không có tác vụ network/side effect ngoài Firestore trong callback.

## Tương thích và dữ liệu không nhất quán

- Giữ endpoint, request body và shape response học sinh. Không cần đổi client.
- `resultId` legacy khác attemptId được đọc đúng, không tạo bản canonical trùng.
- Attempt submitted hoặc có resultId nhưng không tìm thấy result: trả 409 để kiểm tra dữ liệu; không báo thành công giả và không tái tạo bằng request mới.
- Hai vị trí canonical/linked mâu thuẫn, hoặc identity trong result mâu thuẫn attempt: trả 409, không sửa/chọn đè dữ liệu.
- Result tồn tại nhưng attempt chưa finalize: trả result, không tự repair attempt trong request submit.
- Replay vẫn đối chiếu identity trên attempt; không bắt nguồn chấm còn tồn tại hoặc roster hiện tại còn giống lúc thi. First submit vẫn kiểm tra học sinh active và lớp được giao như trước.
- Assignment mất: replay trả xác nhận đã nộp, summary null, không answerReview. Không có cơ sở xác định quyền công bố thì không tiết lộ dữ liệu.
- Result legacy thiếu các field số summary: summary null, không suy ra điểm/counters từ đáp án hoặc tái chấm. Detail đủ cấu trúc vẫn qua allowlist theo quyền hiện tại.
- Quyền công bố tiếp tục dùng resolver hiện tại. Lỗi `hidden` đã biết vẫn thuộc nhiệm vụ 3 chưa triển khai; PR này không được coi là đã giải quyết chống lộ kết quả cho cả ba chế độ. Test kiểm tra behavior hiện có của after_close và showCorrectAnswers=false để tránh regression.
- Chính sách hết hạn attempt, assignment deadline và autosave race ở endpoint progress chưa được sửa. Chúng thuộc các nhiệm vụ sau; không đánh đồng bảo vệ submit replay với hoàn thành toàn bộ gói ổn định.

## File trong PR01

| File | Mục đích |
|---|---|
| `src/app/api/student/submit/route.ts` | Chuyển toàn bộ orchestration submit vào transaction |
| `src/features/exam/server/submit-transaction.ts` | Read-before-grade, result bất biến, identity, legacy pointer và conflict |
| `src/features/exam/server/submit-response.ts` | Public DTO từ kết quả chính thức, không dùng chấm request mới |
| `src/features/exam/server/submit-types.ts` | Transaction trả result + settings để dựng response |
| `src/features/exam/server/submit-transaction.test.ts` | Regression, concurrency, legacy/error cases |
| `src/features/exam/server/__tests__/transaction-store.ts` | In-memory optimistic transaction harness có read versions, staged writes và retry |
| `src/app/api/student/submit/route.test.ts` | Test handler thật, transaction thật và response; mock chỉ database; spy bộ chấm |
| `vitest.config.mts` | Resolve alias `@` cho tests server/API; không thay config runtime |
| `docs/v4/06-pr01-submit-idempotency.md` | Báo cáo review, validation và rollback |

Các thay đổi có sẵn ở `.gitignore`, DOCX parser/test, `.npm-cache/` và hồ sơ audit trước đó không được đưa vào commit PR01. Không xóa hoặc sửa chúng.

## Bằng chứng test trước và sau

Trước sửa chạy regression cùng/khác đáp án trên contract V3 hiện tại, không chỉ test contract mới:

```text
npm test -- src/features/exam/server/submit-transaction.test.ts -t 'replay answer'
2 failed
- replay A: kết quả bị thêm regradedAt
- replay B: answers q1 A → B, score 10 → 0, percentage 100 → 0,
  detail/counters/rawScore bị ghi lại
```

Sau sửa:

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | PASS, 10 test files / 78 tests; 26 test mới cho submit |
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0; chỉ là TypeScript, **không phải kiểm tra ESLint** |
| `npm run build` | PASS, exit 0; compile + TypeScript + 60/60 static pages |
| `git diff --check` | PASS |

Các ca mới: first submit atomic; replay cùng/khác đáp án không ghi bất kỳ field nào; 20 request khác đáp án đồng thời ở mức transaction và handler; có xung đột/retry thực trong harness, chỉ một winner và hai write tổng cộng (result + attempt); response mọi request khớp winner; source snapshot không còn hợp lệ; legacy result pointer; missing official result; submitted thiếu pointer; wrong identity; result identity conflict; canonical/linked conflict; attempt chưa finalize; first submit từ testAssignments; lỗi chấm không partial write; missing attempt; policy after_close/no answers; source/student đã mất; legacy summary thiếu field; review ba dạng câu không spread explanation/private document.

### Giới hạn bằng chứng

Concurrency tests là mô hình optimistic transaction có version conflict/retry trong bộ nhớ, không phải Firestore Emulator hoặc production. `java -version` báo không có Java runtime; chưa chạy Emulator, E2E trình duyệt hoặc kiểm tra tải thực Firebase. Handler tests gọi `POST` thật với Request/NextResponse và transaction logic thật; database được thay bằng harness nên chưa chứng minh SDK/network behavior trên staging.

Trước merge/phát hành nên chạy lại ca concurrent/replay trên Firestore Emulator hoặc project staging được phê duyệt. Không tự dùng credential `.env.local` để kiểm chứng trên production. Build có thể đọc config môi trường local như baseline, không khởi chạy ứng dụng/các API nghiệp vụ.

## Rủi ro và rollback

- Chấm lần đầu chuyển vào transaction: source assignment/student thay đổi đồng thời gây retry; chấm thuần không tạo side effect ngoài transaction. Chưa đo contention/tải thực.
- Dữ liệu legacy thiếu/mâu thuẫn có thể nhận 409 hoặc summary null thay vì thành công với điểm vừa tái tính. Đây là cách bảo toàn dữ liệu; cần đối soát riêng, không sửa tự động.
- Replay không repair metadata attempt nên dữ liệu lỗi cũ cần quy trình kiểm tra riêng, không được sửa bằng submit.
- Rollback code bằng revert commit PR01/merge commit, không rollback hoặc migration database. Revert sẽ khôi phục lỗi ghi đè cũ; nếu phải rollback ở môi trường phát hành cần phương án tạm ngừng retry/submit hoặc hotfix được duyệt để không mở lại đường sửa điểm. Không tự thực hiện rollback production.

Chỉ một thay đổi PR01 được chuẩn bị; chưa triển khai các PR/nhiệm vụ khác.

**AWAITING APPROVAL — chờ duyệt PR01 và chỉ đạo trước nhiệm vụ tiếp theo.**


## Bổ sung review theo phê duyệt có điều kiện

### Emulator và CI

Đã thêm `tests/integration/submit.emulator.test.ts` với 9 ca: hai request cùng đáp án; hai request khác đáp án; replay sau khi request trước commit; SDK retry khi injected ABORTED và một submit khác đã commit; thiếu official result; mâu thuẫn bốn trường identity. Test gọi POST thật và Firebase Admin SDK thật, không dùng in-memory store. Trường hợp ABORTED là **fault injection có chủ đích**, không được gọi là lỗi xung đột do backend tự phát sinh; hai ca chạy đồng thời kiểm contention thật nhưng không bắt buộc backend phải retry.

Test khởi tạo client riêng bằng project `demo-kiemtraai-submit`, bắt buộc `FIRESTORE_EMULATOR_HOST=127.0.0.1:8089`, không import credential ứng dụng. Host sai/thiếu sẽ fail trước database access. Fixture IDs ngẫu nhiên, không có lệnh xóa toàn database. Config riêng `firebase.emulator.json` không thay Firebase config/rules/indexes production.

`npm run test:emulator` local đã thực sự thử và **FAIL trước khi chạy tests** vì `java -version` exit 1 (không có Java runtime). Không có ca Emulator nào được xác nhận PASS local. `npm run typecheck:emulator` PASS chỉ chứng minh TypeScript của bộ integration, không chứng minh Emulator chạy.

Workflow `.github/workflows/pr01-submit-review.yml` chạy trên pull_request về main với Node 22 và Java 21, npm ci, build, typecheck, typecheck:emulator, toàn unit tests và test:emulator. Không dùng secrets/credential production, permissions contents:read, không có bước deploy/merge. Build dùng config Firebase demo giả. Hướng dẫn nền tảng: [Firebase Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore), [emulators:exec/CI](https://firebase.google.com/docs/emulator-suite/install_and_configure). Cần kiểm tra kết quả CI thực tế sau mở PR; không suy ra thành công từ việc thêm workflow.

File bổ sung: workflow, firebase.emulator.json, vitest.emulator.config.mts, tsconfig.emulator.json, tests/integration/submit.emulator.test.ts, src/lib/api/client.test.ts. Cập nhật scripts package.json, exclude integration khỏi unit runner trong vitest.config.mts và báo cáo này. Không đổi dependency/lockfile.

### Kiểm tra 409 và UI học sinh

`submit/route.ts` dùng resolveApiError giữ statusCode=409 và JSON `{status:"error",message}`. Hai unit tests mới cho `src/lib/api/client.ts` xác nhận postJSON reject và giữ nguyên thông báo tiếng Việt cho thiếu result và identity conflict. Test handler trước đó xác nhận missing result trả 409, không gọi chấm, không có summary. Integration kiểm tra thêm bốn field identity conflict.

Review tĩnh `app/exam/[assignmentCode]/page.tsx`: submit catch giữ màn hình làm bài, không setSubmitted(true), nhả submit lock và hiển thị Error.message trong message banner màu đỏ. Không có UI riêng theo HTTP status vì postJSON hiện chỉ ném Error, không giữ statusCode. Khi timer đã hết, catch reset autoSubmitTriggeredRef nên timer có thể tiếp tục retry lỗi dữ liệu vĩnh viễn; chưa sửa do phạm vi chỉ yêu cầu kiểm tra UI và chưa duyệt thay đổi auto-submit. Chưa có browser E2E/chứng cứ screenshot; không tuyên bố đã test UI end-to-end. Đề xuất xử lý non-retryable 409 riêng trong PR sau khi duyệt.

### Đánh giá các đường ghi khác

Cần thêm kiểm thử bất biến xuyên API trong giai đoạn sau; PR01 chỉ chứng minh submit không ghi đè result, không phải bất biến toàn hệ thống:

- `api/student/progress/route.ts` chỉ ghi examAttempts, nhưng get/status check và update tách rời; một autosave đến trễ có thể đổi answers trên attempt sau submit. Result chính thức không được progress ghi trực tiếp. Cần test progress-vs-submit race trước PR xử lý concurrency.
- `api/student/start/route.ts` resume/expire cũng ghi attempt ngoài transaction; cần test resume-vs-submit cho trạng thái finalized.
- `api/teacher/students/route.ts` transfer cập nhật lớp trên results và attempts. Đây là nhiệm vụ 4 đã biết, chưa sửa hoặc chạy migration.
- `api/admin/migrate-school-id/route.ts` có thể cập nhật metadata schoolId trên results; migration cần manifest/approval riêng và regression assertions không đổi score/answers/detail. Không gọi endpoint này.
- Firestore rules local default deny client writes vào results. Nên bổ sung negative rules tests có authenticated roles; Admin SDK vẫn bỏ qua rules nên mỗi API writer cần test riêng.

Kiểm tra local mới nhất trên working tree: 11 file / 80 unit tests PASS; typecheck, typecheck:emulator, lint (chỉ TypeScript) và build PASS. Có sửa DOCX chưa commit của người dùng nên số test CI trên checkout sạch có thể khác; chỉ tính kết quả CI khi có run thực.

### Xuất bản và gate merge

SSH push thất bại do thiếu khóa; HTTPS Git push thất bại vì không có credential. Nếu xuất bản qua GitHub connector, commit metadata/SHA remote khác commit local nhưng phải đối chiếu **Git tree SHA bằng nhau**, giữ source commit `185fb96` trong PR để truy vết. Không ghi lại lịch sử local hoặc đưa sửa DOCX/.gitignore vào nhánh review.

Kết luận trước khi có CI: **BLOCKED** cho merge — Emulator local chưa chạy và CI cần có kết quả thực; UI 409 chỉ được review tĩnh + kiểm tra Error propagation. Không bắt đầu nhiệm vụ 2–4.

**AWAITING MERGE APPROVAL**


## Kết quả CI thực tế và kết luận review

[PR #1](https://github.com/hoanglongha9x/kiemtraai/pull/1), base main, draft/open, chưa merge. Source local `185fb96` + `9a0689a` được xuất bản qua connector thành remote `dc305c4eefd3b97deebe8105d66afcfc9f7c406c`; Git tree hai bên trùng `809ee02767c0e61d574b788a56269b8688c3239e`. Commit bổ sung báo cáo sau đây chỉ đổi Markdown, không thay runtime/test/config đã kiểm chứng.

[CI run 40660016616](https://github.com/hoanglongha9x/kiemtraai/actions/runs/40660016616), job verify 122720411464: **SUCCESS**, hoàn thành 28/10/2026 lúc khoảng 15:55 (Asia/Ho_Chi_Minh). Workflow kiểm tra PR merge ref tạm do GitHub sinh, không phải merge vào main.

| Kiểm tra trên CI | Kết quả thực tế |
|---|---|
| npm ci | PASS |
| npm run build | PASS, Next.js 16.2.12, 60/60 static pages |
| npm run typecheck | PASS |
| npm run typecheck:emulator | PASS |
| npm test | PASS, 11 file / **79 tests** |
| npm run test:emulator | PASS, 1 file / **9 tests**, exit 0 |

Firestore Emulator v1.22.0 thực sự khởi động với Java 21 trên Ubuntu và project demo; integration tests mất khoảng 9,41 giây. Retry fault injection test PASS; concurrent A/A, A/B, replay đã commit, missing result và identity conflicts đều PASS. Điều này thay thế trạng thái BLOCKED/pending CI ở phần lịch sử trước đó. Local Emulator vẫn không chạy do thiếu Java; không đồng nhất kết quả local với CI.

Đã checkout sạch commit remote ở worktree detached và chạy lại unit tests local: **79/79 PASS**. Working tree chính có 80 test do một test DOCX chưa commit của chủ dự án; khác biệt này không nằm trong PR. So sánh danh sách file PR từ GitHub khớp 16 file đã rà soát; scan mẫu private keys/GitHub tokens/Firebase API key trên nội dung diff không phát hiện. Đây là kiểm tra theo pattern, không phải chứng nhận không có mọi loại secret.

16 file chính xác trong PR:

```text
.github/workflows/pr01-submit-review.yml
docs/v4/06-pr01-submit-idempotency.md
firebase.emulator.json
package.json
src/app/api/student/submit/route.test.ts
src/app/api/student/submit/route.ts
src/features/exam/server/__tests__/transaction-store.ts
src/features/exam/server/submit-response.ts
src/features/exam/server/submit-transaction.test.ts
src/features/exam/server/submit-transaction.ts
src/features/exam/server/submit-types.ts
src/lib/api/client.test.ts
tests/integration/submit.emulator.test.ts
tsconfig.emulator.json
vitest.config.mts
vitest.emulator.config.mts
```

Rủi ro còn lại giữ nguyên: chưa browser E2E; UI có thể retry 409 vĩnh viễn khi hết giờ; retry test dùng injected ABORTED chứ không buộc backend tự abort; chưa load test production; các writer khác chưa có cam kết bất biến toàn hệ thống. Log npm ci còn báo 48 dependency vulnerabilities (gồm 2 critical), chưa đánh giá khả năng khai thác trong ứng dụng và không nâng dependency trong PR01. Actions hiện chạy được nhưng có cảnh báo deprecated action runtime; không đổi toolchain ngoài nhu cầu test đã duyệt.

**Kết luận: READY TO MERGE trong phạm vi sửa submit idempotency của PR01**, dựa trên CI thực tế thành công và các giới hạn đã ghi rõ. Không đồng nghĩa hệ thống V3 đã hoàn tất gói ổn định hoặc được phép phát hành production. PR giữ draft để chủ dự án review/duyệt, không tự merge hoặc triển khai. Nhiệm vụ 2–4 chưa bắt đầu.

**AWAITING MERGE APPROVAL**


## Sửa regression P1: xác thực quyền đọc replay hiện tại

Phần này thay thế chính sách replay thiếu kiểm tra hồ sơ và kết luận READY cũ ở trên. Review cuối phát hiện tài khoản khóa/đổi mã/xóa vẫn nhận điểm và đáp án khi result đã có. Chỉ sửa regression này theo phê duyệt; không làm PR02, thay deadline/release policy hoặc sửa chuyển lớp.

- Đọc `students/{studentId}` cùng các document trong transaction, trước mọi return replay. Hồ sơ thiếu trả 404.
- Gọi `validateStudentIdentity(studentId, studentCode, student)` để kiểm active và mã hiện hành; khóa/mã sai trả 403.
- Không gọi `validateStudentClassAccess` hoặc prepareSubmit trên replay. Học sinh active đã chuyển lớp vẫn đọc kết quả lịch sử.
- Giữ nguyên nhánh replay read-only: không grade, set/update/delete result hoặc attempt; dùng snapshot student đã đọc trong lần submit đầu.
- Mỗi callback retry đọc lại hồ sơ. Không cache identity ngoài transaction.

Bằng chứng trước sửa: 6 test mục tiêu FAIL — locked/changed_code trả 200 thay 403, deleted trả 200 thay 404; ba ca xung đột không retry vì student không trong read set. Sau sửa toàn bộ **87/87 unit tests PASS** trên worktree sạch, gồm 8 ca mới về quyền/đổi lớp/retry. Test cũ về mất cả assignment và student đã được sửa: chỉ mất assignment được xác nhận đã nộp và che summary; mất student bắt buộc 404.

Emulator bổ sung 8 ca (tổng 17): khóa, đổi mã, xóa hồ sơ, chuyển lớp; lặp lại cả bốn trạng thái khi identity đổi giữa hai callback SDK retry. Dùng injected ABORTED để kích hoạt rollback/retry thật của SDK; không gọi đó là conflict backend tự phát sinh. Assertions kiểm cả data và updateTime của result/attempt bất biến; unit tests spy prepareSubmit không được gọi và dùng conflict version thực của in-memory harness. Harness chỉ thêm delete support để kiểm xóa hồ sơ lúc retry.

Local: build PASS (config demo, 60/60 trang), typecheck/typecheck:emulator/lint PASS; lint vẫn chỉ TypeScript. `npm run test:emulator` local được thử và dừng trước tests vì thiếu Java, không tính PASS. Bằng chứng chạy 17 integration tests phải lấy từ GitHub Actions của commit P1 mới, không dùng lại run 9 tests cũ. Kết quả CI và link run được ghi ở mô tả PR/checks sau khi publish.

Chỉ 5 file của lần sửa này:

```text
src/features/exam/server/submit-transaction.ts
src/app/api/student/submit/route.test.ts
src/features/exam/server/__tests__/transaction-store.ts
tests/integration/submit.emulator.test.ts
docs/v4/06-pr01-submit-idempotency.md
```

Làm việc trong worktree riêng từ remote head `fcef28e`, không thay các sửa DOCX/.gitignore của chủ dự án. Commit mới trên GitHub phải có parent là head PR hiện tại, update ref với force=false và expected_sha, không rewrite/force push. Không merge/deploy/migration hay đổi dữ liệu production.

Rollback chỉ revert commit P1 ở code; sẽ tái mở regression quyền đọc, cần chủ dự án quyết định trước khi dùng. Không rollback result/attempt trong database. Gate nghiệm thu: 403/404 đúng, chuyển lớp vẫn 200 với kết quả đã lưu, không grade/write khi replay, và toàn bộ unit + 17 Emulator tests PASS trên CI mới.

**AWAITING MERGE APPROVAL nếu CI mới đạt; BLOCKED nếu CI thất bại hoặc chưa xác minh.**

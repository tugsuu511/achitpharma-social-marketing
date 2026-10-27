# Achitpharma Social Marketing Team

Ажил төлөвлөх, ажилтны эрх удирдах, screenshot-тай гүйцэтгэл илгээх, хянах, тайлан харах Монгол хэлтэй mobile-first багийн систем. Энэ бол `kidokids-appointment-booking` төслөөс тусдаа, бие даасан төсөл.

## Асаах

Node.js **24 болон түүнээс дээш** хувилбар шаардлагатай.

```powershell
cd C:\Projects\achitpharma-social-marketing-team
npm.cmd install
neon deploy
npm.cmd run dev
```

`neon deploy` нь link хийсэн Neon branch-ийн `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH` утгуудыг git-ignored `.env.local` руу татна. Хөтөч дээр **http://localhost:3000** нээнэ. Development сервер зөвхөн тухайн компьютероос хандах `localhost` хаяг дээр ажиллана. Windows PowerShell скрипт хориглодог бол дээрх шиг `npm.cmd` ашиглана.

1. Серверийн терминалаас `npm.cmd run admin:create` ажиллуулж анхны админы нэр, имэйл, нууц үгийг оруулна. Нууц үг терминалд харагдахгүй, баталгаажуулж давтан оруулна. Админ өмнө нь үүссэн бол командыг дахин ажиллуулахад өөрчлөлт хийхгүй. Веб дээр админ бүртгүүлэх хуудас болон API байхгүй; зөвхөн нэвтрэх дэлгэц байна. Бэлэн, нийтэд мэдэгдэх нууц үг байхгүй.
2. **Манай баг → Ажилтан нэмэх**: ажилтны нэр, имэйл, албан тушаал, нууц үгийг оруулна.
3. Ажилтанд нэвтрэх мэдээллийг өөрийн сувгаар дамжуулна. Систем имэйл илгээдэггүй.
4. **Төлөвлөгөө нэмэх** товч дарж нээгдэх dialog цонхонд нэр, тайлбар, суваг, дуусах огноо, ач холбогдлыг оруулна. Админ хариуцах ажилтныг сонгоно; ажилтан зөвхөн өөрийн төлөвлөгөөг үүсгэнэ. Ажилтны оруулсан төлөвлөгөө админд харагдана.
5. Ажилтан өөрийн эрхээр нэвтэрч, ажлаа эхлүүлээд **1–5 screenshot** болон тайлбартайгаар хянуулна.
6. Админ гүйцэтгэлийг **батлах** эсвэл тайлбартай **засварт буцаана**.

Ажилтны эрх хаах болон нууц үг шинэчлэхэд хуучин нэвтрэлтүүд хүчингүй болно. Хэрэглэгч бүр «Миний бүртгэл» хэсгээс өөрийн нууц үгийг сольж болно.

## Боломжууд

- Админ, ажилтны тусдаа эрх, сервер дээрх хандалтын шалгалт.
- Ажилтны бүртгэл нэмэх, засах, нэвтрэх эрх идэвхжүүлэх/хаах, нууц үг шинэчлэх.
- Ажил үүсгэх, засах, хуваарилах; төлөв, хариуцагч, хайлтаар шүүх.
- Facebook, Instagram, TikTok, YouTube, бусад сувгийн ажлын төлөвлөгөө.
- Сарын календарь, өдрөөр хийх ажлууд, хугацаа хэтэрсэн ажлын тоо.
- «Төлөвлөгөө» самбар анх картаар харагдана. Карт дээр нэр, тайлбар, суваг, хариуцагч, хугацаа, төлөв, хавсралтын тоо гарна. Картаа дарж дэлгэрэнгүйг нээх, хайлт/төлөв/хариуцагчаар шүүх, календарь руу шилжих боломжтой.
- Нүүр, ажлын жагсаалт, календарийн сонгосон өдрийн ажлууд мөн утсанд тохирсон карттай. Шинэ төлөвлөгөө оруулах dialog нь гар утсанд доороос нээгдэнэ.
- PNG/JPG/WebP баримт хавсаргах; нэг зураг 5 MB хүртэл, нэг илгээлт 5 зураг хүртэл.
- Хувийн баримтууд: админ болон тухайн ажлыг одоо хариуцаж буй ажилтанд л харагдана.
- Ажлын харилцаа, гүйцэтгэл болон хяналтын түүх, давтан илгээлтийн баримтууд хадгалагдана.
- Ажилтан/сувгийн тайлан, огноогоор шүүх, Excel-д нээх UTF-8 CSV татах.
- 30 секунд тутам болон цонх руу буцаж ороход мэдээлэл шинэчлэгдэнэ.
- Гар утасны доод цэс, томруулсан оролтууд, дэлгэцийн хэмжээнд тохирох хэлбэрүүд.

Ажлын төлөв: **Төлөвлөсөн → Хийгдэж буй → Хянуулах → Баталсан**. Засварт буцсан ажлыг дахин илгээж болно. Төлөвлөсөн ажлыг шууд баримттай илгээхийг мөн зөвшөөрнө.

Тайлан нь сонгосон хугацаанд **дуусахаар төлөвлөсөн** ажлуудын **одоогийн төлөв** дээр үндэслэнэ. Энэ нь тухайн өнгөрсөн өдрийн төлөвийг сэргээн тооцсон тайлан биш. Хугацаа хэтрэлтийг Улаанбаатарын өнөөдрийн огноогоор тооцно; батлагдсан ажил хугацаа хэтэрсэнд орохгүй.

## Технологи ба хадгалалт

- Next.js App Router, TypeScript, React, Lucide icons.
- Neon Lakebase Postgres; app traffic pooled `DATABASE_URL`, migration direct `DATABASE_URL_UNPOOLED` ашиглана.
- Нууц үг scrypt + санамсаргүй salt; нэвтрэлтийн token-ийн зөвхөн hash хадгална.
- HttpOnly / SameSite cookie, хугацаатай session, login attempt хязгаарлалт, mutation origin шалгалт.
- Бүтэцтэй өгөгдөл Neon Postgres-д, screenshot нь `data/files` private storage-д хадгалагдана.
- `DATA_DIR` эсвэл `PRIVATE_FILES_DIR`-ээр screenshot хадгалалтын persistent disk байрлалыг тохируулна.
- `data/`, `.env*`, туршилтын өгөгдөл Git-д орохгүй.
- Үсгийн фонт Google Fonts-оос ачаалах боломжтой; холболтгүй үед Segoe UI / Arial руу шилжинэ.

Database backup/restore-ийг Neon-ийн branch history болон restore хэрэгслээр удирдана. Screenshot binary нь Neon Postgres-д биш persistent private disk дээр үлддэг тул `PRIVATE_FILES_DIR`-ийг тусдаа backup policy-д заавал хамруулна. Хуучин SQLite migration эх үүсвэрийг шалгах шаардлагатай үед л `legacy:db:backup` болон `legacy:db:restore` командуудыг ашиглана.

## Database migration

Postgres schema өөрчлөлтүүд `schema_migrations` хүснэгтэд version, нэр, checksum-тай бүртгэгдэнэ. Production `npm.cmd start` эхлэхийн өмнө direct Neon connection-оор migration автоматаар ажиллана. Гараар шалгах эсвэл ажиллуулах бол:

```powershell
npm.cmd run db:migrate
```

Migration нь advisory lock болон transaction ашиглана. SQL түүх өөрчлөгдсөн эсвэл database илүү шинэ version-тэй бол startup зогсоно. Legacy SQLite өгөгдлийг хоосон Neon schema руу нэг удаа шилжүүлэхдээ `npm.cmd run db:import-sqlite` ажиллуулна; import checksum болон хүснэгт бүрийн мөрийн тоог баталгаажуулна.

## Шалгалтууд

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run validate
```

`npm.cmd run validate` нь typecheck, unit test, production build-ийг дээрх дарааллаар ажиллуулна.

Бүрэн API integration шалгалтыг production database дээр хэзээ ч ажиллуулахгүй. Хоосон, устгаж болох Neon test branch-ийн `TEST_DATABASE_URL` болон `TEST_DATABASE_URL_UNPOOLED`-ийг өгөөд `npm.cmd run validate:integration` ажиллуулна. Screenshot файлууд `test-results/integration-*` дотор тусгаарлагдана.

## Серверт байрлуулах

```powershell
npm.cmd run build
npm.cmd start
```

Одоогийн хувилбар нь **Next.js Node.js server + Neon Postgres + screenshot-д зориулсан тогтмол диск** дээр ажиллана. Screenshot upload ашиглах үед түр filesystem-тэй serverless орчинд шууд байрлуулж болохгүй. Олон сервер ашиглах шаардлага гарвал private screenshot хадгалалтыг shared object storage руу шилжүүлнэ.

Development сервер анхнаасаа зөвхөн `localhost:3000` дээр ажиллана. Одоогийн production `npm.cmd start` команд `127.0.0.1:3100` дээр асна. Байгууллагын хэрэглээнд оруулахдаа HTTPS reverse proxy тохируулж `APP_ORIGIN=https://таны-домэйн`, абсолют `DATA_DIR`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, 32-оос урт санамсаргүй `IP_HASH_SECRET` тавина. Эдгээр тохиргоо дутуу эсвэл буруу бол production сервер асахгүй. Proxy нь хүсэлтийн body-г 26 MB-аас илүүгүйгээр хязгаарлаж, гаднаас ирсэн `X-Forwarded-For` header-ийг дарж өөрийн баталгаатай утгыг дамжуулна. Интернэтэд нээхээс өмнө эхний админ эрхээ локал орчноос үүсгэнэ.

`GET /health` нь Node.js process хариу өгч байгааг, `GET /ready` нь Neon Postgres query болон schema version хэвийн байгааг шалгана. Хоёулаа cache-гүй, authentication шаардахгүй бөгөөд дотоод өгөгдөл буцаахгүй. Бүх route дээр CSP, HSTS, Permissions Policy, frame болон MIME хамгаалалтын header тавигдана.

Одоогоор интернэтэд publish хийгдээгүй. Production build болон Neon-backed readiness/session lookup smoke шалгалт хийгдсэн; бодит төхөөрөмжийн харагдах байдал, touch ажиллагааны эцсийн шалгалтыг тусад нь хийнэ.
## Үйл ажиллагааны хяналт ба хамгаалалт

- `npm.cmd run ops:status` нь Neon холболт/schema version, хүснэгтийн мөрийн тоо, private screenshot-ийн тоо болон checksum-ийг JSON хэлбэрээр шалгана.
- `npm.cmd run ops:cleanup` нь хугацаа дууссан session/login оролдлого болон 365 хоногоос хуучин audit event-ийг цэвэрлэнэ. Үүнийг өдөрт нэг удаа scheduler-оор ажиллуулж болно.
- API хүсэлт бүр JSON structured log болон `X-Request-Id`-тай. Нэвтрэлт, хэрэглэгч, ажил, review, session-ийн чухал өөрчлөлтүүд `audit_events` хүснэгтэд бүртгэгдэнэ. Админ `GET /api/audit?limit=50&cursor=...`-аар хуудслан уншина.
- Session 7 хоногийн дээд хугацаатай, 24 цаг идэвхгүй бол хүчингүй болно. Профайлаас бүх төхөөрөмжийн session-ийг нэг дор цуцалж болно.
- Screenshot-ийн binary Postgres дотор биш, `PRIVATE_FILES_DIR` эсвэл `DATA_DIR/files` дахь private storage-д checksum-тай хадгалагдана. Database metadata болон файл зөрсөн эсэхийг `ops:status` шалгана.
- Workspace refresh нь зөвхөн өөрчлөгдсөн ажлуудыг татна; screenshot metadata ба activity history нь ажлын дэлгэрэнгүйг нээхэд тусдаа татагдана. `GET /api/tasks` нь `limit`, `cursor`, `status`, `assignee`, `q` параметртэй сервер талын pagination/filter дэмжинэ.

Production reverse proxy нь бодит client IP-г `X-Forwarded-For`-оор зөвхөн өөрөө дарж дамжуулах ёстой. `TRUST_PROXY=true`, таамаглах боломжгүй 32-оос урт `IP_HASH_SECRET`, HTTPS `APP_ORIGIN`, `COOKIE_SECURE=true`, абсолют `DATA_DIR` заавал өгнө. Log/audit-д IP-ийн зөвхөн HMAC hash хадгалагдана.

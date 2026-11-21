# The Realm — MAOC Design & Knowledge Blueprint

สถานะ ณ 2026-11-14: **Stage 1 — รวบรวมความรู้** ผู้ใช้เลือก A: เอกสารหลักและ
Knowledge notes ใน Local Vault เดิมเท่านั้น ไม่ใช่การอนุมัติแก้สี B1.1, เริ่ม B2/B3,
เชื่อม Supabase, ย้ายฐานข้อมูล หรือเพิ่มสิทธิ์ให้ Agent

## 1. ที่มาและวิธีอ่าน

| แหล่ง | ตำแหน่งและส่วนอ้างอิง | ใช้สำหรับ |
| --- | --- | --- |
| The Realm | `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/The Realm.json` — CORE CREATIVE IDENTITY, VISUAL DIRECTION, COLOR PALETTE, ATMOSPHERE | อัตลักษณ์ภาพและบรรยากาศ |
| Master Blueprint | `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/Multi_Agent_Software_Master_Blueprint.json` — §§1, 8–13, 17–20 | ทิศทาง software engineering และข้อควบคุมงาน |
| ระบบที่ทำงานจริง | `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/CLAUDE.md`, `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/PLAN.md` และโค้ดที่ระบุด้านล่าง | สถานะ implementation และขอบเขตที่อนุมัติ |

ต้นฉบับทั้งสองเป็นข้อความเอกสาร แม้ใช้นามสกุล `.json`; ไม่ใช่ JSON config ที่นำเข้า
runtime ได้โดยตรง ไม่แก้ไขต้นฉบับและไม่คัดลอก prompt ทั้งฉบับมาเป็นคำสั่ง Agent
The Realm ใช้ชื่อโลก **THE ETERNAL NEXUS**; ไม่ใช่ข้อกำหนดให้เปลี่ยนชื่อ MAOC

ป้ายสถานะในเอกสารนี้:
- **ต้นฉบับ:** สิ่งที่เอกสารอ้างอิงระบุ ไม่ได้แปลว่าติดตั้งหรืออนุมัติแล้ว
- **ระบบจริง:** ตรวจจากโค้ดปัจจุบัน ไม่ได้แปลว่าผ่าน production acceptance
- **ข้อเสนอ:** การประยุกต์สำหรับ MAOC ต้องผ่าน checkpoint ก่อน implementation
- **อนุมัติ:** เฉพาะขอบเขตที่ผู้ใช้เลือกในบทสนทนา ไม่ขยายสิทธิ์จาก blueprint

## 2. อัตลักษณ์ที่ควรเก็บ

**ต้นฉบับ:** Pixel Art 2.5D, Cozy Dark Fantasy, Dark Luxury และ Cyber-Gothic
ผสมเกาะลอยฟ้า สถาปัตยกรรม Gothic ห้องสมุดจักรวาล และบรรยากาศลึกลับแต่ต้อนรับ
มีมิติของวัสดุ แสงเงา และเอกลักษณ์แต่ละพื้นที่ ไม่ใช่พื้นดำกับนีออนทั่วจอ

**MAOC ที่ตกลงไว้:** Cozy Pixel เป็นอัตลักษณ์, Gothic เป็นกรอบ/วัสดุ,
Cyber ใช้กับข้อมูลและสถานะ ข้อเสนอใหม่ไม่ยกเลิกขอบเขตนี้

**Feedback ผู้ใช้หลัง B1:** โครงและโทนรวมพอใช้ รายละเอียดดีขึ้น แต่สีจืดไปเล็กน้อย;
หัวข้อเมนูควรมีสีเฉพาะตามความจำเป็น ไม่ใช่เปลี่ยนทั้งหน้าหรือเร่งสีทุกส่วน

**ระบบจริง:** B1 ใช้ Silver ในเมนูปกติและ Gold เมื่อเลือกใน
`C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/src/components/cc/overview.css` บรรทัด 18–22
ทำให้สีแยก section เดิมใน `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/src/index.css`
ไม่ปรากฏแบบเดิม นี่คือสาเหตุเชิง CSS ของการรวมสี ไม่ใช่ข้อสรุปว่าทั้งหน้าไม่มีสี

### แรงบันดาลใจไม่ใช่ backlog อัตโนมัติ

The Realm เสนอ 12 realms, MMORPG, persistent world, NPC routines, weather,
ความสัมพันธ์ บ้าน companion และดนตรี สิ่งเหล่านี้ **ไม่ใช่ฟีเจอร์ MAOC ที่อนุมัติ**
เก็บเป็นบริบทภาพเท่านั้น ไม่สร้าง 12 ทีมใหม่ เปลี่ยน 27 Agent IDs/8 แผนก,
ติดตั้ง game engine, เพิ่มเสียงอัตโนมัติ หรืออ้างว่าฉากเท่ากับสถานะ provider

## 3. ระบบสี B1.1 — implemented; รอตรวจรับภาพ

**ต้นฉบับ COLOR PALETTE:** Obsidian Black, Antique Gold, Midnight Purple,
Astral Lavender, Celestial Blue, Neon Cyan, Magenta, Moonlight Silver,
Emerald Moss และ Warm Amber

ต้นฉบับ **ไม่ให้ HEX, contrast targets หรือการจับคู่กับเมนู MAOC**
mapping ด้านล่างเป็นการประยุกต์ของ MAOC ไม่ใช่ค่าที่ถอดจากต้นฉบับ
ผู้ใช้อนุมัติ implementation B1.1 วันที่ 2026-11-14; เลือก HEX และตรวจ scoped
regressions แล้ว แต่ยังรอผู้ใช้ตรวจรับภาพก่อน B2

| ชั้นสี | หน้าที่ที่เสนอ | ขอบเขต |
| --- | --- | --- |
| Obsidian Black / Midnight Purple | พื้นหลังและพื้นผิว | เก็บบรรยากาศมืด เพิ่มลำดับชั้นด้วยพื้น/เส้น/เงา ไม่เร่งความสดทั้งหน้า |
| Moonlight Silver | เนื้อหาและข้อมูลรอง | อ่านไทย/อังกฤษได้ ไม่ย้อมข้อความยาวเป็นสีหมวด |
| Antique Gold | ตรากิลด์ กรอบสำคัญ และ primary action | ไม่ใช้แทนสี active ของทุกหมวด |
| Astral Lavender | Overview / Command bridge | หัวข้อ ไอคอน และเครื่องหมายหมวด |
| Warm Amber | Missions | สื่อภารกิจ ไม่ใช้สีนี้เพียงอย่างเดียวบอกว่างานรออนุมัติ |
| Celestial Blue | Teams | หมวดรวมทีม; ภายในใช้สีของแผนกนั้น |
| Emerald Moss | Library / Knowledge | แยกความรู้ออกจากงานที่กำลังรัน |
| Magenta | Activity | ใช้เฉพาะจุด ไม่ทำให้ทุก notice ดูเป็น error |
| Moonlight Silver | Settings | เป็นกลาง ไม่สร้างลำดับความสำคัญปลอม |
| Neon Cyan | ค่าที่วัดได้/ข้อมูลสดในบริบทที่เหมาะสม | ห้ามตีความ WebSocket connected ว่า provider พร้อมใช้งาน |

### กติกาการใช้สี

1. แยก **สีหมวด**, **สีแผนก**, **สีสถานะ**, **สี interaction** ออกจากกัน
2. เมนู active คงสีประจำหมวด พร้อมแถบข้าง พื้น และน้ำหนักข้อความ;
   hover/focus ต้องแยกได้ ไม่ใช้สีเพียงอย่างเดียวระบุหน้าปัจจุบัน
3. ใช้ accent กับหัวข้อ ไอคอน เส้นขอบเล็ก และ marker ไม่เติมสีทุกการ์ด/ย่อหน้า
4. สถานะสำเร็จ/รอ/ล้มเหลว/ออฟไลน์มีชื่อหรือสัญลักษณ์ประกอบเสมอ
5. ตรวจ contrast จากสีจริงและพื้น composite; B1.1 มี scoped checks ด้านล่าง
   ไม่อ้างว่าเป็น formal accessibility certification หรือครอบคลุมทุกข้อความในแอป
6. เปรียบเทียบ desktop/mobile ก่อน–หลัง; คง route, focus, keyboard,
   Notices และพฤติกรรมเดิม ทดสอบโดยไม่ลด assertions

### Tokens / precedence ที่ implement ใน B1.1

Live Visualize 2.5D คงสีหมวดและสีแผนกเดิม แสง Cyan ใช้กับสถานะจาก Telemetry และเส้นส่งต่อที่มีทิศทางและหมดอายุ แยกจากสะพานและแสงตกแต่ง เมื่อออฟไลน์ซ่อนสถานะสด ไม่ตีความกราฟเหตุการณ์ย้อนหลังว่าเป็นงานที่กำลังรัน ผลตรวจอยู่ใน [PLAN.md](../PLAN.md#active-execution-sequence)

| Menu | Token | HEX |
| --- | --- | --- |
| Overview | `--realm-lavender` | `#cbb0f5` |
| Missions | `--realm-amber` | `#edc078` |
| Teams | `--realm-blue` | `#8fc5f5` |
| Library | `--realm-moss` | `#a8d3a0` |
| Activity | `--realm-magenta` | `#eaa0cf` |
| Settings | `--realm-silver` | `#c0c7d6` |

- `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/src/components/cc/overview.css` โหลดหลัง
  global/cozy styles; เดิม shell override ย้อมเมนู Silver/Gold, sidebar specificity
  ทับ active และ mobile override ใช้ Gold แยกอีกจุด แก้ที่เจ้าของ override เหล่านี้
- `data-dashboard-section` ที่ shell และ `data-section` ที่เมนู/เมนูย่อยเลือก
  `--section-accent/tint/line`; ไม่มี route/state/handler หรือ schema ใหม่
- label/icon/header context/page heading/eyebrow/active tab ใช้สีหมวด;
  active ยังมี inset marker, น้ำหนักตัวอักษรและ `aria-current/aria-selected`
  focus-visible คง outline; More บนมือถือใช้สี Teams/Settings เมื่ออยู่หน้านั้น
- สีแผนกใช้ `--team-accent` จาก cozyGuild เดิม; directory title เพิ่มสีนี้และ
  dossier eyebrow ไม่รับสี Teams มาทับ ส่วนฉาก/agent sprites ไม่เปลี่ยน
- inventory: `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/src/index.css` ยังมี legacy
  section accents; `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/src/data/teams.js` เป็น
  accent names; `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/src/components/cc/KnowledgeVaultView.jsx`
  มี PLANET_PALETTES แบบสว่างสำหรับ graph แยกจาก material ของฉาก ตั้งใจเก็บไว้
- ไม่แก้ task-state/connection/danger tokens หรือ primary-action Gold; สีหมวด
  ไม่ใช่สถานะสำเร็จ/ล้มเหลว/สิทธิ์ runtime
- ผลตรวจ: 256 Node, build, 64 Chromium checks/87 layouts; focused browser
  42 active-menu/keyboard-focus cases ที่ 320/360/390/768/1024/1440/1600px,
  contrast ต่ำสุด 6.90:1 บนพื้น composite ที่ตรวจ ไม่ใช่ผล audit ทั้งแอป
- Evidence: `C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-dashboard-b11/`
  มี before/after, manifest/snapshot, ผลผ่านและ failed attempts; ยืนยัน snapshot
  ของ Vault/ต้นฉบับ/runtime ไม่เปลี่ยนใน scoped verifier

### สีแผนกที่มีจริง — ไม่ใช่สีที่ถอดจาก blueprint

แหล่งจริง: `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/src/data/cozyGuild.js`
ค่าต่อไปนี้คือ `GUILD_PALETTES.*.accent` ของฉาก/หน้าทีมเดิม ไม่ใช่ token สำหรับทุก UI

| Team ID | สถานที่ในกิลด์ | Accent ปัจจุบัน |
| --- | --- | --- |
| command | ศาลาบัญชาการ | `#d2baf5` |
| tech | เวิร์กช็อประบบ | `#83dbe8` |
| design | สตูดิโอสร้างสรรค์ | `#edacd9` |
| trade | หอสังเกตการณ์ | `#a2ccea` |
| content | ห้องสมุดนักเขียน | `#b4cc9c` |
| data | หอจดหมายเหตุ | `#a6baf5` |
| finance | สำนักงานบัญชี | `#e7c68c` |
| legal | สำนักเอกสาร | `#c9bfdf` |

`C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/src/data/teams.js` และ palette ของ Knowledge
graph ยังใช้สีต่างชุดในบางแผนก ต้องทำ inventory ก่อนรวม semantic tokens
อย่าแก้ artwork ทั้งหมดเพื่อบังคับสีให้เหมือนกัน และอย่าถือว่า palette ต่างกันคือบั๊กเสมอ

## 4. Master Blueprint เทียบกับ MAOC จริง

| ประเด็น | ต้นฉบับ / ทิศทาง | สถานะ MAOC และขอบเขต |
| --- | --- | --- |
| เป้าหมาย | Fullstack Software Engineering, Supabase, multi-runtime | เป็นเป้าหมายในเอกสารอ้างอิง ไม่ใช่สถานะติดตั้งของ MAOC |
| Database | Supabase | ปัจจุบัน atomic revisioned JSON + generated Markdown; ผู้ใช้เลือกใช้ Local Vault เดิมใน Stage 1 ไม่มี Supabase/SQLite migration |
| Runtime | Claude Code / Codex / OpenCode | ไม่อ้างว่ามี runtime adapters หรือทำงานข้าม host แล้ว; ไม่ใช้คำสั่งเฉพาะ host แทน Cline โดยไม่ตรวจ |
| งานร่วมกัน | Orchestrator, specialist roles, Task Contract, file ownership | นำหลักการ owner/dependencies/acceptance/evidence มาใช้วางแผนได้ แต่ไม่เพิ่ม role แทน 27 Agents หรือเปลี่ยน task lifecycle ตาม template |
| Skills / MCP / Agents | แยกแนวทางทำงาน เครื่องมือภายนอก และผู้รับผิดชอบ | รักษาความแตกต่าง; development tooling ไม่ให้สิทธิ์ runtime Agent อัตโนมัติ |
| MCP | read-only first, จำกัด scope, ตรวจสิทธิ์และ secrets | กติกา development ปัจจุบันอยู่ใน `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/docs/agents/skill-routing.md`; runtime external transport ยังไม่ใช่สิ่งที่ทำเสร็จ |
| คุณภาพ | tests/review/security/evidence/human approval | ทำตามเครื่องมือจริง; ไม่อ้างว่ามี TypeScript/lint/CI เพราะ blueprint ยกตัวอย่างไว้ |
| การส่งมอบ | branch/worktree, PR, merge/deploy แยกจาก implementation | ไม่มี commit/push/deploy จากงานนี้ และไม่สร้าง governance files/tickets จำนวนมากโดยอัตโนมัติ |

รายการ 50 tools/skills และ repository ในต้นฉบับเป็นรายการอ้างอิง ไม่ใช่ inventory
ที่ติดตั้งจริง ไม่ติดตั้งเพิ่มหรืออ้างว่ารุ่น/config ปัจจุบันใช้ได้จากเอกสารนี้
การเชื่อมบริการในอนาคตต้องตรวจเอกสารทางการ ณ เวลานั้นและอนุมัติ scope/cost แยก

## 5. การเก็บความรู้ที่อนุมัติ — Local Vault

- เอกสารนี้เป็นหลักสำหรับกติกา/เหตุผล; `PLAN.md` เป็นหลักสำหรับสถานะและผลตรวจ
- เก็บ curated notes 3 เรื่อง: อัตลักษณ์และขอบเขต, ข้อเสนอ semantic colors,
  และช่องว่าง blueprint/ลำดับเฟส พร้อม stable IDs, tags, sources และลิงก์ถึงกัน
- บันทึกผ่านตัวจัดเก็บเดิมโดยมี validation, expected revision และ writer lock;
  ไม่แก้ `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/vault/.maoc/state/notes.json` ด้วยมือ
- JSON เป็นข้อมูลหลัก; `.md` ใต้ `C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/vault/notes/`
  เป็น generated projection ไม่ใช่การ sync Obsidian สองทาง
- เพิ่มเฉพาะ records ใหม่ รักษาข้อมูลเก่า; เก็บ private before/after evidence
  นอก repository และตรวจ readback/projection ไม่ถือว่าเรียกเขียนแล้วแปลว่าสำเร็จ
- Knowledge notes ยังไม่ใช่ vector index, semantic retrieval หรือ RAG ที่ inject
  เข้า prompt อัตโนมัติ และไม่ได้อนุมัติให้ Agents เข้าถึงไฟล์นอก workspace
- Notes 3 เรื่องยังเป็น historical Stage 1 capture (รวมชื่อ semantic colors proposal);
  ไม่เขียน Vault เพิ่มระหว่าง B1.1 ให้เอกสารนี้/PLAN.md เป็นสถานะปัจจุบัน
  ทดสอบ Library เปิดทั้ง 3 notes/reload จากสำเนา 12 notes ใน isolated temporary Vault
  ผ่านแล้ว ไม่ใช่ acceptance ของ dev backend เดิมหรือการปิด D.1 root cause
- หาก backend ไม่รัน ใช้ storage-only maintenance session ชั่วคราวใน loopback
  ผ่าน HTTP GET/PUT ที่ตรวจ revision แล้วปิด; ไม่เริ่ม scheduler/provider/runtime
  ทั้งระบบเพื่อบันทึก notes และไม่อ้างว่าเป็นการซ่อม dev backend เดิม

## 6. เฟสและ checkpoint ปัจจุบัน

| ลำดับ | เจาะลึกเรื่องใด | เงื่อนไขผ่าน |
| --- | --- | --- |
| Stage 1 — Blueprint & Knowledge | เอกสารนี้ + curated notes, แยก facts/proposals | ข้อมูลเก่าไม่หาย, อ่านกลับได้ทั้ง JSON/Markdown, แหล่งอ้างอิงไม่ถูกแก้ |
| Stage 2 — B1.1 Semantic Colors | ผู้ใช้ตรวจรับและอนุมัติ B2 แล้ว; inventory/HEX/precedence อยู่ Section 3 | scoped regressions เดิมคงอยู่ ไม่มีการเปลี่ยนสีแผนก สถานะ หรือปุ่มหลัก |
| Stage 3 — B2 Analytics | Implemented; แยก mission outcomes, AI-only weighted duration/completion, HUMAN wait, usage coverage และเส้นทางตรงไป Agent/ภารกิจ/AAR; มือถือเป็นบัตรที่ยังมี semantic table | 260 Node/build/69 Chromium/94 layouts ผ่าน; unknown usage ไม่เป็นยอดศูนย์, ไม่มี pooled percentile/time-series/billing/quality score ที่อนุมานขึ้นเอง; รอตรวจรับก่อน B3 |
| ถัดไป — B3 Mission / Library / Team details | เชื่อมภารกิจ → ผลงาน → ความรู้ → ทีมด้วย ID/ที่มา; ลำดับข้อมูลและสถานะ missing/loading/error | ไม่เปิดรายการอื่นแทน ID ที่หาย; รักษา archives และ keyboard/deep links |
| Functional track แยก | พิจารณา U.5 / U.4 / U.3 ตาม use case และ permission gate เดิม | สเปกและ explicit approval ก่อน implementation ไม่เริ่มเพราะปรับ UI เสร็จ |

**เหตุผลที่ทำ B1.1 ก่อน B2:** แก้จุดที่ผู้ใช้เห็นจริงให้สีมีความหมายก่อน แล้วนำภาษา
ภาพที่ตรวจรับแล้วไปใช้กับ Analytics ลดการทำซ้ำ ไม่ขยายเป็น UI rewrite ทั้งระบบ

B2 ตรวจ API ปัจจุบันแล้วเมื่อ 2026-11-14: analytics/reviews ได้ 200 ทั้งเรียกตรงและผ่าน
Vite มี 0 ภารกิจ/28 rows จริง ไม่ได้แก้หรือ restart backend; error เดิม reproduce ไม่ได้
จึงยังไม่ปิด root cause หรือสรุปว่าเป็น stale process ส่วน UI แยก endpoint 404 ออกจาก
ข้อมูลว่าง/รายงานที่ไม่อยู่ใน retention แล้ว พร้อมทดสอบ loading/error/offline/degraded
ข้อค้นพบ Library reload จาก D.1 ยังไม่ปิด root cause และไม่ได้อ้างว่าซ่อมใน B2
Supabase/multi-runtime ยังเป็นเป้าหมายระยะหลัง ไม่มีแผน migration ในขอบเขตตัวเลือก A
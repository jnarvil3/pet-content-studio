# QA Browser Test Script — Pet Content Studio

**URL:** http://localhost:3001
**Password:** vivanamuh_2026
**Date:** 2026-04-08
**Revert point:** `55b61ac`

Go through every step below. For each item, mark PASS or FAIL. If FAIL, describe what went wrong. Take a screenshot of any failures.

---

## Phase 1: Login & Dashboard

### 1.1 Login
- [ ] Navigate to http://localhost:3001
- [ ] Verify the login page appears with "🐾 Pet Content Studio" title
- [ ] Enter password: `vivanamuh_2026`
- [ ] Click "Entrar"
- [ ] Verify redirect to the Dashboard page

### 1.2 Dashboard Stats
- [ ] Verify 4 stat cards are visible (Total, Aprovados, Pendentes, Publicados)
- [ ] Click on any stat card — verify it navigates to the Review page
- [ ] Navigate back to Dashboard

### 1.3 Dashboard Quick Actions
- [ ] Verify "✨ Criar Conteúdo" button is visible
- [ ] Verify "🔍 Explorar Sinais" button is visible
- [ ] Verify "✅ Fila de Revisão" button is visible
- [ ] Click "🔍 Explorar Sinais" — verify it navigates to the Discover page

---

## Phase 2: Discover Page — Pesquisa Tab (Custom Search)

### 2.1 Search Form
- [ ] Verify the Pesquisa tab is active by default
- [ ] Verify the country dropdown shows "🇧🇷 Brasil" as default with 12 country options
- [ ] Verify the topic input field is present
- [ ] Verify example topic chips are present (pet grooming, recursos humanos, etc.)

### 2.2 Run a Custom Search
- [ ] Select "🇧🇷 Brasil" as country
- [ ] Type "cachorro" in the topic field
- [ ] Click "🔍 Pesquisar"
- [ ] Verify loading spinner appears
- [ ] Wait for results to load

### 2.3 Search Results — Sort Toggle (NEW)
- [ ] **Verify sort toggle buttons appear: "📊 Engajamento" and "👁️ Views"**
- [ ] **Verify "📊 Engajamento" is active by default**
- [ ] **Verify videos show BOTH views (bold number) and engagement % (bold, colored) on each row**
- [ ] **Click "👁️ Views" — verify videos re-sort by view count (highest first)**
- [ ] **Click "📊 Engajamento" — verify videos re-sort by engagement rate (highest first)**
- [ ] **Verify the sort happens instantly (no new loading spinner / no new API call)**
- [ ] Verify the "🔥 Vídeos ordenados por..." heading updates to match the sort

### 2.4 Search Results — Other Sections
- [ ] Verify "🎣 Ganchos Virais Encontrados" section appears (collapsible)
- [ ] Verify "📡 Sinais de Conteúdo" section appears with scored opportunities
- [ ] Verify "✨ Criar Conteúdo" buttons appear on video rows
- [ ] Click one "✨ Criar Conteúdo" button — verify it navigates to the Create page

---

## Phase 3: Discover Page — Sinais de Conteúdo Tab

### 3.1 Basic Signals Loading
- [ ] Click the "Sinais de Conteúdo" tab
- [ ] Verify signal cards load (or show "Nenhum sinal disponível" message)
- [ ] Verify each card shows: relevance score, region badge (🇧🇷 BR or 🌐 Global), title, description, source

### 3.2 Region Filters — Preset Buttons
- [ ] Verify 3 preset buttons: "🌍 Todos" (active), "🇧🇷 Brasil", "🌐 Global"
- [ ] Click "🇧🇷 Brasil" — verify it becomes active, others deactivate
- [ ] Verify only signals with BR badges show (or empty state)
- [ ] Click "🌐 Global" — verify only global signals show
- [ ] Click "🌍 Todos" — verify all signals show again

### 3.3 Region Filters — Dropdown (NEW)
- [ ] **Verify "Mais regiões..." dropdown exists to the right of the preset buttons**
- [ ] **Open the dropdown — verify options: EUA, México, Argentina, Portugal, Espanha, Alemanha, França, Reino Unido**
- [ ] **Select "🇺🇸 EUA" — verify preset buttons deactivate and signals filter**
- [ ] **Click "🌍 Todos" button — verify dropdown resets and all signals show**

### 3.4 Signal Actions
- [ ] Verify "🔗 Ler Artigo" link opens in new tab (if URL present)
- [ ] Verify "✨ Criar a partir deste" button navigates to Create page
- [ ] Verify "🔄 Atualizar Tendências" button triggers collection (may show progress bar)

---

## Phase 4: Discover Page — Videos em Alta Tab

### 4.1 Basic Video Loading
- [ ] Click the "Videos em Alta" tab
- [ ] Verify video cards load in a grid
- [ ] Verify each card shows: thumbnail, rank number, platform badge (YouTube/TikTok), title

### 4.2 Pet/General Filter
- [ ] Verify "🐾 Pet" is active by default
- [ ] Click "🌐 Geral" — verify more/different videos show
- [ ] Click "🐾 Pet" — verify pet-only videos show

### 4.3 Region Selector (NEW)
- [ ] **Verify region dropdown exists with "🌍 Todas Regiões" and country options**
- [ ] **Default should be "🇧🇷 Brasil"**
- [ ] **Select "🇺🇸 EUA" — verify videos re-filter (may show fewer or different results)**
- [ ] **Select "🌍 Todas Regiões" — verify all videos show**

### 4.4 Sort Toggle (NEW)
- [ ] **Verify sort buttons: "📊 Maior Engajamento" (active) and "👁️ Mais Vistos"**
- [ ] **Verify BOTH metrics visible on every video card: engagement % badge (pink) AND view count (dark badge)**
- [ ] **Click "👁️ Mais Vistos" — verify videos re-sort by view count**
- [ ] **Verify the subtitle updates to "ordenados por visualizações"**
- [ ] **Click "📊 Maior Engajamento" — verify videos re-sort by engagement**

### 4.5 Video Actions
- [ ] Click a video card — verify it opens the video URL in a new tab
- [ ] Click "✨ Criar a partir deste" — verify it navigates to Create page

---

## Phase 5: Discover Page — Ganchos Virais Tab

### 5.1 Basic Hooks Loading
- [ ] Click the "Ganchos Virais" tab
- [ ] Verify hook pattern cards load with engagement rates and video counts

### 5.2 Pet/General Filter
- [ ] Verify "🐾 Pet" and "🌐 Geral" toggles work
- [ ] Switch between them — verify hook list changes

### 5.3 Region Selector (NEW)
- [ ] **Verify region dropdown exists with country options**
- [ ] **Select a region — verify hooks filter by video language**

### 5.4 Instagram Hooks Section (NEW — CRITICAL)
- [ ] **Scroll down past the viral patterns grid**
- [ ] **Verify "📱 Ganchos Virais do Instagram — Esta Semana" section is VISIBLE by default (not hidden)**
- [ ] **Verify the subtitle says "Coletados de SocialBee, SocialPilot e Taggbox"**
- [ ] **Verify TWO sub-sections:**
  - [ ] **"🔥 Tendências desta semana" — cards with trending hooks (e.g., "When people your age start having kids")**
  - [ ] **"📋 Fórmulas comprovadas de alto engajamento" — grid of proven formulas**
- [ ] **Verify EACH hook card shows: hook text in quotes, category badge, source label, "why it works" explanation**
- [ ] **Verify sources are real: SocialBee, SocialPilot, or Taggbox**
- [ ] **Verify "🔗 Fontes ao Vivo" section at the bottom with 6 clickable links:**
  - [ ] SocialBee — Instagram Trends
  - [ ] SocialPilot — Reels Trends
  - [ ] Taggbox — 100+ Best Hooks
  - [ ] NewEngen — Weekly Trend Breakdown
  - [ ] Torro — Best Hooks 2026
  - [ ] Captain Hook AI
- [ ] **Click one of the external links — verify it opens in a new tab to the correct site**
- [ ] **Click 🔄 refresh button — verify the section reloads**

---

## Phase 6: Create Page

### 6.1 Signal Selection
- [ ] Navigate to the Create page
- [ ] Verify signal dropdown loads with available signals
- [ ] Select a signal — verify signal details appear

### 6.2 Custom Topic
- [ ] Clear the signal dropdown
- [ ] Type a custom topic title (e.g., "Dicas de alimentação natural para cães")
- [ ] Add an optional description
- [ ] Verify the custom topic fields accept input

### 6.3 AI Quality Toggle
- [ ] Verify "⚡ Rápido" and "✨ Premium" buttons exist
- [ ] Click "⚡ Rápido" — verify it becomes active, description updates
- [ ] Click "✨ Premium" — verify it becomes active, description updates

### 6.4 Content Type Buttons
- [ ] Verify 3 buttons: "📱 Carrossel", "🎥 Reel", "💼 LinkedIn"
- [ ] Click "📱 Carrossel" — verify "🚀 Gerar Conteúdo" button appears
- [ ] Click "🎥 Reel" — verify audio/caption checkboxes appear
- [ ] Click "💼 LinkedIn" — verify generate button appears

### 6.5 Generate Content (if API keys configured)
- [ ] Select a signal or type a custom topic
- [ ] Click "📱 Carrossel"
- [ ] Click "🚀 Gerar Conteúdo"
- [ ] Verify loading/progress status appears
- [ ] Wait for generation to complete (may take 15-30s)
- [ ] Verify success toast appears
- [ ] Navigate to Review page to see the generated content

---

## Phase 7: Review Page

### 7.1 Content List
- [ ] Navigate to the Review page
- [ ] Verify content cards load (if any content exists)
- [ ] Verify status filter buttons: Todos, Pendentes, Revisão, Aprovados, Rejeitados, Publicados

### 7.2 Status Filters
- [ ] Click "Pendentes" — verify only pending content shows
- [ ] Click "Todos" — verify all content shows
- [ ] Click "Aprovados" — verify only approved content shows

### 7.3 Carousel Card Display
- [ ] Find a carousel content card
- [ ] Verify it shows: 5 slide thumbnails, caption text, hashtags, version badge
- [ ] Verify slide thumbnails have: slide numbers (1/5, 2/5...), edit pencil button (✏️), download button (⬇)

### 7.4 Slide Editor — Text Mode (NEW — CRITICAL BUG FIX)
- [ ] **Click the ✏️ pencil button on any slide thumbnail**
- [ ] **Verify the edit modal opens with title "✏️ Editar Slide N"**
- [ ] **Verify 4 tab buttons: "📝 Texto", "📷 Foto", "🎨 IA", "📤 Upload"**
- [ ] **Verify "📝 Texto" tab is active by default**
- [ ] **Verify the slide's CURRENT title text is pre-populated in the title field**
- [ ] **Verify the slide's CURRENT body text is pre-populated in the body field**
- [ ] **If this is slide 3 (insight): verify the stat fields appear with current stat number and context**
- [ ] **Edit the title text to something different (e.g., add " — TESTE")**
- [ ] **Click "💾 Salvar Texto"**
- [ ] **Verify success toast: "Texto do slide N atualizado!"**
- [ ] **Verify the modal closes and the slide re-renders with the new text**

### 7.5 Slide Editor — Photo Mode (Existing)
- [ ] Open the slide editor on another slide
- [ ] **Click "📷 Foto" tab**
- [ ] Verify Pexels search input and preset chips appear
- [ ] Type a search query (e.g., "happy dog park")
- [ ] Click "📷 Trocar Foto"
- [ ] Verify success toast and slide thumbnail updates

### 7.6 Slide Editor — AI Image Mode (NEW)
- [ ] Open the slide editor on another slide
- [ ] **Click "🎨 IA" tab**
- [ ] **Verify the AI prompt textarea appears with description text**
- [ ] **Verify preset prompt chips: "🩺 No veterinário", "🐱 Gato elegante", "📊 Infográfico", "🎨 Ilustração"**
- [ ] **Verify cost note: "~$0.02-0.04 por imagem"**
- [ ] **Click a preset chip — verify it fills the textarea**
- [ ] **If GOOGLE_AI_API_KEY is configured: click "🎨 Gerar Imagem" and verify it generates**
- [ ] **If NOT configured: click "🎨 Gerar Imagem" and verify error toast about missing API key**

### 7.7 Slide Editor — Upload Mode (NEW)
- [ ] Open the slide editor on another slide
- [ ] **Click "📤 Upload" tab**
- [ ] **Verify the file upload drop zone appears with "Clique para selecionar ou arraste uma imagem"**
- [ ] **Verify accepted formats: "PNG, JPG ou WebP — máximo 10MB"**
- [ ] **Select an image file from your computer**
- [ ] **Verify the image preview appears below the drop zone**
- [ ] **Click "📤 Enviar Imagem"**
- [ ] **Verify success toast and slide updates with the uploaded image**

### 7.8 Content Actions
- [ ] Click ✅ Approve on a pending item — verify status changes to "Aprovado"
- [ ] Click ❌ Reject on a pending item — verify rejection reason modal appears
  - [ ] Try submitting empty rejection — verify error toast
  - [ ] Enter a reason and submit — verify status changes to "Rejeitado"
- [ ] Click 🔄 Regenerate on a pending item — verify feedback modal appears
  - [ ] Verify quick suggestion chips are present
  - [ ] Verify "🎯 Edição Precisa" toggle exists
  - [ ] Enter feedback and submit

### 7.9 Version Badges
- [ ] If v2+ content exists: verify purple version badge (e.g., "v2")
- [ ] If v1 content exists: verify gray "v1" badge

---

## Phase 8: Settings Page

### 8.1 Brand Configuration
- [ ] Navigate to Settings page
- [ ] Verify brand name, handle, color fields are present
- [ ] Verify two tone-of-voice fields: "Tom de Voz — LinkedIn" and "Tom de Voz — Instagram"
- [ ] Verify services list is present

### 8.2 Brand Document Upload
- [ ] Verify "Importar Documento da Marca" section exists
- [ ] Verify 3 extraction tiers: Básico, Padrão, Premium

### 8.3 Save Settings
- [ ] Change the brand name to "Test Brand"
- [ ] Click Save — verify success toast
- [ ] Reload page — verify brand name persisted
- [ ] Change it back to the original name

---

## Phase 9: Help Page

### 9.1 Help Content
- [ ] Navigate to Help page
- [ ] Verify platform info loads
- [ ] Verify API cost table is present
- [ ] Verify workflow steps are listed in order

---

## Phase 10: Navigation & General UX

### 10.1 Sidebar Navigation
- [ ] Click each sidebar item: Dashboard, Descobrir, Criar, Revisar, Configurações, Ajuda
- [ ] Verify each page loads correctly
- [ ] Verify the active nav item highlights with left border

### 10.2 Budget Indicator
- [ ] Verify budget indicator appears in sidebar footer

### 10.3 Toast Notifications
- [ ] Verify toasts appear and auto-dismiss (triggered by various actions above)

### 10.4 Responsive Behavior
- [ ] If possible, resize the browser window narrower
- [ ] Verify the layout adjusts (flex-wrap on filter buttons, etc.)

---

## Summary

| Section | Items | Pass | Fail |
|---------|-------|------|------|
| Phase 1: Login & Dashboard | 10 | | |
| Phase 2: Pesquisa + Sort | 16 | | |
| Phase 3: Sinais + Regions | 12 | | |
| Phase 4: Videos + Sort + Regions | 15 | | |
| Phase 5: Hooks + Instagram | 20 | | |
| Phase 6: Create | 12 | | |
| Phase 7: Review + Slide Editor | 25 | | |
| Phase 8: Settings | 6 | | |
| Phase 9: Help | 3 | | |
| Phase 10: Navigation | 4 | | |
| **TOTAL** | **123** | | |

### New Features to Specifically Verify (from April 8 feedback):
1. **Slide text editing** (Phase 7.4) — the critical bug fix
2. **Pesquisa sort toggle** (Phase 2.3)
3. **Multi-region selectors** on Sinais (3.3), Videos (4.3), Hooks (5.3)
4. **Videos dual sorting** — engagement vs views (Phase 4.4)
5. **Instagram hooks visible + real-world data** (Phase 5.4)
6. **Gemini AI image generation** (Phase 7.6)
7. **Custom image upload** (Phase 7.7)

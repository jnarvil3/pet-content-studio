# QA Browser Test — April 9, 2026 Changes

**URL:** http://localhost:3001
**Password:** vivanamuh_2026
**Scope:** Reference carousel, API keys, hooks PT-BR, brand image upload, color hex inputs

Go through every step below. Mark PASS or FAIL. If FAIL, describe what went wrong and take a screenshot.

---

## Phase 1: Reference Carousel — Create Page

### 1.1 Button Visibility
- [ ] Navigate to Criar page
- [ ] Verify 4 content type buttons are visible: Carrossel, Reel, LinkedIn, **Carrossel por Referência**
- [ ] Verify the reference button has a pink/gradient background and stands out from the others
- [ ] Click "🎨 Carrossel por Referência"
- [ ] Verify the reference options panel appears below (upload area, mode toggle, instructions)
- [ ] Verify the "🚀 Gerar Conteúdo" button appears

### 1.2 Image Upload — Click
- [ ] Click the upload area ("Arraste imagens aqui ou clique para selecionar")
- [ ] Verify a file picker opens
- [ ] Select 1-3 images (PNG or JPG screenshots of any carousel)
- [ ] Verify thumbnail previews appear below the upload area
- [ ] Verify each thumbnail has an "×" remove button
- [ ] Click "×" on one thumbnail — verify it is removed
- [ ] Verify remaining thumbnails are still visible

### 1.3 Image Upload — Drag and Drop
- [ ] Drag an image file from Finder/desktop onto the upload area
- [ ] Verify the upload area border changes color during hover (blue)
- [ ] Drop the file — verify thumbnail appears
- [ ] Try uploading a 6th image — verify toast warning "Máximo de 5 imagens"

### 1.4 Mode Toggle
- [ ] Verify Clone mode is selected by default (purple button, "Clone: mesma estrutura e fluxo...")
- [ ] Click "✨ Inspirado"
- [ ] Verify Inspirado button becomes active (pink gradient)
- [ ] Verify description changes to "Inspirado: usa como direção, IA tem liberdade para adaptar"
- [ ] Verify instructions hint changes to "(obrigatório para Inspirado)"
- [ ] Click "🔄 Clone" — verify it switches back
- [ ] Verify instructions hint changes back to "(opcional para Clone)"

### 1.5 Validation
- [ ] With no images uploaded, click Gerar — verify toast "Envie pelo menos 1 imagem de referência"
- [ ] Upload 1 image, select Inspirado mode, leave instructions empty
- [ ] Click Gerar — verify toast "Escreva instruções para o modo Inspirado"
- [ ] Switch to Clone mode — verify Gerar proceeds (instructions optional for Clone)

---

## Phase 2: Gemini Pre-Check & Pollinations Dialog

### 2.1 Gemini Unavailable Dialog
- [ ] With images uploaded and mode selected, click "🚀 Gerar Conteúdo"
- [ ] Verify a **popup dialog** appears (not just a toast)
- [ ] Verify the dialog title/message includes "Gemini sem créditos"
- [ ] Verify the dialog explains what Gemini does: "recebe suas screenshots de referência e cria slides novos que copiam o estilo visual"
- [ ] Verify the dialog explains how to fix: "Config → Chaves de API" and "aistudio.google.com/apikey"
- [ ] Verify the dialog explains Pollinations: "Gera imagens a partir de uma descrição de texto. Não consegue 'ver' suas screenshots"
- [ ] Verify the dialog asks: "Deseja continuar sem Gemini?"
- [ ] Verify two buttons: "Sim, usar Pollinations" and "Não, vou ativar o Gemini"

### 2.2 Cancel Path
- [ ] Click "Não, vou ativar o Gemini"
- [ ] Verify the dialog closes
- [ ] Verify no generation starts
- [ ] Verify the page returns to the same state (images still uploaded, mode still selected)

### 2.3 Pollinations Path
- [ ] Click Gerar again — the Gemini dialog appears again
- [ ] Click "Sim, usar Pollinations"
- [ ] Verify a **second confirmation** dialog appears with summary:
  - Mode (Clone or Inspirado)
  - Number of reference images
  - Caption AI quality (Premium or Rápido)
  - "Geração de imagens: Pollinations (sem referência visual)"
- [ ] Verify text is **properly formatted** with line breaks (not all crammed together)
- [ ] Click "🚀 Gerar"
- [ ] Verify generation starts with progress indicator
- [ ] Verify progress message mentions "Pollinations" at some point
- [ ] Wait for generation to complete or fail — verify no crash

### 2.4 Confirmation Dialog Formatting
- [ ] Verify all confirmation dialogs show text with proper line breaks
- [ ] Verify no raw `\n` characters visible in any dialog
- [ ] Verify each detail is on its own line

---

## Phase 3: Config — API Keys

### 3.1 Section Visibility
- [ ] Navigate to Config page (sidebar → Config)
- [ ] Scroll down past brand settings
- [ ] Verify "🔑 Chaves de API" card is visible
- [ ] Verify 3 key inputs are visible:
  - OpenAI — "Geração de Texto (Carrosseis, Legendas)"
  - Anthropic (Claude) — "Geração de Texto Premium (Reels, Legendas)"
  - Google AI (Gemini) — "Geração de Imagens"

### 3.2 Key Display
- [ ] Verify each input shows a masked placeholder of the current key (e.g., "sk-proj-...****************")
- [ ] Verify each input is a password field (dots, not plaintext)
- [ ] Click the 👁️ button next to any key — verify it toggles to plaintext
- [ ] Click 👁️ again — verify it toggles back to password dots

### 3.3 Help Links
- [ ] Verify OpenAI shows link to "platform.openai.com/api-keys"
- [ ] Verify Anthropic shows link to "console.anthropic.com/settings/keys"
- [ ] Verify Gemini shows link to "aistudio.google.com/apikey"
- [ ] Click one link — verify it opens in a new tab

### 3.4 Test Gemini Button
- [ ] Click "Testar" next to the Gemini key input
- [ ] Verify status text appears below the input ("Testando..." then result)
- [ ] With the current exhausted key: verify it shows an error about credits/quota
- [ ] Type a random invalid key in the Gemini input, click "Testar" — verify "Chave inválida" or similar error

### 3.5 Save Keys
- [ ] Leave all inputs empty, click "Salvar Chaves" — verify warning toast
- [ ] Type a key in one input, click "Salvar Chaves" — verify success toast
- [ ] Verify the input clears after saving
- [ ] Verify the placeholder updates to show the new masked key

---

## Phase 4: Config — Brand Colors (Hex Input)

### 4.1 Color Picker + Hex Input Sync
- [ ] In the Cores section, verify each color has a color picker AND a text input showing the hex code
- [ ] Verify 3 colors: Primaria, Secundaria, Destaque
- [ ] Click the color picker for Primaria — pick a new color
- [ ] Verify the hex text input updates to match the picked color
- [ ] Type a valid hex code in the Secundaria text input (e.g., `#ff5733`)
- [ ] Verify the color picker swatch updates to match the typed hex
- [ ] Type an incomplete hex (e.g., `#ff5`) — verify the color picker does NOT change (only updates on valid 6-digit hex)

---

## Phase 5: Discover — Ganchos Virais (Instagram Hooks)

### 5.1 Section Order
- [ ] Navigate to Descobrir → Ganchos Virais tab
- [ ] Verify "📱 Ganchos Virais do Instagram — Esta Semana" section appears **FIRST** (above "🎣 Padrões Virais")
- [ ] Verify the section has a 🔄 refresh button

### 5.2 PT-BR Translation
- [ ] Verify all hooks are in Portuguese (not English)
- [ ] Check trending hooks: "Quando as pessoas da sua idade começam a ter filhos" (not "When people your age...")
- [ ] Check proven formulas: "Para de rolar se você quer…" (not "Stop scrolling if you want to…")
- [ ] Check categories are in Portuguese: "Humor Relatable", "CTA Direto", "Exclusividade", etc.
- [ ] Check "why" explanations are in Portuguese

### 5.3 Source Links
- [ ] Verify each hook card shows a clickable source link (🔗 SocialBee, 🔗 Taggbox, or 🔗 SocialPilot)
- [ ] Click a "🔗 SocialBee" link — verify it opens socialbee.com/blog/instagram-trends/ in a new tab
- [ ] Click a "🔗 Taggbox" link — verify it opens taggbox.com/blog/best-instagram-hooks/ in a new tab
- [ ] Click a "🔗 SocialPilot" link — verify it opens socialpilot.co/blog/instagram-reels-trends in a new tab

### 5.4 Live Sources Section
- [ ] Scroll to the bottom of the Instagram hooks section
- [ ] Verify "🔗 Fontes ao Vivo" section with 6 clickable source buttons
- [ ] Verify all 6 links open in new tabs

---

## Phase 6: Brand Document Upload — Image Analysis

### 6.1 Upload Image
- [ ] Navigate to Config page
- [ ] In "Upload de Documentos da Marca", click "📎 Escolher Arquivo"
- [ ] Select a brand image (logo, social post screenshot, product photo — PNG/JPG)
- [ ] Select extraction tier (Padrão is fine)
- [ ] Verify upload starts and shows processing status

### 6.2 AI Analysis (not just colors)
- [ ] Wait for extraction to complete (may take 5-15 seconds)
- [ ] Verify success message appears
- [ ] Check server logs (terminal) — should show "Analyzing brand image with AI" not just "Extracting colors"
- [ ] Navigate to Config → scroll to brand config
- [ ] Verify colors were updated from the image
- [ ] Check that brand profile was updated (the profile feeds into all future content generation)

### 6.3 Upload PDF
- [ ] Click "📎 Escolher Arquivo" again
- [ ] Select a PDF file (brand guidelines, any PDF)
- [ ] Wait for extraction to complete
- [ ] Verify voice/tone/content rules were extracted (visible in profile section if displayed)

---

## Phase 7: Content Type Switching

### 7.1 Button State Management
- [ ] On the Criar page, click each content type button in sequence: Carrossel → Reel → LinkedIn → Referência
- [ ] Verify only one button is active at a time (highlighted)
- [ ] Verify the reference button keeps its pink gradient when active
- [ ] Verify the other buttons use the purple gradient when active
- [ ] Click Reel — verify the audio toggle appears, reference options hide
- [ ] Click Referência — verify the reference options appear, audio toggle hides
- [ ] Click Carrossel — verify both reference options and audio toggle hide

---

## Phase 8: AI Quality Toggle + Reference

### 8.1 Quality Toggle Applies to Reference
- [ ] Select "🎨 Carrossel por Referência"
- [ ] Upload at least 1 image
- [ ] Toggle AI quality to "⚡ Rápido"
- [ ] Click Gerar → go through Gemini/Pollinations dialog → reach confirmation
- [ ] Verify confirmation shows "Legenda: Rápido (~$0.01)"
- [ ] Cancel, toggle to "✨ Premium"
- [ ] Click Gerar again → reach confirmation
- [ ] Verify confirmation shows "Legenda: Premium (~$0.20)"

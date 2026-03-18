# QA Checklist — Pet Content Studio

URL: http://localhost:3002/studio.html
Password: vivanamuh_2026

## Brand Intelligence System (NEW — Priority)

### Brand Upload
- [ ] Navigate to Config page → find "Upload de Documentos da Marca" section
- [ ] Verify 3 tier options visible: Básico ($0.004), Padrão ($0.04), Premium ($0.15)
- [ ] Upload a PDF → verify "Enviando..." status appears
- [ ] Upload a PNG logo → verify colors are auto-extracted and applied to brand config
- [ ] After PDF processing, verify brand profile status shows (green box with tone, audience, etc.)
- [ ] Verify uploaded file is saved in assets/brand/ directory

### Brand Context in Generation
- [ ] After uploading brand guidelines, generate a carousel → verify the content reflects the extracted brand voice, not generic "dog owner" style
- [ ] Check that forbidden words from the brand profile don't appear in generated content
- [ ] Generate a reel → verify narration tone matches brand profile
- [ ] Generate a LinkedIn post → verify professional tone matches brand profile
- [ ] If no brand profile uploaded, generation should still work with basic brand config

### Brand Config Form
- [ ] Brand name, handle, colors, tone, services all persist after save
- [ ] Empty brand name shows validation error (red border + toast)
- [ ] Reset button restores defaults (with confirmation dialog)

## Content Generation Flow

### Create Page
- [ ] Confirm dialog appears before generation (shows cost)
- [ ] All 3 content types work: Carrossel, Reel, LinkedIn
- [ ] Signal dropdown shows Portuguese signals (from Brazilian RSS feeds)
- [ ] AI quality toggle works (Rápido vs Premium)
- [ ] Generation status shows progress, then links to review page

### Review Page (Revisar)
- [ ] Filter buttons show counts: Todos (X), Pendentes (X), Revisão (X), etc.
- [ ] All filter buttons show (0) when empty, not just hide the count
- [ ] Carousel cards show slide thumbnails with download ⬇ icons
- [ ] "Baixar todos os slides" downloads all 5 PNGs
- [ ] Reel cards show video player + "Baixar vídeo" button
- [ ] LinkedIn cards render **bold** markdown properly
- [ ] Status badges in correct colors for all statuses

### Feedback / Revision Flow
- [ ] "Solicitar Alterações" opens modal with 8 quick feedback chips
- [ ] Clicking chips adds text to textarea (toggleable)
- [ ] Submitting feedback auto-triggers regeneration (no second click needed)
- [ ] Progress widget appears (bottom-right) with step-by-step updates
- [ ] New version appears with version badge (v2, v3)
- [ ] Old feedback shows as addressed (green checkmarks, collapsible)
- [ ] Revision requested banner (yellow) shows exact feedback text
- [ ] "Regenerar com Alterações" button works from the yellow banner
- [ ] AI actually incorporates the feedback (e.g., "gancho mais forte" produces different hook)
- [ ] If regeneration fails, feedback stays pending (not marked addressed)

## Discover Page (Descobrir)

### Sinais de Conteúdo
- [ ] Shows Brazilian signals (Petlove, Tudo Sobre Cachorros, etc.) alongside English
- [ ] Each signal has "Ler Artigo" link and "Criar a partir deste" button
- [ ] Scores visible on each card

### Vídeos em Alta
- [ ] Videos load (not infinite spinner)
- [ ] Thumbnails render (not blank)
- [ ] Pet / Geral toggle shows DIFFERENT content
- [ ] Pet shows only pet-titled videos, Geral shows everything
- [ ] Refresh button (🔄) reloads data
- [ ] Video cards are clickable (open YouTube/TikTok)
- [ ] Platform badges (YouTube red / TikTok cyan) visible

### Ganchos Virais
- [ ] Hook labels are descriptive PT-BR (not raw "curiosity_gap")
- [ ] All hooks have PT-BR labels (including "question", "before_after")
- [ ] Singular/plural correct ("1 vídeo" not "1 vídeos")
- [ ] "Usar este Gancho" button works

## Dashboard (Painel)
- [ ] Stats refresh when navigating back from other pages
- [ ] "Vídeos Virais" and "Engajamento" show actual numbers (not "-")
- [ ] Activity items are clickable (navigate to review)
- [ ] Pending count includes revision_requested items

## Language / i18n
- [ ] ALL visible text in Portuguese (no English strings)
- [ ] Proper diacritics: ã, ç, é, ê, í, ó, ú (not "Conteudo" → should be "Conteúdo")
- [ ] Dates in pt-BR format (DD/MM/YYYY or "18 de mar.")
- [ ] Error messages in Portuguese
- [ ] Toast notifications in Portuguese

## Auth
- [ ] Login page appears when not authenticated
- [ ] Login page is in Portuguese
- [ ] Password "vivanamuh_2026" grants access
- [ ] API calls without auth return 401

## Known Limitations (don't flag these)
- Pet/Geral filter may show similar results if all collected content is pet-related
- Old content (before PT-BR update) is in English — this is expected
- Budget tracking shows "Sem dados de custo" — not yet implemented
- Mobile layout is not fully responsive
- Some RSS feeds return 403/404 (Petz, Cobasi) — expected, working feeds compensate

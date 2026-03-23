# QA Checklist — Pet Content Studio

URL: http://localhost:3001/studio.html
Password: vivanamuh_2026

## Brand Intelligence System (NEW — Priority)

### Brand Upload
- [x] Navigate to Config page → find "Upload de Documentos da Marca" section
- [x] Verify 3 tier options visible: Básico ($0.004), Padrão ($0.04), Premium ($0.15)
- [x] Upload a PDF → verify "Enviando..." status appears
- [x] Upload a PNG logo → verify colors are auto-extracted and applied to brand config
- [x] After PDF processing, verify brand profile status shows (green box with tone, audience, etc.)
- [x] Verify uploaded file is saved in assets/brand/ directory

### Brand Context in Generation
- [x] After uploading brand guidelines, generate a carousel → verify the content reflects the extracted brand voice, not generic "dog owner" style
- [x] Check that forbidden words from the brand profile don't appear in generated content
- [x] Generate a reel → verify narration tone matches brand profile
- [x] Generate a LinkedIn post → verify professional tone matches brand profile
- [x] If no brand profile uploaded, generation should still work with basic brand config

### Brand Config Form
- [x] Brand name, handle, colors, tone, services all persist after save
- [x] Empty brand name shows validation error (red border + toast)
- [x] Reset button restores defaults (with confirmation dialog)

## Content Generation Flow

### Create Page
- [x] Confirm dialog appears before generation (shows cost)
- [x] All 3 content types work: Carrossel, Reel, LinkedIn
- [x] Signal dropdown shows Portuguese signals (from Brazilian RSS feeds)
- [x] AI quality toggle works (Rápido vs Premium)
- [x] Generation status shows progress, then links to review page

### Review Page (Revisar)
- [x] Filter buttons show counts: Todos (X), Pendentes (X), Revisão (X), etc.
- [x] All filter buttons show (0) when empty, not just hide the count
- [x] Carousel cards show slide thumbnails with download ⬇ icons
- [x] "Baixar todos os slides" downloads all 5 PNGs
- [x] Reel cards show video player + "Baixar vídeo" button
- [x] LinkedIn cards render **bold** markdown properly
- [x] Status badges in correct colors for all statuses

### Feedback / Revision Flow
- [x] "Solicitar Alterações" opens modal with 8 quick feedback chips
- [x] Clicking chips adds text to textarea (toggleable — click again to remove)
- [x] Submitting feedback auto-triggers regeneration (no second click needed)
- [ ] Progress widget appears (bottom-right) with step-by-step updates — TODO
- [x] New version appears with version badge (v2, v3)
- [x] Old feedback shows as addressed (green checkmarks, collapsible)
- [x] Revision requested banner (yellow) shows exact feedback text
- [x] "Regenerar com Alterações" button works from the yellow banner
- [x] AI actually incorporates the feedback (e.g., "gancho mais forte" produces different hook)
- [x] If regeneration fails, feedback stays pending (not marked addressed)

## Discover Page (Descobrir)

### Sinais de Conteúdo
- [x] Shows Brazilian signals (Petlove, Tudo Sobre Cachorros, etc.) alongside English
- [x] Each signal has "Ler Artigo" link and "Criar a partir deste" button
- [x] Scores visible on each card

### Vídeos em Alta
- [x] Videos load (not infinite spinner)
- [x] YouTube thumbnails render correctly
- [x] TikTok thumbnails show gradient fallback when CDN blocks hotlink
- [x] Pet / Geral toggle shows DIFFERENT content
- [x] Pet shows only pet-titled videos, Geral shows everything
- [x] Refresh button (🔄) reloads data
- [x] Video cards are clickable (open YouTube/TikTok)
- [x] Platform badges (YouTube red / TikTok cyan) visible

### Ganchos Virais
- [x] Hook labels are descriptive PT-BR (not raw "curiosity_gap")
- [x] All hooks have PT-BR labels (including "question", "before_after")
- [x] Singular/plural correct ("1 vídeo" not "1 vídeos")
- [x] "Usar este Gancho" button works

## Dashboard (Painel)
- [x] Stats refresh when navigating back from other pages
- [x] "Vídeos Virais" and "Engajamento" show actual numbers (not "-")
- [x] Activity items are clickable (navigate to review)
- [x] Pending count includes revision_requested items

## Language / i18n
- [x] ALL visible text in Portuguese (no English strings)
- [x] Proper diacritics: ã, ç, é, ê, í, ó, ú (not "Conteudo" → should be "Conteúdo")
- [x] Dates in pt-BR format (DD/MM/YYYY or "18 de mar.")
- [x] Error messages in Portuguese
- [x] Toast notifications in Portuguese

## Auth
- [x] Login page appears when not authenticated
- [x] Login page is in Portuguese
- [x] Password "vivanamuh_2026" grants access
- [x] Wrong password shows "Senha incorreta" error message
- [x] API calls without auth return 401

## Known Limitations (don't flag these)
- Pet/Geral filter may show similar results if all collected content is pet-related
- Old content (before PT-BR update) is in English — this is expected
- Budget tracking shows "Sem dados de custo" — not yet implemented
- Mobile layout is not fully responsive
- Some RSS feeds return 403/404 (Petz, Cobasi) — expected, working feeds compensate

## TODO
- [ ] Progress widget (bottom-right) during feedback regeneration
- [ ] Toast notification on empty brand name validation error
- [ ] Mobile responsive layout improvements
- [ ] Budget/cost tracking implementation

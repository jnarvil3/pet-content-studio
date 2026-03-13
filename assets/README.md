# Assets Directory

## Logo / Watermark

Place your brand logo here to automatically add it as a watermark on generated reels.

### Supported Files:
- `logo.png` - Primary logo (recommended)
- `watermark.png` - Alternative watermark image

### Recommendations:
- **Format**: PNG with transparency
- **Size**: 400x400px or larger (will be scaled to 120px width)
- **Background**: Transparent
- **Colors**: White or brand colors (will appear in bottom-right corner)

### Example:
```bash
# Add your logo
cp ~/Downloads/brand-logo.png ./assets/logo.png
```

### Fallback:
If no logo is found, the reel generator will use a text watermark with your brand handle (e.g., "@surestepautomation").

---

## Other Assets

You can add other brand assets here as needed:
- `brand-colors.json` - Brand color palette
- `fonts/` - Custom fonts
- `templates/` - Custom templates

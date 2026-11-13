# Tokens de diseño base

Escala de espaciado basada en 4 px. Los valores son punto de partida; el
Architect puede ajustarlos, pero debe mantener los nombres semánticos.

```css
:root {
  /* Color — claro */
  --bg: #f4f6fb;
  --surface: #ffffff;
  --surface-2: #eef2f9;
  --text: #172033;
  --text-muted: #5d6b85;
  --border: #dce3ef;
  --accent: #3557d6;
  --accent-strong: #2743b0;
  --accent-soft: #e6ecff;
  --success: #16794a;
  --success-soft: #e3f6ec;
  --warning: #9a5b00;
  --warning-soft: #fff2d9;
  --danger: #b42318;
  --danger-soft: #fee9e7;
  --focus: #ffb020;

  /* Tipografía */
  --font-sans: "Segoe UI", system-ui, -apple-system, sans-serif;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.25rem;

  /* Espaciado */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  /* Forma y profundidad */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --shadow-sm: 0 1px 2px rgb(23 32 51 / 0.08);
  --shadow-md: 0 8px 24px rgb(23 32 51 / 0.10);

  /* Movimiento */
  --ease: cubic-bezier(0.2, 0.7, 0.3, 1);
  --duration: 160ms;
}
```

## Modo oscuro

```css
[data-theme="dark"] {
  --bg: #0d1320;
  --surface: #151d2e;
  --surface-2: #1c2740;
  --text: #eef2fb;
  --text-muted: #a9b6d0;
  --border: #2a3854;
  --accent: #8ea6ff;
  --accent-strong: #b3c2ff;
  --accent-soft: #1e2d55;
  --success: #6ee7a8;
  --success-soft: #123526;
  --warning: #ffd166;
  --warning-soft: #3a2a0a;
  --danger: #ff8f86;
  --danger-soft: #3d1715;
  --focus: #ffd166;
}
```

## Escala tipográfica

| Nivel | Token | Uso |
| --- | --- | --- |
| Display | `--text-2xl` | Cifras del panel |
| Título | `--text-xl` | `h1` |
| Sección | `--text-lg` | `h2` |
| Cuerpo | `--text-md` | Texto y campos |
| Secundario | `--text-sm` | Metadatos |
| Etiqueta | `--text-xs` | Badges y ayudas |

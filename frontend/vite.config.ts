import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // 1. Move JS module scripts to the bottom of the body to make them non-render-blocking
        const scriptRegex = /<script type="module" crossorigin src="([^"]+)"><\/script>/g;
        let scripts: string[] = [];
        let cleanHtml = html.replace(scriptRegex, (match) => {
          scripts.push(match);
          return '';
        });

        // Append scripts right before the closing body tag
        if (scripts.length > 0) {
          cleanHtml = cleanHtml.replace('</body>', `${scripts.join('\n')}\n</body>`);
        }

        // 2. Load CSS stylesheets asynchronously via preload + onload fallback to eliminate render-blocking CSS
        cleanHtml = cleanHtml.replace(
          /<link rel="stylesheet" (crossorigin )?href="([^"]+)">/g,
          '<link rel="preload" href="$2" as="style" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="$2"></noscript>'
        );

        return cleanHtml;
      }
    }
  ],
})

EditVault — Dynamic Export Pricing, FPS Selector, Topaz Image Only

What this update does:
- Starts EditLab export price at 10 points and adds points for selected quality, output resolution, sharpen, denoise and FPS options.
- Calculates the same price in the backend; checks balance before processing; refunds the exact charged amount on processing/delivery failure.
- Adds a source/24/30/48/60 FPS selector. Standard FFmpeg conversion drops or duplicates frames and is not AI optical-flow interpolation.
- Removes the global top-header Topaz button; adds a dedicated admin-only Topaz Image tab in EditLab.
- Removes the video mode from the Topaz tool and disables Topaz video routes; Topaz is for images only. EditLab handles videos.

Install:
1. Extract this zip into the EditVault project root and merge the tools folder.
2. Open CMD at the project root and run:
   "C:\Program Files\nodejs\node.exe" ".\tools\apply-editvault-dynamic-quality-fps-topaz-images.js"
3. Continue only if the script reports success. It backs up all changed files and no database migration is required.
4. Restart backend (Ctrl+C then npm start in server) and refresh Vite (Ctrl+Shift+R).

Point tiers (base 10): quality smaller/balanced/higher adds 0/2/5; resolution source/720p/1080p/1440p/4K adds 0/2/5/9/15; sharpen and denoise off/light/medium/strong add 0/1/2/3 each; FPS source/24/30/48/60 adds 0/1/2/4/6.
Topaz image jobs can consume paid Topaz API credits. Keep the key in server/.env and do not paste it into chat.

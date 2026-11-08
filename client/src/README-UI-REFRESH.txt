EditVault UI refresh
===================

What changed
------------
- Only styles.css was modified. main.jsx, PublicCreatorProfile.jsx, and ProfileSettings.jsx are included unchanged for convenience.
- Added restrained page/card/modal entrance motion, tiny hover states, animated hero elements, improved keyboard focus visibility, a glassy sticky top navigation, and more consistent Profile settings styling.
- Added mobile-specific refinements and honors prefers-reduced-motion.
- No JavaScript, API routes, authentication logic, or database behavior was changed.

Apply it
--------
1. Stop nothing; this is a CSS-only change.
2. Back up your existing client/src/styles.css.
3. Copy styles.css from this package over:
   client/src/styles.css
4. Vite should hot-reload. If not, refresh the browser with Ctrl+R.

If you dislike the motion, restore your backup of styles.css. No other project files are required to apply this refresh.

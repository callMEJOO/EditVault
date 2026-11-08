EDITVAULT PROFILE + MOVIE COLLECTION KIT
========================================
This kit adds a new profile/movie collection feature without replacing the existing login.

FILES:
- server/src/db/migrations/20261021_profile_movies.sql
- server/src/routes/community-profile.js
- client/src/MovieProfile.jsx
- client/src/movie-profile.css

A) Copy files to the matching relative paths in the project.

B) Mount the API in server/src/index.js:
  Add alongside route imports:
    const communityProfileRoutes = require('./routes/community-profile');
  Add alongside app.use('/api/...'):
    app.use('/api/community', communityProfileRoutes);

C) Integrate the modal in client/src/main.jsx:
  Add import:
    import MovieProfile from './MovieProfile.jsx';
  Inside App() with other useState declarations:
    const [movieProfileOpen, setMovieProfileOpen] = useState(false);
  Add a button inside the logged-in user action area:
    <button className="login-btn profile-access-btn" type="button" onClick={() => setMovieProfileOpen(true)}>Movie Profile</button>
  Render alongside ProfileSettings:
    {movieProfileOpen && <MovieProfile user={user} onClose={() => setMovieProfileOpen(false)} onNotice={setNotice} />}

D) Database migration:
  Back up the database first. Run the SQL against the same PostgreSQL database used by server/.env.
  Do not run it against production without a verified backup. It backfills a unique username for existing users and creates movie_collection.
  Recommended: run with a one-off Node migration runner that loads server/.env and executes this SQL file. Do not paste DB credentials into chat.

E) TMDB:
  Request an API key from TMDB and put TMDB_API_KEY=... in server/.env only (never client/.env). Restart backend.
  The backend uses Node's global fetch; this project should run on a modern Node version.

F) Test:
  From project root: cd client && npm run build
  Return to root using cd ..
  Restart backend after mounting route.
  Test logged-in profile, save username, search a title, add it, change status/rating/favorite, then reload to confirm persistence.

Important limitations in this initial kit:
- Username is a public handle; login remains email/password.
- Existing avatar is shown from the current avatar_data_url field. Avatar editing remains in the current Profile Settings modal.
- Public profile API is GET /api/community/u/:username. Private profiles return 403 to public visitors.
- TMDB's API key is kept on the server. Posters use TMDB image URLs.
- Public-profile endpoint deliberately does not expose email or password-related data.

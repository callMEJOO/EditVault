const router = require('express').Router();
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const fields = 'id, username, display_name, bio, cover_url, avatar_data_url, profile_visibility, created_at';
const usernamePattern = /^[a-z0-9_]{3,24}$/;

router.get('/me', auth, async (req, res, next) => {
 try {
  const { rows } = await db.query(`SELECT ${fields} FROM users WHERE id=$1`, [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  res.set('Cache-Control','no-store'); res.json({ user: rows[0] });
 } catch (e) { next(e); }
});

router.put('/me', auth, async (req, res, next) => {
 try {
  const username = String(req.body?.username || '').trim().replace(/^@/,'').toLowerCase();
  const name = String(req.body?.display_name || '').trim();
  const bio = String(req.body?.bio || '').trim();
  const cover = req.body?.cover_url ? String(req.body.cover_url).trim() : null;
  const visibility = req.body?.profile_visibility === 'private' ? 'private' : 'public';
  if (!usernamePattern.test(username)) return res.status(400).json({error:'Username must be 3–24 characters: letters, numbers, underscores.'});
  if (name.length < 2 || name.length > 50) return res.status(400).json({error:'Display name must be 2–50 characters.'});
  if (bio.length > 280) return res.status(400).json({error:'Bio must be 280 characters or less.'});
  if (cover && (!/^https:\/\/\S+$/i.test(cover) || cover.length > 1000)) return res.status(400).json({error:'Cover must be a valid HTTPS URL.'});
  const { rows } = await db.query(`UPDATE users SET username=$1, display_name=$2, bio=$3, cover_url=$4, profile_visibility=$5 WHERE id=$6 RETURNING ${fields}`,
    [username,name,bio,cover,visibility,req.user.id]);
  if (!rows[0]) return res.status(404).json({error:'Account not found.'});
  res.set('Cache-Control','no-store'); res.json({user:rows[0],message:'Profile saved.'});
 } catch (e) { if (e.code==='23505') return res.status(409).json({error:'Username already taken.'}); next(e); }
});

router.get('/u/:username', async (req,res,next) => {
 try {
  const name = String(req.params.username || '').trim().replace(/^@/,'').toLowerCase();
  const { rows } = await db.query(`SELECT ${fields} FROM users WHERE LOWER(username)=$1`,[name]);
  if (!rows[0]) return res.status(404).json({error:'Profile not found.'});
  if (rows[0].profile_visibility === 'private') return res.status(403).json({error:'This profile is private.'});
  const { rows: collection } = await db.query(`SELECT id,tmdb_id,media_type,title,poster_path,release_year,status,rating,is_favorite,created_at
    FROM movie_collection WHERE user_id=$1 ORDER BY is_favorite DESC,updated_at DESC LIMIT 200`,[rows[0].id]);
  res.set('Cache-Control','public, max-age=30'); res.json({user:rows[0],collection});
 } catch(e) { next(e); }
});

router.get('/movies/search', async (req,res,next) => {
 try {
  const key = process.env.TMDB_API_KEY;
  if (!key) return res.status(503).json({error:'Add TMDB_API_KEY to server/.env to enable movie search.'});
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({results:[]});
  if (q.length > 100) return res.status(400).json({error:'Search query is too long.'});
  const type = ['movie','tv','multi'].includes(String(req.query.type)) ? String(req.query.type) : 'multi';
  const url = new URL(`https://api.themoviedb.org/3/search/${type}`);
  url.searchParams.set('api_key',key); url.searchParams.set('query',q); url.searchParams.set('include_adult','false');
  const response = await fetch(url);
  if (!response.ok) return res.status(502).json({error:'TMDB search is temporarily unavailable.'});
  const data = await response.json();
  const results = (data.results || []).map(x => ({tmdb_id:x.id,media_type:x.media_type || type,title:x.title || x.name || 'Untitled',
   overview:x.overview || '',poster_path:x.poster_path || null,release_year:String(x.release_date || x.first_air_date || '').slice(0,4) || null,
   vote_average:Number(x.vote_average || 0)})).filter(x => ['movie','tv'].includes(x.media_type)).slice(0,20);
  res.json({results});
 } catch(e) { next(e); }
});

router.get('/collection/me',auth,async(req,res,next)=>{
 try { const {rows}=await db.query(`SELECT * FROM movie_collection WHERE user_id=$1 ORDER BY is_favorite DESC,updated_at DESC`,[req.user.id]); res.set('Cache-Control','no-store'); res.json({collection:rows}); }
 catch(e){next(e);}
});
router.post('/collection',auth,async(req,res,next)=>{
 try {
  const id=Number(req.body?.tmdb_id), type=String(req.body?.media_type||''), title=String(req.body?.title||'').trim();
  const poster=req.body?.poster_path ? String(req.body.poster_path) : null;
  const year=Number(req.body?.release_year);
  if(!Number.isSafeInteger(id)||id<1||!['movie','tv'].includes(type)||!title||title.length>250) return res.status(400).json({error:'Choose a valid movie or series from search results.'});
  if(poster && (!poster.startsWith('/')||poster.length>200)) return res.status(400).json({error:'Invalid poster path.'});
  const status=['watching','watched','plan_to_watch','dropped'].includes(req.body?.status)?req.body.status:'plan_to_watch';
  const {rows}=await db.query(`INSERT INTO movie_collection(user_id,tmdb_id,media_type,title,poster_path,release_year,status)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,tmdb_id,media_type) DO UPDATE SET title=EXCLUDED.title,poster_path=EXCLUDED.poster_path,release_year=EXCLUDED.release_year,status=EXCLUDED.status,updated_at=NOW() RETURNING *`,
   [req.user.id,id,type,title,poster,Number.isInteger(year)&&year>=1880&&year<=2200?year:null,status]);
  res.status(201).json({item:rows[0]});
 }catch(e){next(e);}
});
router.patch('/collection/:id',auth,async(req,res,next)=>{
 try {
  const allowed={status:['watching','watched','plan_to_watch','dropped']};
  const sets=[], vals=[];
  const add=(col,val)=>{vals.push(val);sets.push(`${col}=$${vals.length}`);};
  if(req.body?.status!==undefined){if(!allowed.status.includes(req.body.status))return res.status(400).json({error:'Invalid status.'});add('status',req.body.status);}
  if(req.body?.rating!==undefined){const v=req.body.rating===''||req.body.rating===null?null:Number(req.body.rating);if(v!==null&&(!Number.isInteger(v)||v<1||v>10))return res.status(400).json({error:'Rating must be 1–10.'});add('rating',v);}
  if(req.body?.is_favorite!==undefined)add('is_favorite',Boolean(req.body.is_favorite));
  if(!sets.length)return res.status(400).json({error:'No valid changes.'});
  vals.push(req.params.id,req.user.id);
  const {rows}=await db.query(`UPDATE movie_collection SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length-1} AND user_id=$${vals.length} RETURNING *`,vals);
  if(!rows[0])return res.status(404).json({error:'Collection item not found.'});res.json({item:rows[0]});
 }catch(e){next(e);}
});
router.delete('/collection/:id',auth,async(req,res,next)=>{
 try{const r=await db.query('DELETE FROM movie_collection WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Collection item not found.'});res.json({success:true});}
 catch(e){next(e);}
});
module.exports=router;

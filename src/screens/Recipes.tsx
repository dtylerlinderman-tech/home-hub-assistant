import { useState } from 'preact/hooks';
import { adapter, config, showToast } from '../hub';
import { useAsync } from '../useAsync';
import { href, navigate } from '../router';
import { Icon } from '../components/Icon';
import { fmtMins } from '../logic/time';
import './recipes.css';

// Photo-less recipe tiles: purple, green, blue and rose glass.
const TILES = ['rgba(180, 156, 250, 0.14)', 'rgba(150, 190, 120, 0.13)', 'rgba(142, 189, 240, 0.13)', 'rgba(230, 140, 160, 0.13)'];

export function Recipes() {
  const [recipes] = useAsync(() => adapter.getRecipes(), []);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [showImport, setShowImport] = useState(false);
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState('');

  const chips = ['All', ...(config.mealie?.mealTags ?? [])];
  const q = query.trim().toLowerCase();
  const list = (recipes.value ?? []).filter((r) => (cat === 'All' || r.tags.includes(cat)) && (!q || r.name.toLowerCase().includes(q)));

  async function doImport() {
    if (!url.trim()) { setImportErr('Paste a link first.'); return; }
    setImporting(true);
    setImportErr('');
    try {
      const r = await adapter.importRecipe(url.trim());
      showToast('Imported “' + r.name + '”');
      navigate('/cook/' + encodeURIComponent(r.id));
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'Couldn’t import that link.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <main class="screen recipes">
      <header class="recipes-head">
        <span class="page-title" style={{ marginRight: '8px' }}>Recipes</span>
        <label class="recipes-search">
          <Icon name="search" size={22} />
          <span class="sr-only">Search recipes</span>
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder="Search recipes" />
        </label>
        <button type="button" class="btn recipes-add" onClick={() => setShowImport(!showImport)}><Icon name="plus" size={20} stroke={2.2} />Add from a link</button>
      </header>

      {showImport && (
        <form class="recipes-import" onSubmit={(e) => { e.preventDefault(); void doImport(); }}>
          <Icon name="link" size={22} color="var(--accent)" />
          <label class="recipes-import-field">
            <span class="recipes-import-hint" style={importErr ? { color: 'var(--alert-text)' } : undefined}>
              {importErr || (importing ? 'Importing… this can take a few seconds.' : 'Paste a recipe link from any site. Ingredients and steps are pulled in automatically.')}
            </span>
            <input type="url" placeholder="https://" value={url} onInput={(e) => setUrl(e.currentTarget.value)} disabled={importing} autoFocus />
          </label>
          <button type="submit" class="btn recipes-import-go" disabled={importing}>{importing ? 'Importing…' : 'Import'}</button>
        </form>
      )}

      <div role="group" aria-label="Filter by category" class="recipes-chips">
        {chips.map((c) => (
          <button key={c} type="button" class={'btn recipes-chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div class="recipes-scroll">
        {recipes.loading ? null : recipes.value === null ? (
          <div class="recipes-empty">Recipes aren’t connected yet.</div>
        ) : list.length === 0 ? (
          <div class="recipes-empty">No recipes match that search.</div>
        ) : (
          <div class="recipes-grid">
            {list.map((r, i) => (
              <a key={r.id} href={href('/cook/' + encodeURIComponent(r.id))} class="plain recipes-card">
                <span class="recipes-tile" style={{ background: TILES[i % TILES.length] }}>
                  {r.image ? <img src={r.image} alt="" loading="lazy" /> : <Icon name="meals" size={30} stroke={1.6} />}
                </span>
                <span class="recipes-card-text">
                  <span class="recipes-name">{r.name}</span>
                  <span class="recipes-meta">{[r.mins ? fmtMins(r.mins) : null, ...r.tags].filter(Boolean).join(' · ')}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

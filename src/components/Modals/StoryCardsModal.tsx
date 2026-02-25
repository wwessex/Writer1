import { useState, useMemo } from 'react';
import { Dialog, Input } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import type { CharacterEntity, WorldEntry } from '@/types';
import styles from './Modals.module.css';

interface StoryCardsModalProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'all' | 'characters' | 'locations';

type CharacterRole = CharacterEntity['role'];
type WorldCategory = WorldEntry['category'];

const STORAGE_KEY_CHARS = 'draftharbour_characters';
const STORAGE_KEY_WORLD = 'draftharbour_world';

function loadEntities<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

const ROLE_COLORS: Record<CharacterRole, string> = {
  protagonist: 'protagonist',
  antagonist: 'antagonist',
  supporting: 'supporting',
  minor: 'minor',
  other: 'other',
};

const ROLE_LABELS: Record<CharacterRole, string> = {
  protagonist: 'Protagonist',
  antagonist: 'Antagonist',
  supporting: 'Supporting',
  minor: 'Minor',
  other: 'Other',
};

const CATEGORY_ICONS: Record<WorldCategory, string> = {
  location: 'place',
  lore: 'menu_book',
  item: 'inventory_2',
  event: 'event',
  organisation: 'groups',
  other: 'more_horiz',
};

const CATEGORY_LABELS: Record<WorldCategory, string> = {
  location: 'Location',
  lore: 'Lore',
  item: 'Item',
  event: 'Event',
  organisation: 'Organisation',
  other: 'Other',
};

const CHARACTER_ROLES: CharacterRole[] = ['protagonist', 'antagonist', 'supporting', 'minor', 'other'];
const WORLD_CATEGORIES: WorldCategory[] = ['location', 'lore', 'item', 'event', 'organisation', 'other'];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

export function StoryCardsModal({ open, onClose }: StoryCardsModalProps) {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilters, setRoleFilters] = useState<Set<CharacterRole>>(new Set());
  const [categoryFilters, setCategoryFilters] = useState<Set<WorldCategory>>(new Set());
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const characters = useMemo<CharacterEntity[]>(() => {
    const all = loadEntities<CharacterEntity>(STORAGE_KEY_CHARS);
    return all.filter(c => c.novelId === '' || c.novelId === state.novelId);
  }, [state.novelId, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const worldEntries = useMemo<WorldEntry[]>(() => {
    const all = loadEntities<WorldEntry>(STORAGE_KEY_WORLD);
    return all.filter(w => w.novelId === '' || w.novelId === state.novelId);
  }, [state.novelId, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = searchQuery.toLowerCase().trim();

  const filteredCharacters = useMemo(() => {
    let result = characters;
    if (query) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.aliases.some(a => a.toLowerCase().includes(query)) ||
        c.description.toLowerCase().includes(query)
      );
    }
    if (roleFilters.size > 0) {
      result = result.filter(c => roleFilters.has(c.role));
    }
    return result;
  }, [characters, query, roleFilters]);

  const filteredWorldEntries = useMemo(() => {
    let result = worldEntries;
    if (query) {
      result = result.filter(w =>
        w.name.toLowerCase().includes(query) ||
        w.description.toLowerCase().includes(query) ||
        w.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    if (categoryFilters.size > 0) {
      result = result.filter(w => categoryFilters.has(w.category));
    }
    return result;
  }, [worldEntries, query, categoryFilters]);

  const showCharacters = activeTab === 'all' || activeTab === 'characters';
  const showLocations = activeTab === 'all' || activeTab === 'locations';

  const toggleRoleFilter = (role: CharacterRole) => {
    setRoleFilters(prev => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const toggleCategoryFilter = (cat: WorldCategory) => {
    setCategoryFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleCardClick = (id: string) => {
    setExpandedCardId(prev => prev === id ? null : id);
  };

  const totalCards = (showCharacters ? filteredCharacters.length : 0) + (showLocations ? filteredWorldEntries.length : 0);

  return (
    <Dialog open={open} onClose={onClose} title="Story Cards" size="large">
      <div className={styles.storyCards}>
        {/* Toolbar */}
        <div className={styles.storyCardsToolbar}>
          <div className={styles.storyCardsSearch}>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search characters & locations..."
            />
          </div>
          <div className={styles.storyCardsTabs}>
            {(['all', 'characters', 'locations'] as const).map(tab => (
              <button
                key={tab}
                className={`${styles.storyCardsTab} ${activeTab === tab ? styles['storyCardsTab--active'] : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'all' ? 'All' : tab === 'characters' ? 'Characters' : 'Locations'}
              </button>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className={styles.storyCardsFilters}>
          {showCharacters && CHARACTER_ROLES.map(role => (
            <button
              key={role}
              className={`${styles.storyCardsFilter} ${roleFilters.has(role) ? styles['storyCardsFilter--active'] : ''}`}
              onClick={() => toggleRoleFilter(role)}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
          {showLocations && WORLD_CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`${styles.storyCardsFilter} ${categoryFilters.has(cat) ? styles['storyCardsFilter--active'] : ''}`}
              onClick={() => toggleCategoryFilter(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Card grid */}
        {totalCards === 0 ? (
          <div className={styles.storyCardsEmpty}>
            <span className="material-symbols-rounded">contact_page</span>
            <p>
              {characters.length === 0 && worldEntries.length === 0
                ? 'No characters or world entries yet. Add them via the Character & World Bible.'
                : 'No results match your search or filters.'}
            </p>
          </div>
        ) : (
          <div className={styles.storyCardsGrid}>
            {/* Character cards */}
            {showCharacters && filteredCharacters.map(character => {
              const isExpanded = expandedCardId === character.id;
              return (
                <div
                  key={character.id}
                  className={styles.storyCard}
                  onClick={() => handleCardClick(character.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(character.id); } }}
                  aria-expanded={isExpanded}
                >
                  <div className={`${styles.storyCard__avatar} ${styles[`storyCard__avatar--${ROLE_COLORS[character.role]}`]}`}>
                    {getInitials(character.name) || '?'}
                  </div>
                  <div className={styles.storyCard__name}>{character.name}</div>
                  <div className={styles.storyCard__role}>{ROLE_LABELS[character.role]}</div>
                  {character.description && (
                    <div className={styles.storyCard__desc}>{character.description}</div>
                  )}
                  {character.traits.length > 0 && (
                    <div className={styles.storyCard__pills}>
                      {character.traits.slice(0, 3).map(trait => (
                        <span key={trait} className={styles.storyCard__pill}>{trait}</span>
                      ))}
                      {character.traits.length > 3 && (
                        <span className={styles.storyCard__pill}>+{character.traits.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className={styles.storyCard__meta}>
                    {character.relationships.length > 0 && (
                      <>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.8125rem' }}>group</span>
                        {character.relationships.length} {character.relationships.length === 1 ? 'relationship' : 'relationships'}
                      </>
                    )}
                  </div>
                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className={styles.storyCard__expanded}>
                      {character.aliases.length > 0 && (
                        <div className={styles.storyCard__expandedRow}>
                          <strong>Aliases:</strong> {character.aliases.join(', ')}
                        </div>
                      )}
                      {character.traits.length > 0 && (
                        <div className={styles.storyCard__expandedRow}>
                          <strong>All traits:</strong> {character.traits.join(', ')}
                        </div>
                      )}
                      {character.notes && (
                        <div className={styles.storyCard__expandedRow}>
                          <strong>Notes:</strong> {character.notes}
                        </div>
                      )}
                      {character.relationships.length > 0 && (
                        <div className={styles.storyCard__expandedRow}>
                          <strong>Relationships:</strong>
                          {character.relationships.map((rel, i) => {
                            const target = characters.find(c => c.id === rel.targetId);
                            return (
                              <span key={i}>
                                {i > 0 ? ', ' : ' '}
                                {target ? target.name : 'Unknown'} ({rel.type})
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* World entry cards */}
            {showLocations && filteredWorldEntries.map(entry => {
              const isExpanded = expandedCardId === entry.id;
              const linkedCount = entry.linkedCharacters.length;
              return (
                <div
                  key={entry.id}
                  className={styles.storyCard}
                  onClick={() => handleCardClick(entry.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(entry.id); } }}
                  aria-expanded={isExpanded}
                >
                  <div className={styles.storyCard__icon}>
                    <span className="material-symbols-rounded">{CATEGORY_ICONS[entry.category]}</span>
                  </div>
                  <div className={styles.storyCard__name}>{entry.name}</div>
                  <div className={styles.storyCard__role}>{CATEGORY_LABELS[entry.category]}</div>
                  {entry.description && (
                    <div className={styles.storyCard__desc}>{entry.description}</div>
                  )}
                  {entry.tags.length > 0 && (
                    <div className={styles.storyCard__pills}>
                      {entry.tags.slice(0, 3).map(tag => (
                        <span key={tag} className={styles.storyCard__pill}>{tag}</span>
                      ))}
                      {entry.tags.length > 3 && (
                        <span className={styles.storyCard__pill}>+{entry.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className={styles.storyCard__meta}>
                    {linkedCount > 0 && (
                      <>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.8125rem' }}>person</span>
                        {linkedCount} linked {linkedCount === 1 ? 'character' : 'characters'}
                      </>
                    )}
                  </div>
                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className={styles.storyCard__expanded}>
                      {entry.tags.length > 0 && (
                        <div className={styles.storyCard__expandedRow}>
                          <strong>All tags:</strong> {entry.tags.join(', ')}
                        </div>
                      )}
                      {entry.notes && (
                        <div className={styles.storyCard__expandedRow}>
                          <strong>Notes:</strong> {entry.notes}
                        </div>
                      )}
                      {linkedCount > 0 && (
                        <div className={styles.storyCard__expandedRow}>
                          <strong>Linked characters:</strong>
                          {entry.linkedCharacters.map((charId, i) => {
                            const character = characters.find(c => c.id === charId);
                            return (
                              <span key={charId}>
                                {i > 0 ? ', ' : ' '}
                                {character ? character.name : 'Unknown'}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}

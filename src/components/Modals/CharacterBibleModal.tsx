import { useState, useMemo } from 'react';
import { Dialog, Button, Input, Textarea, IconButton } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import { generateId } from '@/lib/utils';
import type { CharacterEntity, WorldEntry } from '@/types';
import styles from './Modals.module.css';

interface CharacterBibleModalProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'characters' | 'world';

const ROLE_OPTIONS = [
  { value: 'protagonist', label: 'Protagonist' },
  { value: 'antagonist', label: 'Antagonist' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'minor', label: 'Minor' },
  { value: 'other', label: 'Other' }
];

const WORLD_CATEGORY_OPTIONS = [
  { value: 'location', label: 'Location' },
  { value: 'lore', label: 'Lore' },
  { value: 'item', label: 'Item' },
  { value: 'event', label: 'Event' },
  { value: 'organization', label: 'Organization' },
  { value: 'other', label: 'Other' }
];

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

function saveEntities<T>(key: string, entities: T[]) {
  localStorage.setItem(key, JSON.stringify(entities));
}

export function CharacterBibleModal({ open, onClose }: CharacterBibleModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('characters');
  const [characters, setCharacters] = useState<CharacterEntity[]>(() => loadEntities(STORAGE_KEY_CHARS));
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>(() => loadEntities(STORAGE_KEY_WORLD));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Persist on changes
  const updateCharacters = (updated: CharacterEntity[]) => {
    setCharacters(updated);
    saveEntities(STORAGE_KEY_CHARS, updated);
  };

  const updateWorldEntries = (updated: WorldEntry[]) => {
    setWorldEntries(updated);
    saveEntities(STORAGE_KEY_WORLD, updated);
  };

  const addCharacter = () => {
    const newChar: CharacterEntity = {
      id: generateId(),
      novelId: '',
      name: 'New Character',
      aliases: [],
      description: '',
      role: 'supporting',
      traits: [],
      notes: '',
      relationships: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    updateCharacters([...characters, newChar]);
    setSelectedId(newChar.id);
  };

  const addWorldEntry = () => {
    const newEntry: WorldEntry = {
      id: generateId(),
      novelId: '',
      category: 'location',
      name: 'New Entry',
      description: '',
      tags: [],
      linkedCharacters: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    updateWorldEntries([...worldEntries, newEntry]);
    setSelectedId(newEntry.id);
  };

  const updateCharacter = (id: string, updates: Partial<CharacterEntity>) => {
    updateCharacters(characters.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    ));
  };

  const updateWorldEntry = (id: string, updates: Partial<WorldEntry>) => {
    updateWorldEntries(worldEntries.map(e =>
      e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e
    ));
  };

  const deleteCharacter = (id: string) => {
    updateCharacters(characters.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const deleteWorldEntry = (id: string) => {
    updateWorldEntries(worldEntries.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const filteredCharacters = useMemo(() =>
    characters.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [characters, searchQuery]
  );

  const filteredWorld = useMemo(() =>
    worldEntries.filter(e =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [worldEntries, searchQuery]
  );

  const selectedCharacter = characters.find(c => c.id === selectedId);
  const selectedWorld = worldEntries.find(e => e.id === selectedId);

  return (
    <Dialog open={open} onClose={onClose} title="Character & World Bible" size="large">
      <div className={styles.bibleLayout}>
        {/* Sidebar */}
        <div className={styles.bibleSidebar}>
          {/* Tab switcher */}
          <div className={styles.bibleTabs}>
            <button
              className={`${styles.bibleTab} ${activeTab === 'characters' ? styles['bibleTab--active'] : ''}`}
              onClick={() => { setActiveTab('characters'); setSelectedId(null); }}
            >
              <span className="material-symbols-rounded">person</span>
              Characters ({characters.length})
            </button>
            <button
              className={`${styles.bibleTab} ${activeTab === 'world' ? styles['bibleTab--active'] : ''}`}
              onClick={() => { setActiveTab('world'); setSelectedId(null); }}
            >
              <span className="material-symbols-rounded">public</span>
              World ({worldEntries.length})
            </button>
          </div>

          {/* Search */}
          <div className={styles.bibleSearch}>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
            />
          </div>

          {/* List */}
          <div className={styles.bibleList}>
            {activeTab === 'characters' ? (
              <>
                {filteredCharacters.map(char => (
                  <div
                    key={char.id}
                    className={`${styles.bibleItem} ${selectedId === char.id ? styles['bibleItem--active'] : ''}`}
                    onClick={() => setSelectedId(char.id)}
                  >
                    <span className={styles.bibleItem__name}>{char.name}</span>
                    <span className={styles.bibleItem__meta}>{char.role}</span>
                  </div>
                ))}
                <Button variant="ghost" onClick={addCharacter}>
                  <span className="material-symbols-rounded">add</span>
                  Add Character
                </Button>
              </>
            ) : (
              <>
                {filteredWorld.map(entry => (
                  <div
                    key={entry.id}
                    className={`${styles.bibleItem} ${selectedId === entry.id ? styles['bibleItem--active'] : ''}`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className={styles.bibleItem__name}>{entry.name}</span>
                    <span className={styles.bibleItem__meta}>{entry.category}</span>
                  </div>
                ))}
                <Button variant="ghost" onClick={addWorldEntry}>
                  <span className="material-symbols-rounded">add</span>
                  Add Entry
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className={styles.bibleDetail}>
          {activeTab === 'characters' && selectedCharacter ? (
            <CharacterEditor
              character={selectedCharacter}
              allCharacters={characters}
              onUpdate={(updates) => updateCharacter(selectedCharacter.id, updates)}
              onDelete={() => deleteCharacter(selectedCharacter.id)}
            />
          ) : activeTab === 'world' && selectedWorld ? (
            <WorldEditor
              entry={selectedWorld}
              characters={characters}
              onUpdate={(updates) => updateWorldEntry(selectedWorld.id, updates)}
              onDelete={() => deleteWorldEntry(selectedWorld.id)}
            />
          ) : (
            <div className={styles.bibleEmptyDetail}>
              <span className="material-symbols-rounded">
                {activeTab === 'characters' ? 'person_search' : 'explore'}
              </span>
              <p>Select an entry to view details</p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function CharacterEditor({
  character,
  allCharacters,
  onUpdate,
  onDelete
}: {
  character: CharacterEntity;
  allCharacters: CharacterEntity[];
  onUpdate: (updates: Partial<CharacterEntity>) => void;
  onDelete: () => void;
}) {
  const [newTrait, setNewTrait] = useState('');

  const addTrait = () => {
    if (newTrait.trim()) {
      onUpdate({ traits: [...character.traits, newTrait.trim()] });
      setNewTrait('');
    }
  };

  const removeTrait = (index: number) => {
    onUpdate({ traits: character.traits.filter((_, i) => i !== index) });
  };

  return (
    <div className={styles.bibleEditor}>
      <div className={styles.bibleEditor__header}>
        <Input
          value={character.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Character Name"
          variant="title"
        />
        <IconButton icon="delete" label="Delete character" onClick={onDelete} />
      </div>

      <div className={styles.bibleEditor__fieldRow}>
        <div className={styles.bibleEditor__field}>
          <label>Role</label>
          <Select
            options={ROLE_OPTIONS}
            value={character.role}
            onChange={e => onUpdate({ role: e.target.value as CharacterEntity['role'] })}
          />
        </div>
        <div className={styles.bibleEditor__field}>
          <label>Aliases</label>
          <Input
            value={character.aliases.join(', ')}
            onChange={e => onUpdate({ aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="Comma-separated aliases"
          />
        </div>
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Description</label>
        <Textarea
          value={character.description}
          onChange={e => onUpdate({ description: e.target.value })}
          placeholder="Physical description, personality, background..."
          rows={4}
        />
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Traits</label>
        <div className={styles.tagList}>
          {character.traits.map((trait, i) => (
            <span key={i} className={styles.tag}>
              {trait}
              <button onClick={() => removeTrait(i)}>&times;</button>
            </span>
          ))}
          <div className={styles.tagInput}>
            <Input
              value={newTrait}
              onChange={e => setNewTrait(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTrait(); } }}
              placeholder="Add trait..."
            />
          </div>
        </div>
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Relationships</label>
        <div className={styles.relationshipList}>
          {character.relationships.map((rel, i) => {
            const target = allCharacters.find(c => c.id === rel.targetId);
            return (
              <div key={i} className={styles.relationship}>
                <span>{target?.name || 'Unknown'}</span>
                <span className={styles.relationship__type}>{rel.type}</span>
                <IconButton
                  icon="close"
                  label="Remove"
                  onClick={() => onUpdate({
                    relationships: character.relationships.filter((_, idx) => idx !== i)
                  })}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Notes</label>
        <Textarea
          value={character.notes}
          onChange={e => onUpdate({ notes: e.target.value })}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>
    </div>
  );
}

function WorldEditor({
  entry,
  characters,
  onUpdate,
  onDelete
}: {
  entry: WorldEntry;
  characters: CharacterEntity[];
  onUpdate: (updates: Partial<WorldEntry>) => void;
  onDelete: () => void;
}) {
  const [newTag, setNewTag] = useState('');

  const addTag = () => {
    if (newTag.trim()) {
      onUpdate({ tags: [...entry.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    onUpdate({ tags: entry.tags.filter((_, i) => i !== index) });
  };

  return (
    <div className={styles.bibleEditor}>
      <div className={styles.bibleEditor__header}>
        <Input
          value={entry.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Entry Name"
          variant="title"
        />
        <IconButton icon="delete" label="Delete entry" onClick={onDelete} />
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Category</label>
        <Select
          options={WORLD_CATEGORY_OPTIONS}
          value={entry.category}
          onChange={e => onUpdate({ category: e.target.value as WorldEntry['category'] })}
        />
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Description</label>
        <Textarea
          value={entry.description}
          onChange={e => onUpdate({ description: e.target.value })}
          placeholder="Detailed description..."
          rows={5}
        />
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Tags</label>
        <div className={styles.tagList}>
          {entry.tags.map((tag, i) => (
            <span key={i} className={styles.tag}>
              {tag}
              <button onClick={() => removeTag(i)}>&times;</button>
            </span>
          ))}
          <div className={styles.tagInput}>
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Add tag..."
            />
          </div>
        </div>
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Linked Characters</label>
        <div className={styles.linkedList}>
          {entry.linkedCharacters.map((charId, i) => {
            const char = characters.find(c => c.id === charId);
            return char ? (
              <span key={i} className={styles.tag}>
                {char.name}
                <button onClick={() => onUpdate({
                  linkedCharacters: entry.linkedCharacters.filter(id => id !== charId)
                })}>&times;</button>
              </span>
            ) : null;
          })}
        </div>
      </div>

      <div className={styles.bibleEditor__field}>
        <label>Notes</label>
        <Textarea
          value={entry.notes}
          onChange={e => onUpdate({ notes: e.target.value })}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>
    </div>
  );
}

import { Search, X } from 'lucide-react'

// Search + category chips above an item picker. Shared by the outfit log and
// trip planning so the two pickers stay identical as either one changes.
export function PickerFilters({ query, setQuery, category, setCategory, categories }: {
  query: string
  setQuery: (v: string) => void
  category: string
  setCategory: (v: string) => void
  categories: string[]
}) {
  const chip = (active: boolean) =>
    `shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-medium border-none cursor-pointer transition-colors ${
      active ? 'bg-accent text-white' : 'bg-card text-text-secondary'
    }`
  return (
    <div className="shrink-0">
      <div className="px-5 mb-2.5">
        <div className="flex items-center gap-2.5 bg-card rounded-[14px] px-4 py-3">
          <Search size={16} className="text-text-tertiary shrink-0" />
          <input
            className="flex-1 bg-transparent text-[13px] text-text-primary outline-none border-none placeholder:text-text-tertiary"
            placeholder="Search by name, category, or color"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 bg-transparent border-none cursor-pointer flex">
              <X size={14} className="text-text-tertiary" />
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => setCategory('')} className={chip(!category)}>All</button>
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(category === c ? '' : c)} className={chip(category === c)}>{c}</button>
        ))}
      </div>
    </div>
  )
}

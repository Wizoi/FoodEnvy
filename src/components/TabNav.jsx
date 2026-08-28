const TABS = [
  { id: 'profiles', label: 'Profiles' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'plan', label: 'Weekly Plan' },
  { id: 'meals', label: 'Meal Ideas' },
  { id: 'settings', label: 'Settings' },
];

export default function TabNav({ activeTab, onChange }) {
  return (
    <nav className="tab-nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTab ? 'tab-nav-button active' : 'tab-nav-button'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

import { useEffect, useState } from 'react';
import TabNav from './components/TabNav.jsx';
import ProfileList from './components/profiles/ProfileList.jsx';
import ProfileWizard from './components/profiles/ProfileWizard.jsx';
import InventoryList from './components/inventory/InventoryList.jsx';
import InventoryItemForm from './components/inventory/InventoryItemForm.jsx';
import MealSuggestions from './components/meals/MealSuggestions.jsx';
import { listMembers, saveMember, deleteMember } from './db/profiles.js';
import { listInventory, saveInventoryItem, deleteInventoryItem } from './db/inventory.js';
import { listRecipes, seedRecipesIfEmpty } from './db/recipes.js';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('profiles');
  const [members, setMembers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [editingMember, setEditingMember] = useState(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);

  useEffect(() => {
    seedRecipesIfEmpty()
      .then(() => Promise.all([listMembers(), listInventory(), listRecipes()]))
      .then(([m, i, r]) => {
        setMembers(m);
        setInventory(i);
        setRecipes(r);
      });
  }, []);

  async function handleSaveMember(member) {
    const saved = await saveMember(member);
    setMembers((prev) => {
      const rest = prev.filter((m) => m.id !== saved.id);
      return [...rest, saved];
    });
    setShowMemberForm(false);
    setEditingMember(null);
  }

  async function handleDeleteMember(id) {
    await deleteMember(id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleImportMembers(importedMembers) {
    const saved = await Promise.all(importedMembers.map((m) => saveMember(m)));
    setMembers((prev) => [...prev, ...saved]);
  }

  async function handleSaveItem(item) {
    const saved = await saveInventoryItem(item);
    setInventory((prev) => {
      const rest = prev.filter((i) => i.id !== saved.id);
      return [...rest, saved];
    });
    setShowItemForm(false);
    setEditingItem(null);
  }

  async function handleDeleteItem(id) {
    await deleteInventoryItem(id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>FoodEnvy</h1>
        <p className="muted">Family-aware meal planning from what's already in your kitchen.</p>
      </header>

      <TabNav activeTab={activeTab} onChange={setActiveTab} />

      <main>
        {activeTab === 'profiles' &&
          (showMemberForm ? (
            <ProfileWizard
              initialMember={editingMember}
              onSave={handleSaveMember}
              onCancel={() => {
                setShowMemberForm(false);
                setEditingMember(null);
              }}
            />
          ) : (
            <ProfileList
              members={members}
              onEdit={(m) => {
                setEditingMember(m);
                setShowMemberForm(true);
              }}
              onDelete={handleDeleteMember}
              onAddNew={() => {
                setEditingMember(null);
                setShowMemberForm(true);
              }}
              onImport={handleImportMembers}
            />
          ))}

        {activeTab === 'inventory' &&
          (showItemForm ? (
            <InventoryItemForm
              initialItem={editingItem}
              onSave={handleSaveItem}
              onCancel={() => {
                setShowItemForm(false);
                setEditingItem(null);
              }}
            />
          ) : (
            <InventoryList
              items={inventory}
              onEdit={(item) => {
                setEditingItem(item);
                setShowItemForm(true);
              }}
              onDelete={handleDeleteItem}
              onAddNew={() => {
                setEditingItem(null);
                setShowItemForm(true);
              }}
            />
          ))}

        {activeTab === 'meals' && <MealSuggestions members={members} inventory={inventory} recipes={recipes} />}
      </main>
    </div>
  );
}

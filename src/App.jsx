import { useEffect, useMemo, useState } from 'react';
import TabNav from './components/TabNav.jsx';
import ProfileList from './components/profiles/ProfileList.jsx';
import ProfileWizard from './components/profiles/ProfileWizard.jsx';
import InventoryList from './components/inventory/InventoryList.jsx';
import InventoryItemForm from './components/inventory/InventoryItemForm.jsx';
import MealSuggestions from './components/meals/MealSuggestions.jsx';
import PlanRequestPanel from './components/plan/PlanRequestPanel.jsx';
import WeeklyPlanView from './components/plan/WeeklyPlanView.jsx';
import SettingsPanel from './components/settings/SettingsPanel.jsx';
import { listMembers, saveMember, deleteMember } from './db/profiles.js';
import { listInventory, saveInventoryItem, deleteInventoryItem } from './db/inventory.js';
import { listRecipes, seedRecipesIfEmpty } from './db/recipes.js';
import { listPlannedWeeks, savePlannedWeek, deletePlannedWeek, swapMealSlot, applyMemberFork, revalidatePlan } from './db/plannedWeeks.js';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('profiles');
  const [members, setMembers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planReady, setPlanReady] = useState(false);

  useEffect(() => {
    seedRecipesIfEmpty()
      .then(() => Promise.all([listMembers(), listInventory(), listRecipes(), listPlannedWeeks()]))
      .then(([m, i, r, plans]) => {
        setMembers(m);
        setInventory(i);
        setRecipes(r);
        setActivePlan(plans[plans.length - 1] ?? null);
      });
  }, []);

  // Reload plan from storage when switching to plan tab
  useEffect(() => {
    if (activeTab === 'plan') {
      listPlannedWeeks().then((plans) => {
        setActivePlan(plans[plans.length - 1] ?? null);
      });
    }
  }, [activeTab]);

  // A plan is a snapshot; profiles/inventory aren't -- re-validate against
  // current state on every render rather than trusting what's stored.
  const displayPlan = useMemo(
    () => (activePlan ? revalidatePlan(activePlan, members, inventory) : null),
    [activePlan, members, inventory],
  );

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

  async function handleImportInventory(importedItems) {
    const saved = await Promise.all(importedItems.map((item) => saveInventoryItem(item)));
    setInventory((prev) => [...prev, ...saved]);
  }

  async function handleImportPlan(parsedPlan) {
    const saved = await savePlannedWeek(parsedPlan);
    setActivePlan(saved);
    setIsGeneratingPlan(false);
    setPlanReady(true);
    setTimeout(() => setPlanReady(false), 5000); // Clear notification after 5s
  }

  function handleGenerationStart() {
    setIsGeneratingPlan(true);
    setPlanReady(false);
  }

  async function handleSwapMeal(dayIndex, slotId, alternateIndex) {
    const updated = swapMealSlot(activePlan, dayIndex, slotId, alternateIndex, members, inventory);
    await savePlannedWeek(updated);
    setActivePlan(updated);
  }

  async function handleApplyFork(dayIndex, slotId, memberId) {
    const updated = applyMemberFork(activePlan, dayIndex, slotId, memberId);
    await savePlannedWeek(updated);
    setActivePlan(updated);
  }

  async function handleDeletePlan() {
    await deletePlannedWeek(activePlan.id);
    setActivePlan(null);
  }

  return (
    <div className="app">
      {planReady && (
        <div className="plan-ready-banner">
          <p>✅ Your plan is ready! <button onClick={() => setActiveTab('plan')} className="banner-link">View it now</button></p>
        </div>
      )}

      {isGeneratingPlan && (
        <div className="generating-banner">
          <p>⏳ Generating your meal plan in the background...</p>
        </div>
      )}

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
              onImport={handleImportInventory}
              onGoToPlan={() => setActiveTab('plan')}
            />
          ))}

        {activeTab === 'plan' &&
          (displayPlan ? (
            <WeeklyPlanView
              plan={displayPlan}
              members={members}
              onSwap={handleSwapMeal}
              onApplyFork={handleApplyFork}
              onDelete={handleDeletePlan}
            />
          ) : (
            <PlanRequestPanel
              members={members}
              inventory={inventory}
              recipes={recipes}
              onImportPlan={handleImportPlan}
              onGoToSettings={() => setActiveTab('settings')}
              onGenerationStart={handleGenerationStart}
              isGeneratingPlan={isGeneratingPlan}
              onAbortGeneration={() => setIsGeneratingPlan(false)}
            />
          ))}

        {activeTab === 'meals' && <MealSuggestions members={members} inventory={inventory} recipes={recipes} />}

        {activeTab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
}

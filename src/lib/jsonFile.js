// Client-side JSON export/import helpers -- no server round-trip, since
// FoodEnvy has no backend. Shared by ProfileList and InventoryList's
// export/import buttons so the two stay in lockstep as the pattern evolves.
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Reads a file input's chosen file as JSON and hands it to onLoad, or alerts
// the user via onError if it's not valid JSON. Always resets the input's
// value so choosing the same file twice in a row still fires onChange.
export function readJsonFile(inputElement, onLoad, onError) {
  const file = inputElement.files?.[0];
  inputElement.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      onLoad(JSON.parse(reader.result));
    } catch (err) {
      onError(err);
    }
  };
  reader.readAsText(file);
}

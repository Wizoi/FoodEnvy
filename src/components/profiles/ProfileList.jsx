import { useRef } from 'react';

const EXPORT_FORMAT_MARKER = 'foodEnvyProfileExport';

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ProfileList({ members, onEdit, onDelete, onAddNew, onImport }) {
  const fileInputRef = useRef(null);

  function handleExport() {
    downloadJson(`foodenvy-profile-${new Date().toISOString().slice(0, 10)}.json`, {
      [EXPORT_FORMAT_MARKER]: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      members,
    });
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.members)) throw new Error('No members found in file.');
        // Strip ids so each imported member is saved as new rather than
        // silently overwriting an existing member that happens to share an id
        // from a different device/export.
        onImport(data.members.map(({ id: _id, ...rest }) => rest));
      } catch (err) {
        window.alert(`Could not import profile: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="profile-list">
      {members.length === 0 && <p className="empty-state">No family members yet — add one to get started.</p>}

      <ul>
        {members.map((member) => (
          <li key={member.id} className="profile-card">
            <div className="profile-card-header">
              <strong>{member.name}</strong>
              <div>
                <button type="button" onClick={() => onEdit(member)}>
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(member.id)}>
                  Delete
                </button>
              </div>
            </div>
            {member.restrictions.length > 0 && (
              <div className="badge-row">
                {member.restrictions.map((r, i) => (
                  <span key={i} className={`badge badge-${r.category}`}>
                    {r.category}: {r.value}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="profile-list-actions">
        <button type="button" onClick={onAddNew}>
          + Add family member
        </button>
        <button type="button" onClick={handleExport} disabled={members.length === 0}>
          Export profile
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import profile
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} hidden />
      </div>
    </div>
  );
}

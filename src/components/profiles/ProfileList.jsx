export default function ProfileList({ members, onEdit, onDelete, onAddNew }) {
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

      <button type="button" onClick={onAddNew}>
        + Add family member
      </button>
    </div>
  );
}

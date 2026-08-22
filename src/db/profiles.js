import { getAll, put, remove, STORES } from './database.js';

export function listMembers() {
  return getAll(STORES.MEMBERS);
}

export function saveMember(member) {
  const record = member.id ? member : { ...member, id: crypto.randomUUID() };
  return put(STORES.MEMBERS, record).then(() => record);
}

export function deleteMember(id) {
  return remove(STORES.MEMBERS, id);
}

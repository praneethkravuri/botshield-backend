export class DevMemorySessionStorage {
  constructor() {
    this.sessions = new Map();
  }

  get ready() {
    return Promise.resolve(true);
  }

  async storeSession(session) {
    this.sessions.set(session.id, session);
    return true;
  }

  async loadSession(id) {
    return this.sessions.get(id);
  }

  async deleteSession(id) {
    this.sessions.delete(id);
    return true;
  }

  async deleteSessions(ids) {
    ids.forEach((id) => this.sessions.delete(id));
    return true;
  }

  async findSessionsByShop(shop) {
    return [...this.sessions.values()].filter((session) => session.shop === shop);
  }
}

// Mock Supabase service for UI testing
export class MockSupabaseService {
  private mockData: {
    users: Record<string, any>[];
    missions: Record<string, any>[];
    sources: Record<string, any>[];
    extracts: Record<string, any>[];
    actions: Record<string, any>[];
    briefings: Record<string, any>[];
    meetings: Record<string, any>[];
  } = {
    users: [],
    missions: [],
    sources: [],
    extracts: [],
    actions: [],
    briefings: [],
    meetings: [],
  };

  async createUser(userData: { email: string }) {
    const user = { id: `user_${Date.now()}`, ...userData, subscription_tier: 'free', created_at: new Date().toISOString() };
    this.mockData.users.push(user);
    return user;
  }

  async getUser(userId: string) {
    return this.mockData.users.find(u => u.id === userId) || null;
  }

  async createMission(missionData: any) {
    const mission = { id: `mission_${Date.now()}`, ...missionData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.mockData.missions.push(mission);
    return mission;
  }

  async getMissions(userId: string, status?: string) {
    let missions = this.mockData.missions.filter(m => m.user_id === userId);
    if (status) missions = missions.filter(m => m.status === status);
    return missions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createSource(sourceData: any) {
    const source = { id: `source_${Date.now()}`, ...sourceData, created_at: new Date().toISOString() };
    this.mockData.sources.push(source);
    return source;
  }

  async getSource(sourceId: string) {
    return this.mockData.sources.find(s => s.id === sourceId) || null;
  }

  async createExtract(extractData: any) {
    const extract = { id: `extract_${Date.now()}`, ...extractData, created_at: new Date().toISOString() };
    this.mockData.extracts.push(extract);
    return extract;
  }

  async getExtracts(sourceId: string) {
    return this.mockData.extracts.filter(e => e.source_id === sourceId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createActions(actionData: any[]) {
    const actions = actionData.map(action => ({
      id: `action_${Date.now()}_${Math.random()}`,
      ...action,
      created_at: new Date().toISOString(),
      status: 'pending'
    }));
    this.mockData.actions.push(...actions);
    return actions;
  }

  async getActions(missionId: string, status?: string) {
    let actions = this.mockData.actions.filter(a => a.mission_id === missionId);
    if (status) actions = actions.filter(a => a.status === status);
    return actions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async saveBriefing(briefingData: any) {
    const briefing = { id: `briefing_${Date.now()}`, ...briefingData, created_at: new Date().toISOString() };
    this.mockData.briefings.push(briefing);
    return briefing;
  }

  async getBriefings(userId: string, limit: number = 7) {
    return this.mockData.briefings.filter(b => b.user_id === userId).slice(0, limit);
  }

  async saveMeeting(meetingData: any) {
    const meeting = { id: `meeting_${Date.now()}`, ...meetingData, created_at: new Date().toISOString() };
    this.mockData.meetings.push(meeting);
    return meeting;
  }

  async uploadFile(userId: string, file: Buffer, fileName: string) {
    return { path: `${userId}/${Date.now()}-${fileName}` };
  }

  async getFileUrl(filePath: string) {
    return `mock://files/${filePath}`;
  }

  async trackEvent(userId: string, eventType: string, properties: Record<string, any>) {
    console.log('Event tracked:', { userId, eventType, properties });
  }

  get client() {
    return this;
  }

  get admin() {
    return this;
  }
}

export const supabaseService = new MockSupabaseService();
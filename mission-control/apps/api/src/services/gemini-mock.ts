// Mock Gemini service for UI testing (no API key required)
export class MockGeminiService {
  async generateBriefing(input: any) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay
    
    return {
      summary: "Test briefing with 2 urgent meetings and 3 priority actions",
      confidence: 0.85,
      needs_user_confirmation: false,
      priorities: [
        { title: "Contract review due 3pm", urgency: "high", confidence: 0.9 },
        { title: "Client call preparation", urgency: "medium", confidence: 0.8 },
        { title: "Expense report submission", urgency: "low", confidence: 0.7 }
      ],
      time_windows: [
        { start: "2:00 PM", end: "4:00 PM", purpose: "Deep work session" }
      ],
      recommended_actions: [
        { description: "Review contract clauses", effort: "medium", confidence: 0.9 },
        { description: "Prepare client call notes", effort: "low", confidence: 0.85 }
      ],
      delegation_opportunities: [
        { task: "Contract legal review", to_who: "Legal team", confidence: 0.8 }
      ]
    };
  }

  async extractIntel(imageBase64: string, extractionTypes: string[]) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      overlays: [
        { x: 20, y: 30, width: 25, height: 8, text: "INVOICE #12345", confidence: 0.95, type: "field" },
        { x: 20, y: 45, width: 30, height: 8, text: "DUE: 2024-02-15", confidence: 0.88, type: "risk" },
        { x: 50, y: 60, width: 20, height: 8, text: "AMOUNT: $1,250", confidence: 0.92, type: "field" }
      ],
      structured: {
        fields: { invoice_number: "12345", amount: "$1,250", due_date: "2024-02-15" },
        entities: [],
        risks: [{ type: "payment_due", confidence: 0.88 }]
      },
      actions: [
        { type: "reminder", confidence: 0.9, description: "Set reminder for invoice due date" },
        { type: "task", confidence: 0.85, description: "Process payment for invoice #12345" }
      ],
      confidence: 0.85
    };
  }

  async analyzeTranscript(transcript: string) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      summary: "Team discussed Q1 objectives and made key decisions",
      decisions: [
        { description: "Launch new feature by March 15th", owner: "Sarah", deadline: "2024-03-15", confidence: 0.95 },
        { description: "Marketing budget approved: $50,000", owner: "Finance team", deadline: "2024-02-01", confidence: 0.88 }
      ],
      risks: [
        { description: "Development timeline tight", mitigation: "Add buffer week", confidence: 0.7 }
      ],
      follow_ups: [
        { type: "email", recipient: "team@company.com", content: "Meeting notes and action items", confidence: 0.92 },
        { type: "task", content: "Create development timeline for new feature", confidence: 0.85 }
      ],
      confidence: 0.8
    };
  }
}

export const geminiService = new MockGeminiService();
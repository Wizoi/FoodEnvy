import Anthropic from '@anthropic-ai/sdk';

export class MissingApiKeyError extends Error {
  constructor(message = 'API key is required to generate a plan') {
    super(message);
    this.name = 'MissingApiKeyError';
  }
}

const PROTEIN_SOURCE_TAGS_LIST = ['beef', 'pork', 'fish', 'meat', 'soy', 'egg'];

export const PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    foodEnvyPlanExport: { type: 'boolean', const: true },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slotId: { type: 'string' },
                mealType: { type: 'string' },
                mealName: { type: 'string' },
                eligibleMembers: { type: 'array', items: { type: 'string' } },
                ineligibleMembers: { type: 'array', items: { type: 'string' } },
              },
              required: ['slotId', 'mealType', 'mealName', 'eligibleMembers', 'ineligibleMembers'],
            },
          },
        },
        required: ['day', 'slots'],
      },
    },
  },
  required: ['foodEnvyPlanExport', 'days'],
};

export function buildPlanPrompt({
  members,
  inventory,
  recipePool,
  mealScope,
  timeBudget,
  involvement,
}) {
  const selectedMembers = members.filter((m) => m.selected);
  const restrictionsSummary = selectedMembers
    .map((m) => {
      const allergyDiet = m.restrictions.filter((r) => r.category === 'allergy' || r.category === 'diet');
      if (allergyDiet.length === 0) return `${m.name}: no restrictions`;
      const labels = allergyDiet.map((r) => `${r.category}:${r.value} (${r.severity})`).join(', ');
      return `${m.name}: ${labels}`;
    })
    .join('\n');

  const inventorySummary = inventory.length > 0 ? inventory.map((i) => i.name).join(', ') : '(empty)';

  const recipeNames = recipePool.slice(0, 10).map((r) => r.name);
  const proteinTagList = PROTEIN_SOURCE_TAGS_LIST.join(', ');

  const systemPrompt = `You are a family meal planner that generates weekly meal plans respecting all dietary constraints and preferences.

CRITICAL SAFETY GATES (not suggestions):
- Strict allergies and diets are NON-NEGOTIABLE. Every ingredient in every recipe must be validated.
- NOTE: The app re-validates the plan independently after import, but treat these as a safety-first checkpoint.
- Never place a meal with an ineligible member, even in an alternate or fork.

BALANCE AND CONSOLIDATION:
- Avoid any protein source tag (${proteinTagList}) appearing in 3+ meals in the same week.
- BEFORE finalizing: scan the full week's ingredients and ensure recipes reuse shared proteins, produce, and pantry staples where possible.
- Call out batch-prep opportunities when the same component can feed multiple slots (e.g., "roasted chicken" used in two different meals).

MEAL SCOPE AND TIME:
- ${mealScope}: which meals to plan (breakfast, lunch, dinner, snacks, etc.)
- Time budget: ${timeBudget} (prep + cook time per meal)
- Involvement level: ${involvement} (how hands-on the cooking should be)

OUTPUT FORMAT:
Return a valid foodEnvyPlanExport JSON with days array, each day containing meal slots.
Each slot needs:
- slotId: unique identifier (e.g., "monday-dinner")
- mealType: "Breakfast", "Lunch", "Dinner", etc.
- mealName: the dish name (e.g., "Grilled chicken with roasted vegetables")
- eligibleMembers: member IDs who can safely eat this meal
- ineligibleMembers: member IDs who cannot eat this meal

Keep meal names realistic and achievable.`;

  const userPrompt = `Plan this week's dinners for:

Members:
${restrictionsSummary}

On-Hand Inventory:
${inventorySummary}

Available Recipe Ideas:
${recipeNames.join(', ')}

Generate a weekly meal plan with simple, achievable dinner names.
Consider the family's restrictions and preferences.
Pick meals that can reuse ingredients across the week where possible.

Return the result as a JSON foodEnvyPlanExport matching the schema.`;

  return { system: systemPrompt, user: userPrompt };
}

export async function generateWeeklyPlan(apiKey, payload, _options = {}, workspaceId = null) {
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const clientConfig = {
    apiKey,
    dangerouslyAllowBrowser: true,
  };

  if (workspaceId) {
    clientConfig.defaultHeaders = {
      'anthropic-workspace-id': workspaceId,
    };
  }

  const client = new Anthropic(clientConfig);

  const { system, user } = buildPlanPrompt(payload);

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 2500,
      thinking: {
        type: 'adaptive',
      },
      temperature: 1,
      system,
      messages: [
        {
          role: 'user',
          content: user,
        },
      ],
    });

    // For structured output with streaming, we'll collect the full response
    const finalMessage = await stream.finalMessage();

    // Extract the text content from the response
    let jsonText = '';
    for (const block of finalMessage.content) {
      if (block.type === 'text') {
        jsonText += block.text;
      }
    }

    // Parse the JSON response, stripping markdown code blocks if present
    let parsed;
    try {
      let cleanJson = jsonText.trim();
      // Remove markdown code block wrapper if present
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7); // Remove ```json
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3); // Remove ```
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3); // Remove trailing ```
      }
      cleanJson = cleanJson.trim();

      // Extract just the JSON object/array, ignoring any text after it
      // Find the first { or [ and work backwards from the end to find matching } or ]
      const jsonStart = Math.min(
        cleanJson.indexOf('{') >= 0 ? cleanJson.indexOf('{') : Infinity,
        cleanJson.indexOf('[') >= 0 ? cleanJson.indexOf('[') : Infinity,
      );

      if (jsonStart === Infinity) {
        throw new Error('No JSON object or array found in response');
      }

      cleanJson = cleanJson.slice(jsonStart);

      // Try to find the end of valid JSON by finding the matching closing brace/bracket
      let braceCount = 0;
      let bracketCount = 0;
      let jsonEnd = -1;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < cleanJson.length; i++) {
        const char = cleanJson[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) jsonEnd = i + 1;
        }
        if (char === '[') bracketCount++;
        if (char === ']') {
          bracketCount--;
          if (bracketCount === 0 && braceCount === 0) jsonEnd = i + 1;
        }
      }

      if (jsonEnd > 0) {
        cleanJson = cleanJson.slice(0, jsonEnd);
      }

      parsed = JSON.parse(cleanJson);

      // If the parsed JSON doesn't have foodEnvyPlanExport, it might be wrapped
      // Try to find it in common wrapper patterns
      if (!parsed.foodEnvyPlanExport) {
        if (parsed.data && parsed.data.foodEnvyPlanExport) {
          parsed = parsed.data;
        } else if (parsed.plan && parsed.plan.foodEnvyPlanExport) {
          parsed = parsed.plan;
        }
      }
    } catch (parseErr) {
      throw new Error(`Failed to parse Claude's response as JSON: ${parseErr.message}. Response may have been truncated. Try again or increase max_tokens.`);
    }

    return parsed;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err;
    }
    // Check if error is due to missing workspace ID
    const errMsg = err.message || '';
    if (errMsg.includes('anthropic-workspace-id is required')) {
      throw new Error('Workspace ID is required for your API key. Go to Settings and enter your workspace ID (from console.anthropic.com/settings/account).');
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw err;
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw err;
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw err;
    }
    if (err instanceof Anthropic.APIError) {
      throw err;
    }
    throw err;
  }
}

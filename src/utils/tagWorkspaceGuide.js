export const GTM_GA4_FLOW = [
  { id: 'push', label: 'dataLayer.push()', detail: 'Your website adds an event object to the shared dataLayer array.' },
  { id: 'trigger', label: 'GTM trigger', detail: 'A Custom Event trigger listens for the exact value of the event key.' },
  { id: 'tag', label: 'GA4 event tag', detail: 'The tag maps dataLayer values into an event name and parameters.' },
  { id: 'verify', label: 'GA4 DebugView', detail: 'DebugView confirms the event arrived and shows its parameters.' },
]

export const WORKSPACE_GLOSSARY = [
  { term: 'dataLayer', definition: 'A JavaScript array that carries structured messages from a website to GTM.' },
  { term: 'Event', definition: 'A named action such as page_view, sign_up, or generate_lead.' },
  { term: 'Parameter', definition: 'Extra context attached to an event, such as method, currency, or value.' },
  { term: 'Variable', definition: 'A GTM value that reads information from the dataLayer for use in tags and triggers.' },
  { term: 'Trigger', definition: 'The rule that decides when a GTM tag is allowed to fire.' },
  { term: 'Tag', definition: 'A configured measurement request, such as a GA4 event, controlled by GTM.' },
  { term: 'DebugView', definition: 'GA4’s near-real-time view for checking test events and parameters.' },
]

export const GUIDE_EXAMPLES = [
  {
    id: 'page_view',
    label: 'Page view',
    description: 'A virtual page visit with safe placeholder values.',
    payload: { event: 'page_view', page_title: 'Practice landing page', page_location: 'https://sandbox.invalid/practice', debug_mode: true },
  },
  {
    id: 'sign_up',
    label: 'Sign up',
    description: 'A recommended GA4 event with a synthetic method.',
    payload: { event: 'sign_up', method: 'practice_form', debug_mode: true },
  },
  {
    id: 'purchase',
    label: 'Purchase',
    description: 'A compact ecommerce event using a fake transaction.',
    payload: { event: 'purchase', transaction_id: 'LAB-1001', currency: 'USD', value: 42, items: [{ item_id: 'LAB-COURSE', item_name: 'Practice pack', price: 42, quantity: 1 }], debug_mode: true },
  },
]

export function getWorkspaceGuideContext(fileName, validation) {
  const firstIssue = validation.issues?.[0]
  if (fileName.startsWith('events/')) {
    const eventName = validation.value?.event || 'your event'
    return {
      kicker: 'Event recipe',
      title: `Build ${eventName}`,
      summary: 'This object represents one dataLayer message. GTM reads its event key and can pass the remaining fields to GA4 as parameters.',
      steps: [
        { title: 'Name the action', detail: 'Use a stable GA4-style event name that describes what happened.' },
        { title: 'Add useful context', detail: 'Keep only parameters that help analysis; never add personal data or credentials.' },
        { title: validation.safeToRun ? 'Run the simulation' : 'Clear validation first', detail: validation.safeToRun ? 'The offline runner can now show the exact payload GTM would receive.' : firstIssue ? `${firstIssue.path}: ${firstIssue.message}` : 'Resolve all errors and warnings before running.' },
        { title: 'Test it with GTM', detail: `If you explicitly enable Live GTM, use a Custom Event trigger named “${eventName}” and map only the parameters you need.` },
      ],
    }
  }
  if (fileName === 'container.json') {
    return {
      kicker: 'Project map',
      title: 'Understand the container model',
      summary: 'This small practice document identifies the project. It is intentionally not a full GTM export and cannot install tags.',
      steps: [
        { title: 'Check publicId', detail: 'A public container ID starts with GTM- and labels this offline session.' },
        { title: 'Give it a practice name', detail: 'Use a clear name that cannot be confused with a production container.' },
        { title: 'Keep exports offline', detail: 'Real GTM exports can contain tag configuration and should be reviewed before any future import support.' },
      ],
    }
  }
  if (fileName.startsWith('tests/')) {
    return {
      kicker: 'Test plan',
      title: 'Define the expected event trail',
      summary: 'The expected array is a simple checklist of events a user journey should produce, in a real implementation order can also matter.',
      steps: [
        { title: 'Describe one journey', detail: 'Keep each test focused, such as landing page → form start → generate lead.' },
        { title: 'Use exact names', detail: 'Each expected value should exactly match the event key in an event file.' },
        { title: 'Avoid duplicates', detail: 'Repeated names are allowed but flagged because they can make a beginner test ambiguous.' },
      ],
    }
  }
  return {
    kicker: fileName.endsWith('.md') ? 'Workspace notes' : 'JSON reference',
    title: fileName.endsWith('.md') ? 'Document what you learn' : 'Shape a supporting object',
    summary: fileName.endsWith('.md') ? 'Use notes for setup decisions, naming conventions, and test results—without real customer details.' : 'Generic JSON files are validated for syntax, dangerous keys, credentials, and personal data.',
    steps: [
      { title: 'Keep it focused', detail: 'Store only information that supports this practice project.' },
      { title: 'Use synthetic examples', detail: 'Replace real people, identifiers, and secrets with obvious test values.' },
      { title: 'Download before closing', detail: 'This workspace exists only in memory and disappears with the window.' },
    ],
  }
}

export function getGuideProgress({ selectedFile, validation, modified, output }) {
  const isEvent = selectedFile.startsWith('events/')
  const eventName = validation.value?.event
  return [
    { label: 'Open an event file', complete: isEvent },
    { label: 'Edit its payload', complete: isEvent && modified },
    { label: 'Pass every safety check', complete: isEvent && validation.safeToRun },
    { label: 'Run it offline', complete: Boolean(eventName && output.some((entry) => entry.payload?.event === eventName)) },
  ]
}

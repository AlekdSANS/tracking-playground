const GTM_CONTAINER_ID = /^GTM-[A-Z0-9]{4,20}$/
const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{5,20}$/

export const GTM_SETUP_LESSONS = [
  {
    id: 'ga4-property',
    phase: 'Analytics',
    title: 'Create a GA4 property',
    shortTitle: 'GA4 property',
    menu: ['Admin', 'Create', 'Property'],
    why: 'The property is the home for your website’s analytics data, reports, events, and settings.',
    actions: [
      'Open Google Analytics and select Admin in the lower-left corner.',
      'Select Create, then Property.',
      'Enter a property name, reporting time zone, and currency. Continue through the business questions and select Create.',
    ],
    field: { key: 'propertyName', label: 'Your GA4 property name', placeholder: 'Example: Tracking Playground' },
    errors: ['Creating another Analytics account when you only need a new property.', 'Choosing the wrong reporting time zone or currency.', 'Using a real client property for experiments instead of a practice property.'],
    source: 'https://support.google.com/analytics/answer/14183469',
  },
  {
    id: 'web-stream',
    phase: 'Analytics',
    title: 'Create a Web Data Stream',
    shortTitle: 'Web stream',
    menu: ['Admin', 'Data collection and modification', 'Data streams', 'Add stream', 'Web'],
    why: 'A web stream tells GA4 which website will send data and creates the measurement identifier used by your Google tag.',
    actions: [
      'In Admin, confirm that your new property is selected.',
      'Under Data collection and modification, select Data streams, then Add stream.',
      'Choose Web, enter the deployed website URL and stream name, then select Create stream.',
    ],
    field: { key: 'streamUrl', label: 'Website URL used for the stream', placeholder: 'https://example.vercel.app', type: 'url' },
    errors: ['Selecting an iOS or Android stream for a website.', 'Entering localhost instead of the deployed website URL.', 'Creating multiple web streams for the same site without a clear reason.'],
    source: 'https://support.google.com/analytics/answer/14183469',
  },
  {
    id: 'measurement-id',
    phase: 'Analytics',
    title: 'Copy the measurement ID',
    shortTitle: 'Measurement ID',
    menu: ['Admin', 'Data streams', 'Your web stream', 'Stream details', 'Measurement ID'],
    why: 'The measurement ID identifies the GA4 destination. It begins with G- and is not your GTM container ID.',
    actions: [
      'Open the web stream you just created.',
      'Find Measurement ID in Stream details.',
      'Copy the complete value beginning with G- and paste it below.',
    ],
    field: { key: 'measurementId', label: 'Your GA4 measurement ID', placeholder: 'G-XXXXXXXXXX', transform: 'upper' },
    errors: ['Pasting a GTM- container ID here.', 'Copying the numeric stream ID instead of Measurement ID.', 'Leaving spaces before or after the identifier.'],
    source: 'https://support.google.com/analytics/answer/14183469',
  },
  {
    id: 'gtm-container',
    phase: 'Tag Manager',
    title: 'Create a GTM Web container',
    shortTitle: 'GTM container',
    menu: ['Accounts', 'Create account', 'Container setup', 'Target platform: Web', 'Create'],
    why: 'The web container holds tags, triggers, and variables for one website. Its public ID begins with GTM-.',
    actions: [
      'Open Google Tag Manager and select Create account.',
      'Enter an account name and country. Under Container setup, use your website as the container name.',
      'Choose Web as the target platform, select Create, and accept the terms.',
    ],
    field: { key: 'containerId', label: 'Your GTM container ID', placeholder: 'GTM-XXXXXXX', transform: 'upper' },
    errors: ['Choosing Server instead of Web for a normal website.', 'Creating one container for every page instead of one container for the website.', 'Pasting the G- measurement ID in place of the GTM- container ID.'],
    source: 'https://support.google.com/tagmanager/answer/14842164',
  },
  {
    id: 'install-container',
    phase: 'Website',
    title: 'Install the GTM snippets',
    shortTitle: 'Install snippets',
    menu: ['GTM Workspace', 'Click the GTM- container ID', 'Install Google Tag Manager'],
    why: 'The two snippets load GTM on the website. Until they are installed, the container cannot receive page activity.',
    actions: [
      'In the GTM Workspace, click the GTM- container ID at the top to reopen the installation dialog.',
      'Put the first snippet as high as possible immediately after the opening <head> tag.',
      'Put the second noscript snippet immediately after the opening <body> tag, deploy the site, then use Test in the installation dialog.',
    ],
    field: { key: 'installLocation', label: 'Where did you install the snippets?', placeholder: 'Example: index.html — <head> and <body>' },
    errors: ['Installing only the noscript snippet.', 'Putting both snippets at the bottom of the page.', 'Leaving the example GTM ID in copied code or installing the same container twice.'],
    source: 'https://support.google.com/tagmanager/answer/14847097',
  },
  {
    id: 'google-tag',
    phase: 'Tag Manager',
    title: 'Create a Google tag',
    shortTitle: 'Google tag',
    menu: ['Workspace', 'Tags', 'New', 'Tag Configuration', 'Google Tag'],
    why: 'The Google tag creates the base connection between GTM and your GA4 destination. This is the current name for the former GA4 Configuration tag.',
    actions: [
      'In the GTM Workspace, select Tags, then New.',
      'Replace Untitled Tag with a clear name.',
      'Select Tag Configuration, then Google Tag. Do not use Custom HTML for this setup.',
    ],
    field: { key: 'googleTagName', label: 'Name you gave the Google tag', placeholder: 'Example: Google tag – Main website' },
    errors: ['Searching for the old GA4 Configuration tag name.', 'Selecting GA4 Event before creating the base Google tag.', 'Using a Custom HTML tag to install gtag.js inside GTM.'],
    source: 'https://support.google.com/tagmanager/answer/14842872',
  },
  {
    id: 'connect-measurement',
    phase: 'Tag Manager',
    title: 'Connect the measurement ID',
    shortTitle: 'Connect GA4 ID',
    menu: ['Google tag', 'Tag Configuration', 'Tag ID'],
    why: 'The Tag ID tells the Google tag which GA4 stream should receive website data.',
    actions: [
      'Open the Google tag’s Tag Configuration section.',
      'Paste the G- measurement ID from the GA4 web stream into Tag ID.',
      'Compare it character-for-character with the measurement ID saved in lesson 3.',
    ],
    field: { key: 'connectedMeasurementId', label: 'Tag ID entered in GTM', placeholder: 'G-XXXXXXXXXX', transform: 'upper' },
    errors: ['Entering the GTM- container ID in Tag ID.', 'Using a measurement ID from a different GA4 property.', 'Adding spaces or omitting part of the identifier.'],
    source: 'https://support.google.com/tagmanager/answer/14842872',
  },
  {
    id: 'all-pages-trigger',
    phase: 'Tag Manager',
    title: 'Add the All Pages trigger',
    shortTitle: 'All Pages trigger',
    menu: ['Google tag', 'Triggering', 'Initialization – All Pages', 'Save'],
    why: 'Initialization – All Pages loads the Google tag early on every page, before ordinary page-view triggers.',
    actions: [
      'In the Google tag, select the Triggering section.',
      'Choose the built-in Initialization – All Pages trigger.',
      'Select Save. The tag should now show one firing trigger.',
    ],
    field: { key: 'triggerName', label: 'Trigger selected in GTM', placeholder: 'Initialization – All Pages' },
    errors: ['Choosing Consent Initialization – All Pages for a normal Google tag.', 'Creating an unnecessary custom trigger instead of using the built-in trigger.', 'Forgetting to save the tag after selecting the trigger.'],
    source: 'https://support.google.com/tagmanager/answer/14842872',
  },
  {
    id: 'preview',
    phase: 'Test',
    title: 'Preview with Tag Assistant',
    shortTitle: 'Preview',
    menu: ['GTM Workspace', 'Preview', 'Enter website URL', 'Connect', 'Continue'],
    why: 'Preview mode tests the unpublished workspace safely and shows whether the Google tag fired on your website.',
    actions: [
      'Select Preview in the top-right of the GTM Workspace.',
      'Enter your deployed website URL and select Connect.',
      'Return to Tag Assistant, select Continue, and confirm that the Google tag fired on the initialization event.',
    ],
    field: { key: 'previewUrl', label: 'URL successfully connected in Tag Assistant', placeholder: 'https://example.vercel.app', type: 'url' },
    errors: ['Testing localhost when Tag Assistant cannot reach it.', 'Closing the Tag Assistant tab before checking whether the tag fired.', 'Publishing just to test instead of using Preview first.'],
    source: 'https://support.google.com/tagmanager/answer/6107056',
  },
  {
    id: 'publish',
    phase: 'Launch',
    title: 'Publish the container',
    shortTitle: 'Publish',
    menu: ['GTM Workspace', 'Submit', 'Publish and Create Version', 'Publish'],
    why: 'Publishing makes the tested workspace version active for regular website visitors and creates a version you can return to.',
    actions: [
      'After Preview succeeds, select Submit in the top-right of the GTM Workspace.',
      'Choose Publish and Create Version, then enter a descriptive version name and notes.',
      'Review Workspace Changes and select Publish.',
    ],
    field: { key: 'versionName', label: 'Published version name', placeholder: 'Example: GA4 base setup – verified' },
    errors: ['Publishing before Preview succeeds.', 'Using an unclear version name such as test or update.', 'Skipping the Workspace Changes review.'],
    source: 'https://support.google.com/tagmanager/answer/6107163',
  },
]

export function createGtmSetupValues(containerId = '') {
  return {
    propertyName: '',
    streamUrl: '',
    measurementId: '',
    containerId,
    installLocation: '',
    googleTagName: 'Google tag – Main website',
    connectedMeasurementId: '',
    triggerName: 'Initialization – All Pages',
    previewUrl: '',
    versionName: '',
  }
}

export function validateGtmSetupLesson(lesson, values, expectedContainerId = '') {
  const value = String(values?.[lesson.field.key] || '').trim()
  if (!value) return `Enter ${lesson.field.label.toLowerCase()} before marking this lesson complete.`
  if (lesson.field.key === 'measurementId' && !GA4_MEASUREMENT_ID.test(value.toUpperCase())) return 'A GA4 measurement ID begins with G-, for example G-ABC1234567.'
  if (lesson.field.key === 'containerId') {
    if (!GTM_CONTAINER_ID.test(value.toUpperCase())) return 'A GTM container ID begins with GTM-, for example GTM-ABC1234.'
    if (expectedContainerId && value.toUpperCase() !== expectedContainerId) return `This workspace was opened for ${expectedContainerId}. Enter that same container ID.`
  }
  if (lesson.field.key === 'connectedMeasurementId') {
    if (!GA4_MEASUREMENT_ID.test(value.toUpperCase())) return 'Tag ID must be the G- measurement ID, not the GTM- container ID.'
    if (values.measurementId && value.toUpperCase() !== String(values.measurementId).trim().toUpperCase()) return 'This does not match the measurement ID saved in lesson 3.'
  }
  if (lesson.field.type === 'url') {
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol')
    } catch {
      return 'Enter a complete website URL beginning with https:// or http://.'
    }
  }
  if (lesson.field.key === 'triggerName' && !/^Initialization\s*[–-]\s*All Pages$/i.test(value)) return 'Choose the built-in Initialization – All Pages trigger for the Google tag.'
  return ''
}

import { useMemo, useState } from 'react'
import { trackUtmBuilderAction } from '../utils/analytics'

const startingChannels = [
  {
    id: 'telegram',
    label: 'Telegram',
    params: [
      { id: 'telegram-source', name: 'utm_source', value: 'telegram' },
      { id: 'telegram-medium', name: 'utm_medium', value: 'chat' },
      { id: 'telegram-campaign', name: 'utm_campaign', value: 'bro_test' },
    ],
  },
  {
    id: 'discord',
    label: 'Discord',
    params: [
      { id: 'discord-source', name: 'utm_source', value: 'discord' },
      { id: 'discord-medium', name: 'utm_medium', value: 'community' },
      { id: 'discord-campaign', name: 'utm_campaign', value: 'community_test' },
    ],
  },
  {
    id: 'gmail',
    label: 'Gmail',
    params: [
      { id: 'gmail-source', name: 'utm_source', value: 'gmail' },
      { id: 'gmail-medium', name: 'utm_medium', value: 'email' },
      { id: 'gmail-campaign', name: 'utm_campaign', value: 'email_test' },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    params: [
      { id: 'whatsapp-source', name: 'utm_source', value: 'whatsapp' },
      { id: 'whatsapp-medium', name: 'utm_medium', value: 'chat' },
      { id: 'whatsapp-campaign', name: 'utm_campaign', value: 'chat_test' },
    ],
  },
  {
    id: 'messenger',
    label: 'Messenger',
    params: [
      { id: 'messenger-source', name: 'utm_source', value: 'messenger' },
      { id: 'messenger-medium', name: 'utm_medium', value: 'chat' },
      { id: 'messenger-campaign', name: 'utm_campaign', value: 'chat_test' },
    ],
  },
]

const defaultBaseUrl =
  typeof window === 'undefined'
    ? 'https://example.com/'
    : `${window.location.origin}/`

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeParamName(name) {
  return name.trim().replace(/\s+/g, '_')
}

function buildUrl(baseUrl, params) {
  try {
    const url = new URL(baseUrl)

    params.forEach((param) => {
      const name = normalizeParamName(param.name)
      const value = param.value.trim()

      if (name && value) {
        url.searchParams.set(name, value)
      }
    })

    return url.toString()
  } catch {
    return ''
  }
}

function cloneParams(params) {
  return params.map((param) => ({
    ...param,
    id: createId(param.name || 'param'),
  }))
}

function UtmBuilderPage() {
  const [channels, setChannels] = useState(startingChannels)
  const [selectedChannelId, setSelectedChannelId] = useState('telegram')
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl)
  const [params, setParams] = useState(() => cloneParams(startingChannels[0].params))
  const [customChannelName, setCustomChannelName] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  const selectedChannel = channels.find(
    (channel) => channel.id === selectedChannelId,
  )

  const generatedUrl = useMemo(() => buildUrl(baseUrl, params), [baseUrl, params])

  const activeParams = params.filter(
    (param) => normalizeParamName(param.name) && param.value.trim(),
  )

  function selectChannel(channel) {
    setSelectedChannelId(channel.id)
    setParams(cloneParams(channel.params))
    setCopyStatus('')
  }

  function updateParam(id, field, value) {
    setParams((currentParams) =>
      currentParams.map((param) =>
        param.id === id ? { ...param, [field]: value } : param,
      ),
    )
    setCopyStatus('')
  }

  function addParam() {
    setParams((currentParams) => [
      ...currentParams,
      { id: createId('param'), name: '', value: '' },
    ])
    setCopyStatus('')
  }

  function removeParam(id) {
    setParams((currentParams) =>
      currentParams.length === 1
        ? currentParams
        : currentParams.filter((param) => param.id !== id),
    )
    setCopyStatus('')
  }

  function addCustomChannel() {
    const label = customChannelName.trim()

    if (!label) {
      setCopyStatus('Name the channel first.')
      return
    }

    const sourceValue = label.toLowerCase().replace(/\s+/g, '_')
    const channel = {
      id: createId(sourceValue),
      label,
      params: [
        { id: createId('source'), name: 'utm_source', value: sourceValue },
        { id: createId('medium'), name: 'utm_medium', value: '' },
        { id: createId('campaign'), name: 'utm_campaign', value: '' },
      ],
    }

    setChannels((currentChannels) => [...currentChannels, channel])
    setSelectedChannelId(channel.id)
    setParams(cloneParams(channel.params))
    setCustomChannelName('')
    setCopyStatus('Custom channel added.')
  }

  function saveCurrentAsChannel() {
    if (!selectedChannel) {
      return
    }

    setChannels((currentChannels) =>
      currentChannels.map((channel) =>
        channel.id === selectedChannelId
          ? { ...channel, params: cloneParams(params) }
          : channel,
      ),
    )
    setCopyStatus(`${selectedChannel.label} preset updated.`)
  }

  function getTrackingDetails() {
    const paramNames = activeParams.map((param) => normalizeParamName(param.name))

    return {
      utm_channel: selectedChannel?.label || 'custom',
      generated_source:
        activeParams.find((param) => normalizeParamName(param.name) === 'utm_source')
          ?.value || '',
      generated_medium:
        activeParams.find((param) => normalizeParamName(param.name) === 'utm_medium')
          ?.value || '',
      generated_campaign:
        activeParams.find((param) => normalizeParamName(param.name) === 'utm_campaign')
          ?.value || '',
      generated_param_count: activeParams.length,
      generated_param_names: paramNames.join(','),
    }
  }

  async function handleCopy() {
    if (!generatedUrl) {
      setCopyStatus('Enter a valid URL first.')
      return
    }

    trackUtmBuilderAction('copy_link', getTrackingDetails())

    try {
      await navigator.clipboard.writeText(generatedUrl)
      setCopyStatus('Copied.')
    } catch {
      setCopyStatus('Copy failed. Select the link manually.')
    }
  }

  function handleOpenLink(event) {
    if (!generatedUrl) {
      event.preventDefault()
      return
    }

    trackUtmBuilderAction('open_link', getTrackingDetails())
  }

  return (
    <section className="narrow-page playful-page utm-builder-page">
      <img
        className="playful-image utm-builder-image"
        src="/silly/utm-builder-sticker.webp"
        alt="UTM builder sticker"
        width="331"
        height="335"
        decoding="async"
      />
      <div className="page-intro">
        <h1>UTM link creator</h1>
        <p>
          Build links with any parameter names you need, from classic UTMs to
          custom campaign labels.
        </p>
      </div>

      <form className="form-card utm-builder-form">
        <fieldset className="channel-picker">
          <legend>Channel preset</legend>
          <div className="channel-options">
            {channels.map((channel) => (
              <label key={channel.id} className="channel-option">
                <input
                  type="radio"
                  name="channel"
                  value={channel.id}
                  checked={selectedChannelId === channel.id}
                  onChange={() => selectChannel(channel)}
                />
                <span>{channel.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="custom-channel-row">
          <label className="field">
            New channel
            <input
              type="text"
              value={customChannelName}
              onChange={(event) => setCustomChannelName(event.target.value)}
              placeholder="TikTok, Reddit, Partner site"
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={addCustomChannel}
          >
            Add channel
          </button>
        </div>

        <label className="field">
          Page URL
          <input
            type="url"
            value={baseUrl}
            onChange={(event) => {
              setBaseUrl(event.target.value)
              setCopyStatus('')
            }}
            placeholder="https://yourwebsite.com/"
          />
        </label>

        <div className="param-builder">
          <div className="param-builder-header">
            <h2>Parameters</h2>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={addParam}>
                Add parameter
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={saveCurrentAsChannel}
              >
                Save preset
              </button>
            </div>
          </div>

          <div className="param-row-list">
            {params.map((param) => (
              <div className="param-row" key={param.id}>
                <label className="field">
                  Name
                  <input
                    type="text"
                    value={param.name}
                    onChange={(event) =>
                      updateParam(param.id, 'name', event.target.value)
                    }
                    placeholder="utm_source"
                  />
                </label>
                <label className="field">
                  Value
                  <input
                    type="text"
                    value={param.value}
                    onChange={(event) =>
                      updateParam(param.id, 'value', event.target.value)
                    }
                    placeholder="telegram"
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button remove-param-button"
                  onClick={() => removeParam(param.id)}
                  disabled={params.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="utm-param-preview" aria-label="Generated parameters">
          {activeParams.length ? (
            activeParams.map((param) => (
              <span key={`${param.id}-preview`}>
                {normalizeParamName(param.name)}={param.value}
              </span>
            ))
          ) : (
            <span>No active parameters yet</span>
          )}
        </div>

        <label className="field">
          Generated link
          <textarea readOnly rows="4" value={generatedUrl} />
        </label>

        <div className="form-actions">
          <button type="button" className="primary-button" onClick={handleCopy}>
            Copy link
          </button>
          <a
            className="secondary-button"
            href={generatedUrl || '#'}
            onClick={handleOpenLink}
          >
            Open link
          </a>
        </div>

        <p className="form-status muted" aria-live="polite">
          {copyStatus}
        </p>
      </form>
    </section>
  )
}

export default UtmBuilderPage

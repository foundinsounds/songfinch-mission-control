'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const CHAT_STORAGE_KEY = 'roundtable-agent-chat'

function getStoredMessages() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]')
  } catch { return [] }
}

function storeMessages(msgs) {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs.slice(-200)))
}

export default function AgentChat({ agents, isOpen, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('council')
  const [dmTarget, setDmTarget] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setMessages(getStoredMessages())
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Auto-focus input when opening or switching channels
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, selectedChannel, dmTarget])

  const channels = [
    { id: 'council', label: 'Council', icon: '\u{1F3DB}', desc: 'All agents' },
    { id: 'creative', label: 'Creative', icon: '\u{1F3A8}', desc: 'Creative team' },
    { id: 'strategy', label: 'Strategy', icon: '\u{1F4CA}', desc: 'Strategy team' },
    { id: 'alerts', label: 'Alerts', icon: '\u{1F514}', desc: 'System alerts' },
  ]

  // Get conversation history for the current channel/DM
  const getConversationHistory = useCallback(() => {
    const channelId = dmTarget ? `dm-${dmTarget}` : selectedChannel
    return messages
      .filter(m => m.channel === channelId)
      .slice(-10) // Last 10 messages for context
      .map(m => ({ sender: m.sender, text: m.text }))
  }, [messages, dmTarget, selectedChannel])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const messageText = input.trim()
    const channelId = dmTarget ? `dm-${dmTarget}` : selectedChannel

    // Add user message immediately
    const userMsg = {
      id: Date.now(),
      channel: channelId,
      sender: 'You',
      senderEmoji: '\u{1F464}',
      text: messageText,
      timestamp: new Date().toISOString(),
      isDM: !!dmTarget,
      dmTarget,
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    storeMessages(updatedMessages)
    setInput('')
    setError(null)
    setIsLoading(true)

    try {
      // Build conversation history (excluding the message we just added)
      const history = getConversationHistory()

      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          channel: dmTarget ? null : selectedChannel,
          agentName: dmTarget || null,
          conversationHistory: history,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.fallbackMessage || data.error || 'Failed to get response')
      }

      // Add AI response
      const aiReply = {
        id: Date.now() + 1,
        channel: channelId,
        sender: data.sender || (dmTarget || 'Council'),
        senderEmoji: data.senderEmoji || '\u{1F916}',
        senderColor: data.senderColor,
        text: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        isDM: !!dmTarget,
        dmTarget: dmTarget ? 'You' : undefined,
        model: data.model, // Track which model responded
      }

      setMessages(prev => {
        const next = [...prev, aiReply]
        storeMessages(next)
        return next
      })

    } catch (err) {
      console.error('[AgentChat] Error:', err)
      setError(err.message)

      // Add error as a system message so it's visible in chat
      const errorMsg = {
        id: Date.now() + 1,
        channel: channelId,
        sender: 'System',
        senderEmoji: '\u{26A0}\u{FE0F}',
        text: `Connection error: ${err.message}. Try again.`,
        timestamp: new Date().toISOString(),
        isError: true,
      }

      setMessages(prev => {
        const next = [...prev, errorMsg]
        storeMessages(next)
        return next
      })
    } finally {
      setIsLoading(false)
    }
  }, [input, selectedChannel, dmTarget, messages, isLoading, getConversationHistory])

  // Clear chat for current channel/DM
  const clearChat = useCallback(() => {
    const channelId = dmTarget ? `dm-${dmTarget}` : selectedChannel
    setMessages(prev => {
      const filtered = prev.filter(m => m.channel !== channelId)
      storeMessages(filtered)
      return filtered
    })
  }, [dmTarget, selectedChannel])

  const channelMessages = messages.filter(m => {
    if (dmTarget) return m.channel === `dm-${dmTarget}`
    return m.channel === selectedChannel
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-700 border border-dark-500 rounded-xl w-full max-w-3xl h-[70vh] flex overflow-hidden shadow-2xl">
        {/* Sidebar */}
        <div className="w-48 bg-dark-800 border-r border-dark-500 flex flex-col shrink-0">
          <div className="px-3 py-3 border-b border-dark-500">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Agent Chat
            </h3>
          </div>

          {/* Channels */}
          <div className="px-2 py-2">
            <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 mb-1 font-semibold">Channels</div>
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => { setSelectedChannel(ch.id); setDmTarget(null); setError(null) }}
                className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  selectedChannel === ch.id && !dmTarget
                    ? 'bg-accent-orange/15 text-accent-orange'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-600'
                }`}
              >
                <span>{ch.icon}</span>
                <span className="truncate">{ch.label}</span>
                {/* Unread dot */}
                {messages.some(m => m.channel === ch.id && m.sender !== 'You' && m.id > Date.now() - 300000) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-orange ml-auto shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* DMs */}
          <div className="px-2 py-2 flex-1 overflow-y-auto">
            <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 mb-1 font-semibold">Direct Messages</div>
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => { setDmTarget(agent.name); setSelectedChannel(null); setError(null) }}
                className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  dmTarget === agent.name
                    ? 'bg-accent-orange/15 text-accent-orange'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-600'
                }`}
              >
                <span className="text-xs">{agent.emoji}</span>
                <span className="truncate flex-1">{agent.name}</span>
                {/* Status indicator */}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  agent.status === 'Working' || agent.status === 'Active' ? 'bg-green-500' : 'bg-gray-600'
                }`} />
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {dmTarget ? (
                <>
                  <span className="text-sm">{agents.find(a => a.name === dmTarget)?.emoji}</span>
                  <span className="text-sm font-semibold">{dmTarget}</span>
                  <span className="text-[10px] text-gray-500">{agents.find(a => a.name === dmTarget)?.role || 'Agent'}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    (agents.find(a => a.name === dmTarget)?.status === 'Working' || agents.find(a => a.name === dmTarget)?.status === 'Active')
                      ? 'bg-green-500' : 'bg-gray-600'
                  }`} />
                </>
              ) : (
                <>
                  <span className="text-sm">{channels.find(c => c.id === selectedChannel)?.icon}</span>
                  <span className="text-sm font-semibold">{channels.find(c => c.id === selectedChannel)?.label}</span>
                  <span className="text-[10px] text-gray-500">{channels.find(c => c.id === selectedChannel)?.desc}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Clear chat button */}
              {channelMessages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-[9px] text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded hover:bg-dark-600"
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {channelMessages.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <div className="text-2xl mb-2">
                  {dmTarget ? agents.find(a => a.name === dmTarget)?.emoji || '\u{1F916}' : channels.find(c => c.id === selectedChannel)?.icon}
                </div>
                <div className="text-gray-500 text-xs mb-1">
                  {dmTarget
                    ? `Start a conversation with ${dmTarget}`
                    : `Welcome to #${selectedChannel || 'council'}`
                  }
                </div>
                <div className="text-gray-600 text-[10px]">
                  {dmTarget
                    ? `${dmTarget} will respond using their AI personality and current pipeline knowledge.`
                    : 'Messages here are powered by real AI. Ask about strategy, tasks, or give directions.'
                  }
                </div>
              </div>
            )}

            {channelMessages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.sender === 'You' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                    msg.isError ? 'bg-red-900/30' : 'bg-dark-600'
                  }`}
                  style={msg.senderColor ? { borderColor: msg.senderColor, border: '1.5px solid' } : {}}
                >
                  {msg.senderEmoji || '\u{1F916}'}
                </div>
                <div className={`max-w-[75%] ${msg.sender === 'You' ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-2 mb-0.5 ${msg.sender === 'You' ? 'justify-end' : ''}`}>
                    <span className="text-[10px] font-semibold text-gray-400">{msg.sender}</span>
                    <span className="text-[9px] text-gray-600">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.model && (
                      <span className="text-[8px] text-gray-700 bg-dark-800 px-1 rounded">{msg.model.split('-').slice(0, 2).join('-')}</span>
                    )}
                  </div>
                  <div className={`text-[11px] px-3 py-2 rounded-lg leading-relaxed whitespace-pre-wrap ${
                    msg.isError
                      ? 'bg-red-900/20 text-red-400 border border-red-900/30 rounded-tl-sm'
                      : msg.sender === 'You'
                        ? 'bg-accent-orange/15 text-gray-200 rounded-tr-sm'
                        : 'bg-dark-600 text-gray-300 rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 bg-dark-600">
                  {dmTarget
                    ? agents.find(a => a.name === dmTarget)?.emoji || '\u{1F916}'
                    : '\u{1F3DB}'
                  }
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-gray-400">
                      {dmTarget || channels.find(c => c.id === selectedChannel)?.label || 'Council'}
                    </span>
                    <span className="text-[9px] text-accent-orange">thinking...</span>
                  </div>
                  <div className="bg-dark-600 text-gray-300 rounded-lg rounded-tl-sm px-3 py-2 inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-dark-500 shrink-0">
            {error && (
              <div className="text-[10px] text-red-400 mb-2 flex items-center gap-1">
                <span>{'\u{26A0}\u{FE0F}'}</span> {error}
                <button onClick={() => setError(null)} className="text-gray-600 hover:text-gray-400 ml-auto">dismiss</button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder={
                  isLoading
                    ? 'Waiting for response...'
                    : dmTarget
                      ? `Message ${dmTarget}...`
                      : `Message #${selectedChannel || 'council'}...`
                }
                disabled={isLoading}
                className="flex-1 bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-accent-orange/20 text-accent-orange rounded-lg hover:bg-accent-orange/30 transition-colors text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </span>
                ) : 'Send'}
              </button>
            </div>
            <div className="text-[9px] text-gray-700 mt-1.5 flex items-center justify-between">
              <span>
                {dmTarget
                  ? `Chatting with ${dmTarget} \u{2022} AI-powered responses`
                  : `#${selectedChannel || 'council'} \u{2022} AI-powered responses`
                }
              </span>
              <span>{channelMessages.length} messages</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

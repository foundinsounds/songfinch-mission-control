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
  const scrollRef = useRef(null)

  useEffect(() => {
    setMessages(getStoredMessages())
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const channels = [
    { id: 'council', label: 'Council', icon: '\u{1F3DB}' },
    { id: 'creative', label: 'Creative', icon: '\u{1F3A8}' },
    { id: 'strategy', label: 'Strategy', icon: '\u{1F4CA}' },
    { id: 'alerts', label: 'Alerts', icon: '\u{1F514}' },
  ]

  const sendMessage = useCallback(() => {
    if (!input.trim()) return
    const msg = {
      id: Date.now(),
      channel: dmTarget ? `dm-${dmTarget}` : selectedChannel,
      sender: 'You',
      senderEmoji: '\u{1F464}',
      text: input.trim(),
      timestamp: new Date().toISOString(),
      isDM: !!dmTarget,
      dmTarget,
    }
    const updated = [...messages, msg]
    setMessages(updated)
    storeMessages(updated)
    setInput('')

    // Simulate agent response
    if (dmTarget) {
      const agent = agents.find(a => a.name === dmTarget)
      if (agent) {
        setTimeout(() => {
          const responses = [
            `Got it. I'll factor that into my next task.`,
            `Thanks for the heads up. Adjusting my approach.`,
            `Understood. Let me review and get back to you.`,
            `On it. Will update when done.`,
            `Good point. I'll incorporate that feedback.`,
          ]
          const reply = {
            id: Date.now() + 1,
            channel: `dm-${dmTarget}`,
            sender: agent.name,
            senderEmoji: agent.emoji,
            senderColor: agent.color,
            text: responses[Math.floor(Math.random() * responses.length)],
            timestamp: new Date().toISOString(),
            isDM: true,
            dmTarget: 'You',
          }
          setMessages(prev => {
            const next = [...prev, reply]
            storeMessages(next)
            return next
          })
        }, 1000 + Math.random() * 2000)
      }
    }
  }, [input, selectedChannel, dmTarget, messages, agents])

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
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Agent Chat</h3>
          </div>

          {/* Channels */}
          <div className="px-2 py-2">
            <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 mb-1 font-semibold">Channels</div>
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => { setSelectedChannel(ch.id); setDmTarget(null) }}
                className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  selectedChannel === ch.id && !dmTarget
                    ? 'bg-accent-orange/15 text-accent-orange'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-600'
                }`}
              >
                <span>{ch.icon}</span> {ch.label}
              </button>
            ))}
          </div>

          {/* DMs */}
          <div className="px-2 py-2 flex-1 overflow-y-auto">
            <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 mb-1 font-semibold">Direct Messages</div>
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => { setDmTarget(agent.name); setSelectedChannel(null) }}
                className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  dmTarget === agent.name
                    ? 'bg-accent-orange/15 text-accent-orange'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-600'
                }`}
              >
                <span className="text-xs">{agent.emoji}</span>
                <span className="truncate">{agent.name}</span>
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
                  <span className="text-[10px] text-gray-500">Direct Message</span>
                </>
              ) : (
                <>
                  <span className="text-sm">{channels.find(c => c.id === selectedChannel)?.icon}</span>
                  <span className="text-sm font-semibold">{channels.find(c => c.id === selectedChannel)?.label}</span>
                </>
              )}
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {channelMessages.length === 0 && (
              <div className="text-center py-12 text-gray-600 text-xs">
                No messages yet. Start the conversation.
              </div>
            )}
            {channelMessages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.sender === 'You' ? 'flex-row-reverse' : ''}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 bg-dark-600" style={msg.senderColor ? { borderColor: msg.senderColor, border: '1.5px solid' } : {}}>
                  {msg.senderEmoji || '\u{1F916}'}
                </div>
                <div className={`max-w-[70%] ${msg.sender === 'You' ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-gray-400">{msg.sender}</span>
                    <span className="text-[9px] text-gray-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={`text-[11px] px-3 py-2 rounded-lg leading-relaxed ${
                    msg.sender === 'You'
                      ? 'bg-accent-orange/15 text-gray-200 rounded-tr-sm'
                      : 'bg-dark-600 text-gray-300 rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-dark-500 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={dmTarget ? `Message ${dmTarget}...` : `Message #${selectedChannel || 'council'}...`}
                className="flex-1 bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="px-4 py-2 bg-accent-orange/20 text-accent-orange rounded-lg hover:bg-accent-orange/30 transition-colors text-xs font-semibold disabled:opacity-30"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

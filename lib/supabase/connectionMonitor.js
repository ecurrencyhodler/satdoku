/**
 * Connection monitoring utility for Supabase Realtime
 * Tracks client creation, channel creation, subscriptions, and cleanup
 * 
 * Usage in console:
 * - window.supabaseConnections.getStats() - Get current stats
 * - window.supabaseConnections.getEvents() - Get all events
 * - window.supabaseConnections.getSummary() - Get summary with issues
 * - window.supabaseConnections.clear() - Clear all data
 */

class ConnectionMonitor {
  constructor() {
    this.events = [];
    this.clientCount = 0;
    this.channelCount = 0;
    this.activeChannels = new Set();
    this.subscriptionCount = 0;
    this.cleanupCount = 0;
    this.reconnectCount = 0;
  }

  logEvent(type, details = {}) {
    const event = {
      type,
      timestamp: Date.now(),
      time: new Date().toISOString(),
      ...details
    };
    
    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events.shift();
    }
    
    // Log to console with emoji for easy scanning
    const emoji = {
      'client_created': '🔵',
      'channel_created': '🟢',
      'channel_subscribed': '✅',
      'channel_unsubscribed': '❌',
      'channel_cleaned': '🧹',
      'reconnect': '🔄',
      'error': '⚠️'
    }[type] || '📝';
    
    console.log(`${emoji} [ConnectionMonitor] ${type}`, {
      ...details,
      stats: this.getStats()
    });
  }

  trackClientCreated(source, stackTrace) {
    this.clientCount++;
    this.logEvent('client_created', {
      source,
      clientId: this.clientCount,
      stackTrace: stackTrace ? stackTrace.split('\n').slice(0, 5).join('\n') : null
    });
  }

  trackChannelCreated(channelName, roomId, source) {
    this.channelCount++;
    this.activeChannels.add(channelName);
    this.logEvent('channel_created', {
      channelName,
      roomId,
      source,
      channelId: this.channelCount,
      activeChannels: this.activeChannels.size
    });
  }

  trackChannelSubscribed(channelName, roomId, status) {
    this.subscriptionCount++;
    this.logEvent('channel_subscribed', {
      channelName,
      roomId,
      status,
      subscriptionId: this.subscriptionCount
    });
  }

  trackChannelUnsubscribed(channelName, roomId, source) {
    this.activeChannels.delete(channelName);
    this.logEvent('channel_unsubscribed', {
      channelName,
      roomId,
      source,
      activeChannels: this.activeChannels.size
    });
  }

  trackChannelCleaned(channelName, roomId, source) {
    this.cleanupCount++;
    this.activeChannels.delete(channelName);
    this.logEvent('channel_cleaned', {
      channelName,
      roomId,
      source,
      cleanupId: this.cleanupCount,
      activeChannels: this.activeChannels.size
    });
  }

  trackReconnect(roomId, attempt) {
    this.reconnectCount++;
    this.logEvent('reconnect', {
      roomId,
      attempt,
      reconnectId: this.reconnectCount
    });
  }

  trackError(error, source) {
    this.logEvent('error', {
      error: error?.message || String(error),
      source,
      stack: error?.stack
    });
  }

  getStats() {
    return {
      totalClientsCreated: this.clientCount,
      totalChannelsCreated: this.channelCount,
      activeChannels: this.activeChannels.size,
      totalSubscriptions: this.subscriptionCount,
      totalCleanups: this.cleanupCount,
      totalReconnects: this.reconnectCount,
      events: this.events.length
    };
  }

  getEvents(filter = {}) {
    let filtered = [...this.events];
    
    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }
    if (filter.roomId) {
      filtered = filtered.filter(e => e.roomId === filter.roomId);
    }
    if (filter.since) {
      filtered = filtered.filter(e => e.timestamp >= filter.since);
    }
    
    return filtered;
  }

  getSummary() {
    const stats = this.getStats();
    const recentEvents = this.events.slice(-20);
    
    const byType = {};
    this.events.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });
    
    return {
      stats,
      eventsByType: byType,
      recentEvents: recentEvents.slice(-10),
      issues: this.detectIssues()
    };
  }

  detectIssues() {
    const issues = [];
    
    // Check for too many clients
    if (this.clientCount > 5) {
      issues.push({
        severity: 'high',
        message: `Too many clients created: ${this.clientCount}. Should reuse single client.`,
        recommendation: 'Implement singleton pattern for Supabase client'
      });
    }
    
    // Check for channels not being cleaned up
    if (this.activeChannels.size > 2) {
      issues.push({
        severity: 'high',
        message: `Too many active channels: ${this.activeChannels.size}. Channels may not be cleaned up properly.`,
        recommendation: 'Ensure channels are unsubscribed in cleanup functions'
      });
    }
    
    // Check for excessive reconnects
    if (this.reconnectCount > 10) {
      issues.push({
        severity: 'medium',
        message: `High reconnect count: ${this.reconnectCount}. Connection may be unstable.`,
        recommendation: 'Check network conditions and reconnection logic'
      });
    }
    
    // Check for channels created without cleanup
    const unclosedChannels = this.channelCount - this.cleanupCount;
    if (unclosedChannels > 2) {
      issues.push({
        severity: 'high',
        message: `Potential leak: ${unclosedChannels} channels created but not cleaned up.`,
        recommendation: 'Review cleanup logic in useEffect return functions'
      });
    }
    
    return issues;
  }

  clear() {
    this.events = [];
    this.clientCount = 0;
    this.channelCount = 0;
    this.activeChannels.clear();
    this.subscriptionCount = 0;
    this.cleanupCount = 0;
    this.reconnectCount = 0;
    console.log('✅ [ConnectionMonitor] Cleared all data');
  }
}

// Create singleton instance
const monitor = new ConnectionMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.supabaseConnections = {
    getStats: () => monitor.getStats(),
    getEvents: (filter) => monitor.getEvents(filter),
    getSummary: () => monitor.getSummary(),
    clear: () => monitor.clear()
  };
  
  console.log('📊 [ConnectionMonitor] Available in console: window.supabaseConnections');
}

export default monitor;

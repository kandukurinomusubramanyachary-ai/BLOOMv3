// Only presentation fields leave the server. Memories, request hashes and metrics
// belong to the explicit account export, never ordinary chat history.
function conversationsForClient(data = {}) {
  const messages = new Map();
  for (const row of data.messages || []) {
    const conversationId = row.conversationId || row.conversation_id;
    if (!messages.has(conversationId)) messages.set(conversationId, []);
    messages.get(conversationId).push({
      id: row.role === 'user' ? (row.clientMessageId || row.client_message_id || row.id) : row.id,
      role: row.role,
      text: row.content,
      createdAt: row.createdAt || row.created_at,
      deliveryStatus: 'delivered',
      ...(row.feedbackUpdatedAt || row.feedback_updated_at ? {
        feedback: row.feedback ?? null,
        feedbackUpdatedAt: row.feedbackUpdatedAt || row.feedback_updated_at,
      } : {}),
    });
  }
  return (data.conversations || []).map(row => {
    const items = messages.get(row.id) || [];
    return {
      id: row.id,
      title: items.find(item => item.role === 'user')?.text?.slice(0, 64) || 'Conversation with Meg',
      createdAt: row.createdAt || row.created_at,
      updatedAt: row.updatedAt || row.updated_at,
      messages: items,
    };
  });
}

module.exports = { conversationsForClient };

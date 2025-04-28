document.addEventListener("DOMContentLoaded", () => {
  // Display initial message
  addBotMessage(
    `Welcome to our restaurant! Please choose an option:\n${getMenuOptions()}`
  );

  // Check for URL query message (e.g., payment callback)
  const urlParams = new URLSearchParams(window.location.search);
  const message = urlParams.get("message");
  if (message) addBotMessage(message);
});

// Helper: Menu options
function getMenuOptions() {
  return `
  Select 1 to Place an order
  Select 99 to checkout order
  Select 98 to see order history
  Select 97 to see current order
  Select 0 to cancel order
    `;
}

// Add bot message to chat
function addBotMessage(message) {
  const chatBox = document.getElementById("chat-box");
  const messageDiv = document.createElement("div");
  messageDiv.className = "message bot";
  messageDiv.textContent = message;
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Check for payment URL
  const paymentUrlMatch = message.match(/Pay \$\d+ here: (https:\/\/\S+)/);
  if (paymentUrlMatch) {
    window.location.href = paymentUrlMatch[1]; // Redirect to Paystack
  }
}

// Add user message to chat
function addUserMessage(message) {
  const chatBox = document.getElementById("chat-box");
  const messageDiv = document.createElement("div");
  messageDiv.className = "message user";
  messageDiv.textContent = message;
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send message to backend
function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;

  addUserMessage(message);
  input.value = "";

  fetch("http://localhost:10000/chat", {
    // Use explicit port
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
    .then((res) => res.json())
    .then((data) => {
      addBotMessage(data.response);
    })
    .catch((err) => {
      addBotMessage("Error communicating with the server.");
    });
}

// Handle Enter key
document.getElementById("user-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

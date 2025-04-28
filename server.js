const express = require("express");
const cors = require("cors");
const session = require("express-session");
const axios = require("axios");
const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors()); // This allows requests from all origins
app.use(express.json());
app.use(express.static("public"));
app.use(
  session({
    secret: "restaurant-chatbot-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      //sameSite: 'none', // Required for cross-origin cookies
    },
  })
);

// Menu Items
const menu = [
  { id: 1, name: "Burger", price: 10, options: ["Cheese", "No Cheese"] },
  { id: 2, name: "Pizza", price: 15, options: ["Pepperoni", "Veggie"] },
  { id: 3, name: "Salad", price: 8, options: ["Caesar", "Greek"] },
];

// Store orders in memory (use a database in production)
const orders = new Map(); // sessionId -> [{item, option, schedule}]
const orderHistory = new Map(); // sessionId -> [{item, option, schedule, timestamp}]

// Helper: Send menu options
const getMenuOptions = () => `
Select 1 to Place an order
Select 99 to checkout order
Select 98 to see order history
Select 97 to see current order
Select 0 to cancel order
`;

// Helper: Format menu items
const getMenuItems = () =>
  menu
    .map(
      (item) =>
        `${item.id}. ${item.name} - $${
          item.price
        } (Options: ${item.options.join(", ")})`
    )
    .join("\n");

app.get("/test", (req, res) => res.send("Server is running"));

// Chatbot logic
app.post("/chat", (req, res) => {
  const { message } = req.body;
  const sessionId = req.sessionID;
  let response = "";

  // Validate input
  const option = parseInt(message);
  if (isNaN(option)) {
    return res.json({
      response: "Invalid input. Please enter a number.\n" + getMenuOptions(),
    });
  }

  // Initialize session orders if not exists
  if (!orders.has(sessionId)) orders.set(sessionId, []);
  if (!orderHistory.has(sessionId)) orderHistory.set(sessionId, []);

  // Handle options
  if (option === 1) {
    response = `Please select an item by number:\n${getMenuItems()}`;
  } else if (option >= 1 && option <= menu.length) {
    const item = menu.find((m) => m.id === option);
    if (item) {
      response = `Selected ${item.name}. Choose an option (e.g., 1 for ${
        item.options[0]
      }):\n${item.options.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}`;
      req.session.pendingItem = item; // Store pending item
    } else {
      response = "Invalid item. Try again.\n" + getMenuItems();
    }
  } else if (
    req.session.pendingItem &&
    option >= 1 &&
    option <= req.session.pendingItem.options.length
  ) {
    const item = req.session.pendingItem;
    const selectedOption = item.options[option - 1];
    response = `Added ${item.name} (${selectedOption}) to your order. Schedule order? (e.g., "Now" or "2025-04-29 12:00")`;
    req.session.pendingOption = selectedOption; // Store pending option
  } else if (req.session.pendingItem && req.session.pendingOption) {
    const item = req.session.pendingItem;
    const selectedOption = req.session.pendingOption;
    const schedule = message.trim() === "Now" ? "Now" : message; // Basic schedule validation
    orders.get(sessionId).push({ item, option: selectedOption, schedule });
    response = `${
      item.name
    } (${selectedOption}) scheduled for ${schedule}. Add more items?\n${getMenuItems()}\n${getMenuOptions()}`;
    req.session.pendingItem = null;
    req.session.pendingOption = null;
  } else if (option === 99) {
    const currentOrders = orders.get(sessionId);
    if (currentOrders.length > 0) {
      // Initiate Paystack payment
      const total = currentOrders.reduce(
        (sum, order) => sum + order.item.price,
        0
      );
      axios
        .post(
          "https://api.paystack.co/transaction/initialize",
          {
            email: `user_${sessionId}@example.com`, // Unique email per session
            amount: total * 100, // Paystack uses kobo
            callback_url: `${req.protocol}://${req.get(
              "host"
            )}/payment-callback`,
          },
          {
            headers: {
              Authorization: `sk_test_5ce8a9b014e8bb41750ac67697aec152bf048019`,
            }, // Replace with your Paystack test key
          }
        )
        .then((paystackRes) => {
          orderHistory
            .get(sessionId)
            .push(
              ...currentOrders.map((o) => ({ ...o, timestamp: new Date() }))
            );
          orders.set(sessionId, []); // Clear current order
          res.json({
            response: `Order placed! Pay $${total} here: ${paystackRes.data.data.authorization_url}\nSelect 1 to place a new order.`,
            paymentUrl: paystackRes.data.data.authorization_url,
          });
        })
        .catch((err) => {
          res.json({ response: "Payment initiation failed. Try again." });
        });
    } else {
      response = "No order to place.\n" + getMenuOptions();
    }
  } else if (option === 98) {
    const history = orderHistory.get(sessionId);
    response =
      history.length > 0
        ? `Order History:\n${history
            .map(
              (o) =>
                `${o.item.name} (${o.option}) - Scheduled: ${
                  o.schedule
                } at ${o.timestamp.toISOString()}`
            )
            .join("\n")}\n${getMenuOptions()}`
        : "No order history.\n" + getMenuOptions();
  } else if (option === 97) {
    const currentOrders = orders.get(sessionId);
    response =
      currentOrders.length > 0
        ? `Current Order:\n${currentOrders
            .map(
              (o) => `${o.item.name} (${o.option}) - Scheduled: ${o.schedule}`
            )
            .join("\n")}\n${getMenuOptions()}`
        : "No current order.\n" + getMenuOptions();
  } else if (option === 0) {
    orders.set(sessionId, []);
    response = "Order cancelled.\n" + getMenuOptions();
  } else {
    response = "Invalid option.\n" + getMenuOptions();
  }

  res.json({ response });
});

// Payment callback
app.get("/payment-callback", (req, res) => {
  const { reference } = req.query;
  axios
    .get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `sk_test_5ce8a9b014e8bb41750ac67697aec152bf048019`,
      },
    })
    .then((paystackRes) => {
      if (paystackRes.data.data.status === "success") {
        res.redirect(
          "/?message=Payment successful! Select 1 to place a new order."
        );
      } else {
        res.redirect("/?message=Payment failed. Try again.");
      }
    })
    .catch((err) => {
      res.redirect("/?message=Payment verification failed.");
    });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

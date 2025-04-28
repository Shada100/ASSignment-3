# Restaurant Chatbot

A simple chatbot for a restaurant to assist customers in placing orders, viewing order history, and making payments via Paystack.

## Features
- Chat interface for selecting menu options.
- Session-based order tracking (no authentication required).
- Menu with customizable items and options.
- Order scheduling (e.g., "Now" or specific date/time).
- Payment integration with Paystack (test mode).
- View current order and order history.
- Cancel orders.
- Input validation.

## Prerequisites
- Node.js (v16 or higher)
- Paystack account (test mode)

## Setup
 Clone the repository:
  
git clone https://github.com/Shada100/restaurant-chatbot.git
cd restaurant-chatbot
Install dependencies:

npm install

Set up environment variables:
Create a .env file.

Add your Paystack test secret key:

PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key

Run the application:
npm start

Open http://localhost:3000 in your browser.


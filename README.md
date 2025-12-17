# Satdoku

A Sudoku game with Lightning payments via Money Dev Kit. Players can purchase additional lives when they run out.

## Features

- 9×9 Sudoku puzzles with three difficulty levels
- Lives system - start with 1 free life
- Lightning payments to purchase additional lives (1,500 sats per life)
- Score tracking with animations
- AI-powered Sudoku tutor (Howie) - get guided help without revealing answers
- LocalStorage persistence
- Clean, minimal UI

## Setup

### Prerequisites

- Node.js 18+
- Money Dev Kit account (get credentials from [moneydevkit.com](https://moneydevkit.com) or run `npx @moneydevkit/create`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file with your Money Dev Kit credentials and OpenAI API key:
```env
MDK_ACCESS_TOKEN=your_api_key_here
MDK_WEBHOOK_SECRET=your_webhook_key_here
MDK_MNEMONIC=your_mnemonic_here
REDIS_URL=your_redis_url_here
OPENAI_API_KEY=your_openai_api_key_here
```

**Note:** For local development, you can use a local Redis instance or a service like [Upstash](https://upstash.com/) for a free Redis database. The `REDIS_URL` is required for payment verification webhooks to work.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard:
   - `MDK_ACCESS_TOKEN`
   - `MDK_WEBHOOK_SECRET`
   - `MDK_MNEMONIC`
   - `REDIS_URL` (required for payment verification - use Vercel Redis or Upstash)
   - `OPENAI_API_KEY` (required for the Sudoku tutor chatbot feature)
4. Configure webhook in MoneyDevKit dashboard:
   - Go to your MoneyDevKit dashboard
   - Set webhook URL to: `https://your-domain.com` (root URL)
   - This allows the server to verify payments and grant lives securely
5. Deploy!

## Project Structure

```
satdoku/
├── app/                    # Next.js App Router
│   ├── page.js            # Main game page
│   ├── layout.js          # Root layout
│   ├── checkout/[id]/     # MDK checkout page
│   ├── purchase-success/  # Payment success handler
│   └── api/mdk/           # MDK API endpoint
├── components/            # React components
│   ├── GameBoard.jsx
│   ├── StatsBar.jsx
│   ├── GameControls.jsx
│   ├── PurchaseLifeModal.jsx
│   └── Modals/
├── lib/                   # Utility modules
│   ├── redis.js          # Redis client for payment verification
│   └── webhookHandler.js # Webhook handling utilities
└── src/js/                # Game logic (unchanged)
    ├── core/              # Core game logic
    ├── system/            # Utilities
    └── ui/                # UI helpers
```

## How It Works

1. Player starts with 1 free life
2. When a mistake is made, player loses a life
3. When lives reach 0, a purchase modal appears
4. Player can purchase a life via Lightning payment (1,500 sats)
5. After successful payment, life is added and gameplay resumes

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server


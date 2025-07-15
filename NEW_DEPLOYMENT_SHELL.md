
# NextJS Project Setup for GovWin Dashboard Migration

## 1. Initial Project Creation

```bash
npx create-next-app@latest govwin-dashboard --typescript --tailwind --eslint --app
cd govwin-dashboard
```

## 2. Essential Dependencies Installation

```bash
# UI Components & Styling
npm install @radix-ui/react-slot @radix-ui/react-dropdown-menu @radix-ui/react-dialog
npm install class-variance-authority clsx tailwind-merge lucide-react

# Data Management
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install @azure/cosmos

# Authentication (Microsoft)
npm install @azure/msal-browser @azure/msal-react

# Form Handling & Date Management
npm install react-hook-form @hookform/resolvers zod
npm install date-fns

# Development Tools
npm install --save-dev @types/node
```

## 3. shadcn/ui Setup

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input select checkbox badge
npx shadcn-ui@latest add dropdown-menu dialog alert-dialog
npx shadcn-ui@latest add date-picker calendar popover
```

## 4. Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── opportunities/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── seen/route.ts
│   │   │       └── save/route.ts
│   │   └── filters/route.ts
│   ├── dashboard/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/ (shadcn components)
│   ├── auth/
│   │   ├── auth-provider.tsx
│   │   └── login-button.tsx
│   ├── opportunities/
│   │   ├── opportunity-card.tsx
│   │   ├── opportunity-list.tsx
│   │   └── opportunity-filters.tsx
│   └── layout/
│       ├── sidebar.tsx
│       └── header.tsx
├── lib/
│   ├── cosmos.ts
│   ├── auth-config.ts
│   ├── utils.ts
│   └── types.ts
└── hooks/
    ├── use-opportunities.ts
    ├── use-filters.ts
    └── use-user-actions.ts
```

## 5. Environment Variables (.env.local)

```env
# Azure Cosmos DB
COSMOS_URL=your_cosmos_url
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE=govwin
COSMOS_CONTAINER=opportunities_optimized

# Microsoft Authentication
AZURE_AD_CLIENT_ID=656ed31b-aff5-4e16-b26c-0a4d1714c76b
AZURE_AD_TENANT_ID=ba8a4c68-30ec-43c1-b825-096947db87a5
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=656ed31b-aff5-4e16-b26c-0a4d1714c76b
NEXT_PUBLIC_AZURE_AD_TENANT_ID=ba8a4c68-30ec-43c1-b825-096947db87a5

# Application
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=74/8Q4dGrubNxTQfy7SheYayLSIxX++jUSIpTNi7vQE=
```
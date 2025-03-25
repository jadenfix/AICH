# AICH
AICH: AI powered Cryptocurrency Hub

Harnessing the power of AI (LLMs and Machine Learning) for cryptocurrency analysis


aich/
├── apps
│   ├── api
│   │   ├── src
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts
│   │   │   ├── forum
│   │   │   │   ├── forum.controller.ts
│   │   │   │   ├── forum.module.ts
│   │   │   │   └── forum.service.ts
│   │   │   ├── ai
│   │   │   │   ├── ai.controller.ts
│   │   │   │   ├── ai.module.ts
│   │   │   │   └── ai.service.ts
│   │   │   └── news
│   │   │       ├── news.controller.ts
│   │   │       ├── news.module.ts
│   │   │       └── news.service.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   └── web
│       ├── pages
│       │   ├── index.tsx
│       │   ├── forum.tsx
│       │   └── _app.tsx
│       ├── components
│       │   ├── Layout.tsx
│       │   └── ForumList.tsx
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
├── packages
│   ├── types
│   │   ├── forum.types.ts
│   │   └── index.ts
│   └── ui
│       ├── Button.tsx
│       └── Input.tsx
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md

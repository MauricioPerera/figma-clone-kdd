/**
 * Plantillas y componentes UI prediseñados para Figma Clone KDD.
 */

export const UI_TEMPLATES = {
  mobile_login: {
    id: 'mobile_login',
    title: 'Mobile Login Screen',
    description: 'Pantalla completa de autenticación para iPhone con campos y botones sociales.',
    create: (originX = 100, originY = 100) => {
      const frameId = `frame_${Date.now()}`;
      return [
        {
          id: frameId,
          type: 'frame',
          name: 'iPhone 16 - Login',
          x: originX,
          y: originY,
          width: 390,
          height: 720,
          fill: '#121212',
          stroke: '#2a2a2a',
          cornerRadius: 44,
          clipContent: true
        },
        // Decorative glow circle
        {
          type: 'circle',
          name: 'Background Glow',
          parentId: frameId,
          x: originX + 60,
          y: originY - 50,
          width: 270,
          height: 270,
          fill: '#3b82f6',
          opacity: 0.25
        },
        // Title
        {
          type: 'text',
          name: 'Heading',
          parentId: frameId,
          x: originX + 32,
          y: originY + 120,
          width: 326,
          height: 40,
          text: 'Welcome back',
          fontSize: 32,
          fontWeight: '700',
          fill: '#ffffff'
        },
        // Subtitle
        {
          type: 'text',
          name: 'Subtitle',
          parentId: frameId,
          x: originX + 32,
          y: originY + 168,
          width: 326,
          height: 24,
          text: 'Sign in to access your workspace',
          fontSize: 15,
          fontWeight: '400',
          fill: '#9ca3af'
        },
        // Email Field
        {
          type: 'rect',
          name: 'Email Input Container',
          parentId: frameId,
          x: originX + 32,
          y: originY + 230,
          width: 326,
          height: 52,
          fill: '#1e1e1e',
          stroke: '#374151',
          strokeWidth: 1,
          cornerRadius: 14
        },
        {
          type: 'text',
          name: 'Email Placeholder',
          parentId: frameId,
          x: originX + 48,
          y: originY + 246,
          width: 280,
          height: 20,
          text: 'developer@kdd.org',
          fontSize: 14,
          fill: '#9ca3af'
        },
        // Password Field
        {
          type: 'rect',
          name: 'Password Input Container',
          parentId: frameId,
          x: originX + 32,
          y: originY + 300,
          width: 326,
          height: 52,
          fill: '#1e1e1e',
          stroke: '#374151',
          strokeWidth: 1,
          cornerRadius: 14
        },
        {
          type: 'text',
          name: 'Password Placeholder',
          parentId: frameId,
          x: originX + 48,
          y: originY + 316,
          width: 280,
          height: 20,
          text: '••••••••••••',
          fontSize: 14,
          fill: '#9ca3af'
        },
        // Primary Sign In Button
        {
          type: 'rect',
          name: 'Sign In Button',
          parentId: frameId,
          x: originX + 32,
          y: originY + 380,
          width: 326,
          height: 54,
          fill: '#0d99ff',
          cornerRadius: 14,
          shadow: { x: 0, y: 8, blur: 20, color: 'rgba(13, 153, 255, 0.4)' }
        },
        {
          type: 'text',
          name: 'Sign In Label',
          parentId: frameId,
          x: originX + 32,
          y: originY + 397,
          width: 326,
          height: 20,
          text: 'Continue with Email',
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
          fill: '#ffffff'
        },
        // Separator line
        {
          type: 'line',
          name: 'Divider Line',
          parentId: frameId,
          x: originX + 32,
          y: originY + 475,
          width: 326,
          height: 0,
          stroke: '#2e2e2e',
          strokeWidth: 1
        },
        // Social Button Apple
        {
          type: 'rect',
          name: 'Apple Login Button',
          parentId: frameId,
          x: originX + 32,
          y: originY + 510,
          width: 326,
          height: 50,
          fill: '#242424',
          stroke: '#3a3a3a',
          cornerRadius: 14
        },
        {
          type: 'text',
          name: 'Apple Login Label',
          parentId: frameId,
          x: originX + 32,
          y: originY + 525,
          width: 326,
          height: 20,
          text: '  Continue with Apple',
          fontSize: 15,
          fontWeight: '500',
          textAlign: 'center',
          fill: '#ffffff'
        }
      ];
    }
  },

  saas_hero: {
    id: 'saas_hero',
    title: 'SaaS Hero Section',
    description: 'Header moderno con navbar, badge, título impactante y tarjeta flotante.',
    create: (originX = 100, originY = 100) => {
      const frameId = `frame_${Date.now()}`;
      return [
        {
          id: frameId,
          type: 'frame',
          name: 'Desktop 1440 - Hero',
          x: originX,
          y: originY,
          width: 960,
          height: 560,
          fill: '#090d16',
          stroke: '#1e293b',
          cornerRadius: 20,
          clipContent: true
        },
        // Navbar
        {
          type: 'rect',
          name: 'Navbar Bar',
          parentId: frameId,
          x: originX + 40,
          y: originY + 24,
          width: 880,
          height: 56,
          fill: 'rgba(30, 41, 59, 0.7)',
          stroke: 'rgba(255, 255, 255, 0.08)',
          cornerRadius: 16
        },
        {
          type: 'text',
          name: 'Logo',
          parentId: frameId,
          x: originX + 64,
          y: originY + 41,
          width: 120,
          height: 22,
          text: '❖ FastStudio',
          fontSize: 18,
          fontWeight: '700',
          fill: '#0d99ff'
        },
        {
          type: 'text',
          name: 'Nav Links',
          parentId: frameId,
          x: originX + 240,
          y: originY + 43,
          width: 400,
          height: 20,
          text: 'Features        Templates        WebMCP Docs        Pricing',
          fontSize: 14,
          fill: '#94a3b8'
        },
        // Badge
        {
          type: 'rect',
          name: 'Announcement Badge',
          parentId: frameId,
          x: originX + 340,
          y: originY + 128,
          width: 280,
          height: 32,
          fill: '#1e293b',
          stroke: '#3b82f6',
          cornerRadius: 16
        },
        {
          type: 'text',
          name: 'Badge Label',
          parentId: frameId,
          x: originX + 340,
          y: originY + 135,
          width: 280,
          height: 20,
          text: '🚀 Standard WebMCP 1.0 Ready',
          fontSize: 13,
          fontWeight: '500',
          textAlign: 'center',
          fill: '#60a5fa'
        },
        // Main Headline
        {
          type: 'text',
          name: 'Hero Headline',
          parentId: frameId,
          x: originX + 80,
          y: originY + 180,
          width: 800,
          height: 80,
          text: 'Design with Autonomous AI Power',
          fontSize: 44,
          fontWeight: '800',
          textAlign: 'center',
          fill: '#ffffff'
        },
        // Subhead
        {
          type: 'text',
          name: 'Hero Subhead',
          parentId: frameId,
          x: originX + 160,
          y: originY + 270,
          width: 640,
          height: 48,
          text: 'The 100% client-side vector editor governed by KDD contracts and seamlessly controllable by browser AI agents.',
          fontSize: 17,
          fontWeight: '400',
          textAlign: 'center',
          fill: '#94a3b8'
        },
        // Buttons
        {
          type: 'rect',
          name: 'CTA Primary',
          parentId: frameId,
          x: originX + 330,
          y: originY + 340,
          width: 140,
          height: 48,
          fill: '#3b82f6',
          cornerRadius: 12,
          shadow: { x: 0, y: 6, blur: 16, color: 'rgba(59, 130, 246, 0.4)' }
        },
        {
          type: 'text',
          name: 'CTA Primary Text',
          parentId: frameId,
          x: originX + 330,
          y: originY + 354,
          width: 140,
          height: 20,
          text: 'Start Designing',
          fontSize: 14,
          fontWeight: '600',
          textAlign: 'center',
          fill: '#ffffff'
        },
        {
          type: 'rect',
          name: 'CTA Secondary',
          parentId: frameId,
          x: originX + 490,
          y: originY + 340,
          width: 140,
          height: 48,
          fill: '#1e293b',
          stroke: '#334155',
          cornerRadius: 12
        },
        {
          type: 'text',
          name: 'CTA Secondary Text',
          parentId: frameId,
          x: originX + 490,
          y: originY + 354,
          width: 140,
          height: 20,
          text: 'View Contracts',
          fontSize: 14,
          fontWeight: '500',
          textAlign: 'center',
          fill: '#cbd5e1'
        }
      ];
    }
  },

  dashboard_card: {
    id: 'dashboard_card',
    title: 'Analytics Metric Card',
    description: 'Tarjeta de métricas de analítica con gráfica de barras de tendencia.',
    create: (originX = 100, originY = 100) => {
      const cardId = `rect_${Date.now()}`;
      return [
        {
          id: cardId,
          type: 'rect',
          name: 'Card Container',
          x: originX,
          y: originY,
          width: 320,
          height: 190,
          fill: '#18181b',
          stroke: '#27272a',
          strokeWidth: 1,
          cornerRadius: 18,
          shadow: { x: 0, y: 10, blur: 24, color: 'rgba(0,0,0,0.4)' }
        },
        {
          type: 'text',
          name: 'Card Title',
          x: originX + 24,
          y: originY + 22,
          width: 200,
          height: 18,
          text: 'Total Revenue',
          fontSize: 14,
          fontWeight: '500',
          fill: '#a1a1aa'
        },
        {
          type: 'text',
          name: 'Card Metric',
          x: originX + 24,
          y: originY + 48,
          width: 200,
          height: 38,
          text: '$48,290.00',
          fontSize: 32,
          fontWeight: '700',
          fill: '#ffffff'
        },
        // Growth Badge
        {
          type: 'rect',
          name: 'Growth Badge',
          x: originX + 24,
          y: originY + 96,
          width: 90,
          height: 24,
          fill: 'rgba(16, 185, 129, 0.15)',
          cornerRadius: 6
        },
        {
          type: 'text',
          name: 'Growth Label',
          x: originX + 24,
          y: originY + 100,
          width: 90,
          height: 16,
          text: '↑ +18.4%',
          fontSize: 12,
          fontWeight: '600',
          textAlign: 'center',
          fill: '#34d399'
        },
        // Mini Chart Bars
        { type: 'rect', name: 'Bar 1', x: originX + 170, y: originY + 105, width: 14, height: 28, fill: '#3f3f46', cornerRadius: 4 },
        { type: 'rect', name: 'Bar 2', x: originX + 192, y: originY + 95, width: 14, height: 38, fill: '#3f3f46', cornerRadius: 4 },
        { type: 'rect', name: 'Bar 3', x: originX + 214, y: originY + 75, width: 14, height: 58, fill: '#3f3f46', cornerRadius: 4 },
        { type: 'rect', name: 'Bar 4', x: originX + 236, y: originY + 85, width: 14, height: 48, fill: '#3f3f46', cornerRadius: 4 },
        { type: 'rect', name: 'Bar 5', x: originX + 258, y: originY + 60, width: 14, height: 73, fill: '#10b981', cornerRadius: 4 },
        { type: 'rect', name: 'Bar 6', x: originX + 280, y: originY + 45, width: 14, height: 88, fill: '#10b981', cornerRadius: 4 }
      ];
    }
  }
};

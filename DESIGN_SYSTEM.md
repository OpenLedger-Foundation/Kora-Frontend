# Design System

This document describes the Kora Protocol frontend design system. It combines Tailwind utility classes with CSS custom properties defined in `app/globals.css` and reusable UI primitives in `components/ui`.

## Principles

- Dark-mode-first by default.
- Semantic tokens for color, spacing, typography, shadows, and radius.
- Component primitives are built with Tailwind and reusable variants.
- Avoid new raw colors; use the existing semantic palette.
- Use `cn()` for conditional class names and variant-based styling.

## Theming

Kora uses CSS custom properties in `app/globals.css`.

### Color tokens

The main semantic color tokens are defined in HSL format:

- `--color-primary`
- `--color-primary-foreground`
- `--color-surface`
- `--color-surface-elevated`
- `--color-surface-muted`
- `--color-border`
- `--color-border-subtle`
- `--color-text`
- `--color-text-muted`
- `--color-text-subtle`
- `--color-accent`
- `--color-accent-muted`
- `--color-destructive`
- `--color-destructive-muted`
- `--color-success`
- `--color-warning`
- `--color-info`

These values are then mapped to Tailwind colors in `tailwind.config.ts` using the following semantic aliases:

- `background` → `--color-surface`
- `foreground` → `--color-text`
- `card` → `--color-surface-elevated`
- `popover` → `--color-surface-elevated`
- `primary` → `--color-primary`
- `secondary` → `--color-surface-muted`
- `muted` → `--color-surface-muted`
- `accent` → `--color-accent`
- `destructive` → `--color-destructive`
- `border` → `--color-border`
- `input` → `--color-border`
- `ring` → `--color-primary`

Use these aliases in Tailwind classes, for example:

- `bg-background`
- `text-foreground`
- `bg-card`
- `text-muted-foreground`
- `border-border`
- `bg-primary`
- `text-primary-foreground`
- `bg-destructive/10`
- `focus:ring-ring/50`

### Dark mode

Dark mode is enabled by toggling the `.dark` class on the root element. The theme values defined in the `.dark` rule override the default root variables.

The `ThemeProvider` component in `components/layout/ThemeProvider.tsx` manages theme state and applies the class using the stored user preference.

## Spacing

Spacing tokens are defined in `app/globals.css` and mapped in `tailwind.config.ts` as custom `spacing` values:

- `--space-1` → `0.25rem`
- `--space-2` → `0.5rem`
- `--space-3` → `0.75rem`
- `--space-4` → `1rem`
- `--space-5` → `1.25rem`
- `--space-6` → `1.5rem`
- `--space-8` → `2rem`
- `--space-10` → `2.5rem`
- `--space-12` → `3rem`

Tailwind utilities use these tokens with classes like:

- `p-token-4`
- `px-token-6`
- `gap-token-3`
- `space-y-token-4`

## Typography

Typography tokens are defined in `app/globals.css`:

- `--font-size-xs`
- `--font-size-sm`
- `--font-size-base`
- `--font-size-lg`
- `--font-size-xl`
- `--font-size-2xl`
- `--font-size-3xl`
- `--line-height-tight`
- `--line-height-normal`
- `--line-height-relaxed`
- `--font-geist-sans`
- `--font-geist-mono`

These are mapped in Tailwind using custom font sizes:

- `text-token-xs`
- `text-token-sm`
- `text-token-base`
- `text-token-lg`
- `text-token-xl`
- `text-token-2xl`
- `text-token-3xl`

And font families:

- `font-sans`
- `font-mono`

## Shadows & Radius

Shadow tokens are defined in `app/globals.css` and mapped via Tailwind custom shadows:

- `shadow-token-sm`
- `shadow-token-md`
- `shadow-token-lg`
- `shadow-token-glow`

Radius is defined as:

- `--radius: 0.75rem`

Tailwind radius classes use the alias values:

- `rounded-lg`
- `rounded-md`
- `rounded-sm`

## Motion & Animations

Common animations are defined in `tailwind.config.ts`:

- `animate-accordion-down`
- `animate-accordion-up`
- `animate-shimmer`
- `animate-fade-in`
- `animate-pulse-glow`

Custom utility classes in `app/globals.css` provide hero and background motion styles:

- `.hero-background`
- `.hero-grid-dots`

## Component Primitives

Reusable UI primitives are provided under `components/ui`. These components use the design system and Tailwind tokens.

### Buttons

Use `Button` from `components/ui/button.tsx`.

Variants:

- `primary` (default)
- `secondary`
- `outline`
- `ghost`
- `danger`

Sizes:

- `sm`
- `md`
- `lg`
- `icon`

Example:

```tsx
<Button variant="primary">Submit</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger" size="sm">Delete</Button>
```

### Inputs

Use `Input` from `components/ui/input.tsx`.

Input states are handled with:

- default
- `error`
- `success`

Example:

```tsx
<Input label="Invoice ID" error={errorMessage} placeholder="Enter invoice ID" />
```

### Cards

Use `Card` from `components/ui/card.tsx` for surface containers.

Example:

```tsx
<Card hoverable>
  <CardHeader>
    <CardTitle>Wallet balance</CardTitle>
    <CardDescription>Latest payment details</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### Additional primitives

- `Badge`
- `Dialog`
- `Textarea`
- `NumberInput`
- `DatePicker`
- `FileInput`
- `Pagination`
- `Progress`
- `DataTable`
- `StatCard`
- `CopyButton`
- `Highlight`

## Best Practices

- Prefer semantic tokens over raw values.
- Keep component usage consistent with existing variants.
- Make color and spacing changes by updating CSS tokens in `app/globals.css` rather than using ad-hoc values.
- Use `@apply` sparingly in `app/globals.css` for base element styling, and use Tailwind utility classes in components.
- Keep dark mode support in mind by using semantic colors like `bg-card` and `text-muted-foreground`.

## Useful classes

- `bg-background`, `text-foreground`
- `bg-card`, `border-border`
- `text-muted-foreground`, `text-muted`
- `bg-primary`, `text-primary-foreground`
- `bg-secondary`, `text-secondary-foreground`
- `shadow-token-md`, `shadow-token-lg`
- `rounded-lg`, `rounded-md`
- `p-token-6`, `px-token-4`, `gap-token-4`

## Notes

This design system is intentionally lightweight. It is built to support the existing Kora frontend components and keep the app scalable through semantic tokens and reusable patterns.

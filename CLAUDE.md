# Dutch Tax Calculator — Project Rules

## Version bumping (MANDATORY)

**Always bump `APP_VERSION` in `dutch-tax-calculator/src/App.tsx` before every commit.**

- The constant is on line ~54: `const APP_VERSION = 'vX.Y.Z';`
- Use semantic versioning: patch bump (Z+1) for fixes and small changes, minor bump (Y+1) for new features
- After changing the version, rebuild (`npm run build` inside `dutch-tax-calculator/`) and include the updated `dist/` in the same commit
- Never commit without updating the version first

## Deployment

- `dist/` is tracked in git (not gitignored) so Cloudflare Pages serves pre-built files directly — no build step needed on CF side
- Branch: `claude/dutch-tax-calculator-wibPq`
- Always push to that branch: `git push -u origin claude/dutch-tax-calculator-wibPq`

## i18n

- All user-visible strings must use translation keys from `src/i18n/translations.ts`
- Both `nl` and `en` objects must have matching keys
- `InfoTooltip tip=` props must use `t.*` keys, never hardcoded Dutch strings

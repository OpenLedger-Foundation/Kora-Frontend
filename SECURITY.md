# Security Policy

Thank you for helping keep Kora-Frontend secure. This document explains how to report security issues and our approach to handling them.

## Reporting a Vulnerability

- Preferred: Open a private GitHub security advisory or email the maintainers at security@openledger.foundation (replace with the real address).
- If sensitive data is involved, do not create a public issue or PR.

Provide:

- Affected components and versions.
- Steps to reproduce (minimal repro preferred).
- Impact assessment and suggested mitigation.

## Supported Versions

We support the `main` branch and the latest released tag. If you're unsure whether a version is supported, contact us.

## Our Process

1. Acknowledge receipt within 3 business days.
2. Triage and reproduce the issue.
3. Coordinate fix and disclosure timeline with the reporter.
4. Release a fix and public advisory if appropriate.

## Safe Harbor

We welcome good-faith security research. Please avoid privacy violations, data destruction, and denial-of-service testing without prior consent.

## Security Best Practices for Contributors

- Never commit secrets or credentials. Use environment variables and secret stores.
- Keep dependencies up to date; run `npm audit` and address high/critical issues.
- Validate and sanitize all inputs, especially when interacting with contract builders and IPFS uploads.

## Dependency Vulnerability Scanning

We run automated dependency vulnerability scanning in CI using `npm audit --audit-level=high`. The build will fail if any unexcepted high or critical severity vulnerabilities are detected.

### Handling Vulnerability Reports & False Positives

If a vulnerability is identified as a false positive, does not affect Kora-Frontend due to our specific usage, or is a development-only threat, it can be bypassed by adding an entry to [audit-exceptions.json](file:///workspaces/Kora-Frontend/audit-exceptions.json).

Each exception must include:
- `advisoryId`: The security advisory ID.
- `package`: The name of the package.
- `url`: The link to the GitHub Advisory or vulnerability report.
- `reason`: A detailed justification explaining why this vulnerability is not exploitable or applicable in our project.

The CI environment executes `scripts/audit.js` to enforce these checks.

## Contact

Create a private GitHub Security Advisory or email security@openledger.foundation.

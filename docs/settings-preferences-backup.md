# Encrypted preferences backups

Open Settings after connecting a wallet. Export preferences to download
`kora-preferences.json`. Import preferences and choose **Decrypt and apply**
to replace the current wallet's notification preferences and concentration
thresholds. Keep the passphrase somewhere safe. Kora cannot recover it.

The version 1 JSON envelope identifies the format as `kora-preferences`.
PBKDF2-SHA-256 with 600,000 iterations and a random 16-byte salt derives
a 256-bit AES-GCM key. Each export uses a random 12-byte IV and a 128-bit
authentication tag. Salt, IV, and ciphertext with tag use standard base64.
The compact JSON encoding of the ordered metadata fields `format`, `version`,
`cipher`, `kdf`, `hash`, and `iterations` is authenticated as additional data.
The UTF-8 plaintext contains `notifications` and `thresholds`.

Only those preference fields are portable. Wallet addresses, credentials,
notes, onboarding progress, alert dismissals, and snoozes are excluded.
The importer checks the file size, format, version, and algorithm parameters
before decryption. It validates authenticated plaintext against the version 1
schema before applying both settings slices in a single store update.
Existing local settings migration continues to run when the store hydrates.

Web Crypto requires a secure browser context such as HTTPS or localhost.
